import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDataDirectories } from './dataPreservation';
import { isLoopbackUrl, isSafeAgentBinaryPath, maskBearerToken } from './security';

export type AgentProcessState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'restarting'
  | 'crashed'
  | 'missing_binary';

export interface DesktopAgentStatus {
  state: AgentProcessState;
  pid: number | null;
  baseUrl: string;
  restartAttempts: number;
  lastHealthCheckAt: string | null;
  messageAr: string;
  binaryPath: string | null;
}

export interface AgentSupervisorOptions {
  dataDir: string;
  agentBinaryPath: string | null;
  port?: number;
  maxAutoRestarts?: number;
  healthCheckIntervalMs?: number;
  spawnFn?: typeof spawn;
  fetchFn?: typeof fetch;
  onStatusChange?: (status: DesktopAgentStatus) => void;
}

export class AgentSupervisor {
  private readonly dataDir: string;
  private readonly agentBinaryPath: string | null;
  private readonly port: number;
  private readonly baseUrl: string;
  private readonly maxAutoRestarts: number;
  private readonly healthCheckIntervalMs: number;
  private readonly spawnFn: typeof spawn;
  private readonly fetchFn: typeof fetch;
  private readonly onStatusChange?: (status: DesktopAgentStatus) => void;

  private child: ChildProcess | null = null;
  private isShuttingDown = false;
  private healthTimer: NodeJS.Timeout | null = null;
  private restartTimer: NodeJS.Timeout | null = null;
  private status: DesktopAgentStatus;

  constructor(options: AgentSupervisorOptions) {
    this.dataDir = options.dataDir;
    this.agentBinaryPath = options.agentBinaryPath;
    this.port = options.port ?? 48920;
    this.baseUrl = `http://127.0.0.1:${this.port}`;
    this.maxAutoRestarts = options.maxAutoRestarts ?? 3;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? 5000;
    this.spawnFn = options.spawnFn ?? spawn;
    this.fetchFn = options.fetchFn ?? fetch;
    this.onStatusChange = options.onStatusChange;

    if (!isLoopbackUrl(this.baseUrl)) {
      throw new Error('Security policy violation: AgentSupervisor must bind strictly to loopback.');
    }

    this.status = {
      state: 'stopped',
      pid: null,
      baseUrl: this.baseUrl,
      restartAttempts: 0,
      lastHealthCheckAt: null,
      messageAr: 'الوكيل المحلي متوقف حالياً.',
      binaryPath: this.agentBinaryPath,
    };
  }

  public getStatus(): DesktopAgentStatus {
    return { ...this.status };
  }

  public ensureOrReadToken(): string {
    ensureDataDirectories(this.dataDir);
    const tokenPath = path.join(this.dataDir, 'agent-token.txt');
    if (fs.existsSync(tokenPath)) {
      const existing = fs.readFileSync(tokenPath, 'utf8').trim();
      if (existing.length >= 16) {
        return existing;
      }
    }
    const generated = crypto.randomBytes(24).toString('hex');
    fs.writeFileSync(tokenPath, generated, { encoding: 'utf8', mode: 0o600 });
    return generated;
  }

  public async start(): Promise<DesktopAgentStatus> {
    this.isShuttingDown = false;
    const token = this.ensureOrReadToken();

    // If an external agent instance is already healthy on 127.0.0.1:48920 with our token, reuse safely
    const alreadyHealthy = await this.checkHealthOnce(token);
    if (alreadyHealthy) {
      this.updateStatus({
        state: 'running',
        pid: this.child?.pid ?? null,
        lastHealthCheckAt: new Date().toISOString(),
        messageAr: 'الوكيل المحلي يعمل ومتصل بأمان عبر 127.0.0.1.',
      });
      this.startHealthPolling(token);
      return this.getStatus();
    }

    if (!this.agentBinaryPath || !fs.existsSync(this.agentBinaryPath)) {
      this.logSupervisorEvent('missing_binary', `Binary missing at ${this.agentBinaryPath ?? 'null'}`);
      this.updateStatus({
        state: 'missing_binary',
        pid: null,
        messageAr: 'ملف الوكيل المحلي (GameBoosterPro.Agent.exe) غير موجود في الحزمة. يمكنك استخدام الوضع التجريبي أو إعادة التثبيت.',
      });
      return this.getStatus();
    }

    if (!isSafeAgentBinaryPath(this.agentBinaryPath)) {
      this.logSupervisorEvent('blocked_binary', 'Unsafe agent binary path rejected by policy.');
      this.updateStatus({
        state: 'crashed',
        pid: null,
        messageAr: 'تم حظر تشغيل مسار غير مصرح به للوكيل المحلي.',
      });
      return this.getStatus();
    }

    this.updateStatus({
      state: this.status.restartAttempts > 0 ? 'restarting' : 'starting',
      messageAr:
        this.status.restartAttempts > 0
          ? `جارٍ إعادة تشغيل الوكيل المحلي تلقائياً (المحاولة ${this.status.restartAttempts}/${this.maxAutoRestarts})...`
          : 'جارٍ تشغيل الوكيل المحلي لنظام ويندوز...',
    });

    const args = this.agentBinaryPath.toLowerCase().endsWith('.dll') ? [this.agentBinaryPath] : [];
    const command = this.agentBinaryPath.toLowerCase().endsWith('.dll') ? 'dotnet' : this.agentBinaryPath;

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      Agent__BindHost: '127.0.0.1',
      Agent__Port: String(this.port),
      Agent__AuthToken: token,
      Agent__DataDirectory: this.dataDir,
      Agent__AllowedOrigins__0: 'http://localhost:3000',
      Agent__AllowedOrigins__1: 'http://127.0.0.1:3000',
      Agent__AllowedOrigins__2: 'file://',
      Agent__AllowedOrigins__3: 'null',
    };

