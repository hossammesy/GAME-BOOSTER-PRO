import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

// Direct TypeScript/ESM-free test harness compiling desktop TS modules via TypeScript compiler or testing exact built JS
import { execFileSync } from 'node:child_process';

const desktopRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(desktopRoot, '..');

// Compile desktop/src/*.ts to a temporary directory using root typescript compiler if desktop/node_modules isn't installed
const compiledDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbp-desktop-compiled-'));
const tscBin = path.join(repoRoot, 'node_modules', '.bin', 'tsc');

const tempTsConfigPath = path.join(compiledDir, 'tsconfig.test.json');
fs.writeFileSync(
  tempTsConfigPath,
  JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'CommonJS',
      outDir: compiledDir,
      rootDir: path.join(desktopRoot, 'src'),
      typeRoots: [path.join(repoRoot, 'node_modules', '@types')],
      types: ['node'],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    files: [
      path.join(desktopRoot, 'src', 'security.ts'),
      path.join(desktopRoot, 'src', 'dataPreservation.ts'),
      path.join(desktopRoot, 'src', 'agentSupervisor.ts'),
    ],
  }),
  'utf8'
);

execFileSync(tscBin, ['-p', tempTsConfigPath], { stdio: 'pipe' });

const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const security = require(path.join(compiledDir, 'security.js'));
const preservation = require(path.join(compiledDir, 'dataPreservation.js'));
const { AgentSupervisor } = require(path.join(compiledDir, 'agentSupervisor.js'));

test('Security: enforces loopback URLs, masks tokens, blocks external navigation and unsafe binaries', () => {
  assert.equal(security.isLoopbackUrl('http://127.0.0.1:48920'), true);
  assert.equal(security.isLoopbackUrl('http://localhost:48920'), true);
  assert.equal(security.isLoopbackUrl('https://evil.example.com'), false);
  assert.equal(security.isLoopbackUrl('ftp://127.0.0.1:48920'), false);

  const masked = security.maskBearerToken('abcdef1234567890fedcba');
  assert.equal(masked, 'abcd...dcba');
  assert.ok(!masked.includes('1234567890'));

  assert.equal(security.isAllowedRendererNavigation('file:///C:/app/index.html', false), true);
  assert.equal(security.isAllowedRendererNavigation('https://untrusted.example.com', true), false);
  assert.equal(security.isAllowedRendererNavigation('http://127.0.0.1:3000', true), true);

  assert.equal(security.isSafeAgentBinaryPath('C:\\Program Files\\GameBoosterPro.Agent.exe'), true);
  assert.equal(security.isSafeAgentBinaryPath('C:\\Games\\bad.exe & calc.exe'), false);
  assert.equal(security.isSafeAgentBinaryPath('C:\\Temp\\unknown.exe'), false);
});

