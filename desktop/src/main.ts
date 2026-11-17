import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { AgentSupervisor } from './agentSupervisor';
import {
  appendSessionEntry,
  loadPreferences,
  loadSessionHistory,
  prepareUpgradeBackupIfNeeded,
  resolveDefaultDataDirectory,
  savePreferences,
  type DesktopPreferences,
  type SessionHistoryEntry,
} from './dataPreservation';
import { isAllowedRendererNavigation } from './security';

const isDev = process.env.GBP_DESKTOP_DEV === '1';
const APP_VERSION = app.getVersion() || '1.0.0';
process.env.GBP_APP_VERSION = APP_VERSION;

// Enforce single instance on Windows
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let supervisor: AgentSupervisor | null = null;
const dataDir = resolveDefaultDataDirectory();

function resolveRendererEntry(): { type: 'url'; url: string } | { type: 'file'; filePath: string } {
  if (isDev) {
    return { type: 'url', url: 'http://127.0.0.1:3000' };
  }

  const packagedRenderer = path.join(app.getAppPath(), 'renderer', 'index.html');
  if (fs.existsSync(packagedRenderer)) {
    return { type: 'file', filePath: packagedRenderer };
  }

  const localDistRenderer = path.resolve(__dirname, '..', '..', 'dist', 'index.html');
  return { type: 'file', filePath: localDistRenderer };
}