    const proc = this.spawnFn(command, args, {
      cwd: path.dirname(this.agentBinaryPath),
      env: childEnv,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.child = proc;
    this.logSupervisorEvent('spawned', `Started agent PID=${proc.pid ?? 'unknown'} token=${maskBearerToken(token)}`);

    proc.on('exit', (code, signal) => {
      this.child = null;
      if (this.isShuttingDown) {
        this.updateStatus({
          state: 'stopped',
          pid: null,
          messageAr: 'تم إيقاف الوكيل المحلي بأمان.',
        });
        return;
      }

      this.logSupervisorEvent('unexpected_exit', `Agent exited unexpectedly (code=${code}, signal=${signal})`);
      this.handleUnexpectedCrash(code);
    });

    proc.on('error', (err) => {
      this.child = null;
      if (this.isShuttingDown) return;
      this.logSupervisorEvent('spawn_error', err.message);
      this.handleUnexpectedCrash(null);
    });

    // Wait briefly up to 4 seconds for first health response
    for (let i = 0; i < 8; i++) {
      if (this.isShuttingDown) break;
      const healthy = await this.checkHealthOnce(token);
      if (healthy) {
        this.updateStatus({
          state: 'running',
          pid: proc.pid ?? null,
          restartAttempts: 0,
          lastHealthCheckAt: new Date().toISOString(),
          messageAr: 'الوكيل المحلي يعمل ومتصل بنجاح.',
        });
        this.startHealthPolling(token);
        return this.getStatus();
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    this.startHealthPolling(token);
    return this.getStatus();
  }

  public async checkHealthOnce(token: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      try {
        const res = await this.fetchFn(`${this.baseUrl}/api/v1/health`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Client-Origin': 'file://',
          },
          signal: controller.signal,
        });
        return res.ok;
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return false;
    }
  }

  public async manualRestart(): Promise<DesktopAgentStatus> {
    await this.stop();
    this.status.restartAttempts = 0;
    return this.start();
  }

  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    const proc = this.child;
    if (!proc) {
      this.updateStatus({
        state: 'stopped',
        pid: null,
        messageAr: 'الوكيل المحلي متوقف.',
      });
      return;
    }

    await new Promise<void>((resolve) => {
      const forceTimer = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // ignore
        }
        resolve();
      }, 2500);

      proc.once('exit', () => {
        clearTimeout(forceTimer);
        resolve();
      });

      try {
        proc.kill('SIGTERM');
      } catch {
        clearTimeout(forceTimer);
        resolve();
      }
    });

    this.child = null;
    this.updateStatus({
      state: 'stopped',
      pid: null,
      messageAr: 'تم إيقاف الوكيل المحلي بأمان.',
    });
  }

  private startHealthPolling(token: string): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = setInterval(async () => {
      if (this.isShuttingDown) return;
      const ok = await this.checkHealthOnce(token);
      if (ok) {
        if (this.status.state !== 'running') {
          this.updateStatus({
            state: 'running',
            pid: this.child?.pid ?? null,
            restartAttempts: 0,
            lastHealthCheckAt: new Date().toISOString(),
            messageAr: 'الوكيل المحلي يعمل ومتصل بنجاح.',
          });
        } else {
          this.status.lastHealthCheckAt = new Date().toISOString();
        }
      } else if (this.status.state === 'running' && !this.child) {
        this.handleUnexpectedCrash(null);
      }
    }, this.healthCheckIntervalMs);
  }

  private handleUnexpectedCrash(exitCode: number | null): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }

    const nextAttempts = this.status.restartAttempts + 1;
    if (nextAttempts <= this.maxAutoRestarts) {
      const backoffMs = 1500 * Math.pow(2, nextAttempts - 1);
      this.updateStatus({
        state: 'restarting',
        pid: null,
        restartAttempts: nextAttempts,
        messageAr: `توقف الوكيل المحلي فجأة${exitCode !== null ? ` (${exitCode})` : ''}. جارٍ الاستعادة التلقائية خلال ${(backoffMs / 1000).toFixed(1)} ث...`,
      });
      this.restartTimer = setTimeout(() => {
        if (!this.isShuttingDown) {
          void this.start();
        }
      }, backoffMs);
    } else {
      this.updateStatus({
        state: 'crashed',
        pid: null,
        restartAttempts: nextAttempts,
        messageAr: 'تعذر استقرار الوكيل المحلي بعد 3 محاولات. اضغط «إعادة تشغيل الوكيل» أو راجع السجل المحلي.',
      });
    }
  }

  private updateStatus(partial: Partial<DesktopAgentStatus>): void {
    this.status = { ...this.status, ...partial };
    this.onStatusChange?.(this.getStatus());
  }

  private logSupervisorEvent(event: string, detail: string): void {
    try {
      ensureDataDirectories(this.dataDir);
      const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        event,
        detail,
      });
      fs.appendFileSync(path.join(this.dataDir, 'logs', 'desktop-supervisor.log'), `${line}\n`, 'utf8');
    } catch {
      // Never crash desktop app on log write failure
    }
  }
}