test('DataPreservation: creates pre-upgrade backup and preserves library, settings, and session history', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbp-data-'));
  preservation.ensureDataDirectories(tempDir);

  const gamesContent = JSON.stringify([{ id: 'manual_1', title: 'Forza Horizon 4' }]);
  fs.writeFileSync(path.join(tempDir, 'manual_games.json'), gamesContent, 'utf8');
  preservation.savePreferences(tempDir, { startWithWindows: true });
  preservation.appendSessionEntry(tempDir, {
    category: 'scan',
    titleAr: 'فحص أولي',
    detailAr: 'تم فحص الألعاب',
    outcome: 'success',
  });

  // Initial manifest for v1.0.0
  const firstRun = preservation.prepareUpgradeBackupIfNeeded(tempDir, '1.0.0');
  assert.equal(firstRun.upgradedFrom, null);

  // Simulate upgrade to v1.1.0
  const upgradeRun = preservation.prepareUpgradeBackupIfNeeded(tempDir, '1.1.0');
  assert.equal(upgradeRun.upgradedFrom, '1.0.0');
  assert.ok(upgradeRun.backupPath && fs.existsSync(upgradeRun.backupPath));

  // Verify backup snapshot contains preserved user files
  assert.equal(fs.readFileSync(path.join(upgradeRun.backupPath, 'manual_games.json'), 'utf8'), gamesContent);
  assert.ok(fs.existsSync(path.join(upgradeRun.backupPath, 'desktop-preferences.json')));
  assert.ok(fs.existsSync(path.join(upgradeRun.backupPath, 'session-history.json')));

  // Verify live user data was NOT deleted or overwritten
  assert.equal(fs.readFileSync(path.join(tempDir, 'manual_games.json'), 'utf8'), gamesContent);
  assert.equal(preservation.loadPreferences(tempDir).startWithWindows, true);
  assert.equal(preservation.loadSessionHistory(tempDir).length, 1);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('AgentSupervisor: handles missing binary cleanly without fabricating running state', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbp-sup-missing-'));
  const sup = new AgentSupervisor({
    dataDir: tempDir,
    agentBinaryPath: path.join(tempDir, 'GameBoosterPro.Agent.exe'),
    fetchFn: async () => {
      throw new Error('ECONNREFUSED');
    },
  });

  const status = await sup.start();
  assert.equal(status.state, 'missing_binary');
  assert.equal(status.pid, null);
  await sup.stop();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('AgentSupervisor: starts safely, checks health, detects crash, and stops cleanly', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbp-sup-live-'));
  const fakeExe = path.join(tempDir, 'GameBoosterPro.Agent.exe');
  fs.writeFileSync(fakeExe, 'stub', 'utf8');

  let activeChild = null;
  let healthCalls = 0;

  const mockSpawn = () => {
    const emitter = new EventEmitter();
    emitter.pid = 43210;
    emitter.kill = () => {
      emitter.emit('exit', 0, null);
      return true;
    };
    activeChild = emitter;
    return emitter;
  };

  const mockFetch = async () => {
    healthCalls += 1;
    // First call (pre-check before spawn) fails so spawn executes; subsequent calls succeed
    if (healthCalls === 1) {
      throw new Error('Not running yet');
    }
    return { ok: true, status: 200 };
  };

  const statuses = [];
  const sup = new AgentSupervisor({
    dataDir: tempDir,
    agentBinaryPath: fakeExe,
    maxAutoRestarts: 2,
    healthCheckIntervalMs: 60000,
    spawnFn: mockSpawn,
    fetchFn: mockFetch,
    onStatusChange: (s) => statuses.push(s.state),
  });

  const started = await sup.start();
  assert.equal(started.state, 'running');
  assert.equal(started.pid, 43210);
  assert.ok(fs.existsSync(path.join(tempDir, 'agent-token.txt')));

  // Simulate unexpected crash of child process -> supervisor enters restarting recovery state
  activeChild.emit('exit', 1, null);
  assert.equal(sup.getStatus().state, 'restarting');
  assert.equal(sup.getStatus().restartAttempts, 1);

  await sup.stop();
  assert.equal(sup.getStatus().state, 'stopped');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Installer & Build Configuration: enforces asInvoker non-admin default and GAME_BOOSTER_PRO_Setup.exe output', () => {
  const yml = fs.readFileSync(path.join(desktopRoot, 'electron-builder.yml'), 'utf8');
  assert.match(yml, /artifactName:\s*GAME_BOOSTER_PRO_Setup\.exe/);
  assert.match(yml, /requestedExecutionLevel:\s*asInvoker/);
  assert.match(yml, /perMachine:\s*false/);
  assert.match(yml, /deleteAppDataOnUninstall:\s*false/);
  assert.ok(fs.existsSync(path.join(desktopRoot, 'build', 'icon.ico')));
  assert.ok(fs.existsSync(path.join(desktopRoot, 'build', 'icon.png')));
});

test.after(() => {
  fs.rmSync(compiledDir, { recursive: true, force: true });
});