function resolveAgentBinaryPath(): string | null {
  if (app.isPackaged) {
    const packagedExe = path.join(process.resourcesPath, 'agent', 'GameBoosterPro.Agent.exe');
    if (fs.existsSync(packagedExe)) return packagedExe;
  }

  const candidates = [
    path.resolve(__dirname, '..', '..', 'WindowsAgent', 'publish-win-x64', 'GameBoosterPro.Agent.exe'),
    path.resolve(__dirname, '..', '..', 'WindowsAgent', 'src', 'GameBoosterPro.Agent', 'bin', 'Release', 'net8.0-windows10.0.19041.0', 'win-x64', 'publish', 'GameBoosterPro.Agent.exe'),
    path.resolve(__dirname, '..', '..', 'WindowsAgent', 'src', 'GameBoosterPro.Agent', 'bin', 'Debug', 'net8.0-windows10.0.19041.0', 'GameBoosterPro.Agent.exe'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function createSplashWindow(): BrowserWindow {
  const iconPath = path.resolve(__dirname, '..', 'build', 'icon.png');
  const win = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    transparent: false,
    backgroundColor: '#0B192C',
    center: true,
    show: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const packagedSplash = path.join(app.getAppPath(), 'src', 'splash.html');
  const devSplash = path.resolve(__dirname, '..', 'src', 'splash.html');
  void win.loadFile(fs.existsSync(packagedSplash) ? packagedSplash : devSplash);
  return win;
}

function createMainWindow(prefs: DesktopPreferences): BrowserWindow {
  const iconPath = path.resolve(__dirname, '..', 'build', 'icon.png');

  const win = new BrowserWindow({
    width: prefs.windowBounds.width || 1360,
    height: prefs.windowBounds.height || 860,
    x: prefs.windowBounds.x,
    y: prefs.windowBounds.y,
    minWidth: 1080,
    minHeight: 700,
    frame: false,
    backgroundColor: '#0B192C',
    title: 'GAME BOOSTER PRO',
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Security: disallow popups and unknown external navigations
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedRendererNavigation(targetUrl, isDev)) {
      event.preventDefault();
    }
  });

  win.on('maximize', () => {
    win.webContents.send('window:maximized-changed', true);
    savePreferences(dataDir, { windowBounds: { ...win.getBounds(), isMaximized: true } });
  });
  win.on('unmaximize', () => {
    win.webContents.send('window:maximized-changed', false);
    savePreferences(dataDir, { windowBounds: { ...win.getBounds(), isMaximized: false } });
  });

  const persistBounds = () => {
    if (!win.isMaximized() && !win.isMinimized()) {
      savePreferences(dataDir, {
        windowBounds: { ...win.getBounds(), isMaximized: false },
      });
    }
  };
  win.on('resized', persistBounds);
  win.on('moved', persistBounds);

  const entry = resolveRendererEntry();
  if (entry.type === 'url') {
    void win.loadURL(entry.url);
  } else {
    void win.loadFile(entry.filePath);
  }

  win.once('ready-to-show', () => {
    setTimeout(() => {
      if (prefs.windowBounds.isMaximized) {
        win.maximize();
      }
      win.show();
      win.focus();
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
    }, 550);
  });

  return win;
}

function registerIpcHandlers(): void {
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }
    mainWindow.maximize();
    return true;
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  ipcMain.handle('agent:status', () => {
    return supervisor?.getStatus() ?? null;
  });

  ipcMain.handle('agent:credentials', () => {
    const token = supervisor?.ensureOrReadToken() ?? '';
    const status = supervisor?.getStatus();
    return {
      baseUrl: status?.baseUrl ?? 'http://127.0.0.1:48920',
      authToken: token,
    };
  });

  ipcMain.handle('agent:restart', async () => {
    if (!supervisor) return null;
    const status = await supervisor.manualRestart();
    appendSessionEntry(dataDir, {
      category: 'agent',
      titleAr: 'إعادة تشغيل الوكيل المحلي',
      detailAr: status.messageAr,
      outcome: status.state === 'running' ? 'success' : 'warning',
    });
    return status;
  });

  ipcMain.handle('desktop:get-preferences', () => {
    return loadPreferences(dataDir);
  });

  ipcMain.handle('desktop:update-preferences', (_event, partial: Partial<DesktopPreferences>) => {
    const next = savePreferences(dataDir, partial);
    if (typeof partial.startWithWindows === 'boolean') {
      app.setLoginItemSettings({
        openAtLogin: partial.startWithWindows,
        name: 'GameBoosterProDesktop',
      });
    }
    return next;
  });

  ipcMain.handle('desktop:get-session-history', () => {
    return loadSessionHistory(dataDir);
  });

  ipcMain.handle(
    'desktop:record-session-event',
    (_event, entry: Omit<SessionHistoryEntry, 'id' | 'timestamp'>) => {
      return appendSessionEntry(dataDir, entry);
    }
  );

  ipcMain.handle(
    'security:request-elevation-consent',
    async (_event, payload: { actionTitleAr: string; reasonAr: string }) => {
      if (!mainWindow) return false;
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['موافقة على الإجراء المحدد', 'إلغاء'],
        defaultId: 1,
        cancelId: 1,
        title: 'تأكيد صلاحية محددة — GAME BOOSTER PRO',
        message: payload.actionTitleAr,
        detail: `${payload.reasonAr}\n\nلن يتم تشغيل التطبيق بالكامل بصلاحيات المسؤول، ولن يتم المساس بملفات اللعبة أو Windows Defender.`,
      });
      return result.response === 0;
    }
  );

  ipcMain.handle('dialog:browse-exe', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'اختر ملف تشغيل اللعبة (.exe)',
      properties: ['openFile'],
      filters: [{ name: 'Windows Executable', extensions: ['exe'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:browse-folder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'اختر مجلد الألعاب على جهازك',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  // 1. Preserve user data & create upgrade backup snapshot before initializing
  const upgradeInfo = prepareUpgradeBackupIfNeeded(dataDir, APP_VERSION);
  if (upgradeInfo.upgradedFrom) {
    appendSessionEntry(dataDir, {
      category: 'agent',
      titleAr: `ترقية آمنة من الإصدار ${upgradeInfo.upgradedFrom} إلى ${APP_VERSION}`,
      detailAr: `تم نسخ بيانات مكتبة الألعاب والإعدادات احتياطياً قبل الترقية في ${upgradeInfo.backupPath}`,
      outcome: 'info',
    });
  }

  // 2. Show Arabic RTL Navy Splash Screen
  splashWindow = createSplashWindow();

  // 3. Start & supervise Windows Local Agent (Standard user / non-admin by default)
  supervisor = new AgentSupervisor({
    dataDir,
    agentBinaryPath: resolveAgentBinaryPath(),
    onStatusChange: (status) => {
      mainWindow?.webContents.send('agent:status-changed', status);
    },
  });

  registerIpcHandlers();

  const prefs = loadPreferences(dataDir);
  await supervisor.start();
  mainWindow = createMainWindow(prefs);
});

let isQuitting = false;
app.on('before-quit', async (event) => {
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  if (supervisor) {
    await supervisor.stop();
  }
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
