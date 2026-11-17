import fs from 'node:fs';
import path from 'node:path';

export interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

export interface DesktopPreferences {
  startWithWindows: boolean;
  keepAgentRunning: boolean;
  windowBounds: WindowBounds;
}

export interface SessionHistoryEntry {
  id: string;
  timestamp: string;
  category: 'scan' | 'analysis' | 'optimization_apply' | 'optimization_restore' | 'launch' | 'agent';
  titleAr: string;
  detailAr: string;
  outcome: 'success' | 'warning' | 'info';
}

export interface DesktopManifest {
  installedVersion: string;
  lastUpdatedAt: string;
  lastBackupDir: string | null;
}

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = {
  startWithWindows: false,
  keepAgentRunning: false,
  windowBounds: {
    width: 1360,
    height: 860,
    isMaximized: false,
  },
};

const PRESERVED_USER_FILES = [
  'gamebooster.db',
  'gamebooster.db-wal',
  'gamebooster.db-shm',
  'manual_games.json',
  'custom_folders.json',
  'game_metadata.json',
  'desktop-preferences.json',
  'session-history.json',
  'agent-token.txt',
];

export function resolveDefaultDataDirectory(): string {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData', 'Local');
    return path.join(localAppData, 'GameBoosterPro');
  }
  const home = process.env.HOME || '/tmp';
  return path.join(home, '.local', 'share', 'GameBoosterPro');
}

export function ensureDataDirectories(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'logs'), { recursive: true });
}

export function prepareUpgradeBackupIfNeeded(
  dataDir: string,
  currentAppVersion: string
): { upgradedFrom: string | null; backupPath: string | null } {
  ensureDataDirectories(dataDir);
  const manifestPath = path.join(dataDir, 'desktop-manifest.json');

  let previousManifest: DesktopManifest | null = null;
  if (fs.existsSync(manifestPath)) {
    try {
      previousManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as DesktopManifest;
    } catch {
      previousManifest = null;
    }
  }

  let backupPath: string | null = null;
  let upgradedFrom: string | null = null;

  if (previousManifest && previousManifest.installedVersion !== currentAppVersion) {
    upgradedFrom = previousManifest.installedVersion;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safePrev = previousManifest.installedVersion.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeCurr = currentAppVersion.replace(/[^a-zA-Z0-9._-]/g, '_');
    backupPath = path.join(dataDir, 'backups', `upgrade_${safePrev}_to_${safeCurr}_${stamp}`);
    fs.mkdirSync(backupPath, { recursive: true });

    for (const fileName of PRESERVED_USER_FILES) {
      const srcFile = path.join(dataDir, fileName);
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, path.join(backupPath, fileName));
      }
    }

    const backupsDir = path.join(dataDir, 'backups');
    for (const entry of fs.readdirSync(backupsDir)) {
      if (entry.endsWith('.json')) {
        fs.copyFileSync(path.join(backupsDir, entry), path.join(backupPath, entry));
      }
    }
  }

  const updatedManifest: DesktopManifest = {
    installedVersion: currentAppVersion,
    lastUpdatedAt: new Date().toISOString(),
    lastBackupDir: backupPath ?? previousManifest?.lastBackupDir ?? null,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(updatedManifest, null, 2), 'utf8');

  return { upgradedFrom, backupPath };
}

export function loadPreferences(dataDir: string): DesktopPreferences {
  ensureDataDirectories(dataDir);
  const prefPath = path.join(dataDir, 'desktop-preferences.json');
  if (!fs.existsSync(prefPath)) {
    return { ...DEFAULT_DESKTOP_PREFERENCES, windowBounds: { ...DEFAULT_DESKTOP_PREFERENCES.windowBounds } };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(prefPath, 'utf8')) as Partial<DesktopPreferences>;
    return {
      startWithWindows: Boolean(parsed.startWithWindows),
      keepAgentRunning: Boolean(parsed.keepAgentRunning),
      windowBounds: {
        ...DEFAULT_DESKTOP_PREFERENCES.windowBounds,
        ...(parsed.windowBounds ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_DESKTOP_PREFERENCES, windowBounds: { ...DEFAULT_DESKTOP_PREFERENCES.windowBounds } };
  }
}

export function savePreferences(dataDir: string, partial: Partial<DesktopPreferences>): DesktopPreferences {
  ensureDataDirectories(dataDir);
  const current = loadPreferences(dataDir);
  const next: DesktopPreferences = {
    ...current,
    ...partial,
    windowBounds: {
      ...current.windowBounds,
      ...(partial.windowBounds ?? {}),
    },
  };
  fs.writeFileSync(path.join(dataDir, 'desktop-preferences.json'), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function loadSessionHistory(dataDir: string): SessionHistoryEntry[] {
  ensureDataDirectories(dataDir);
  const historyPath = path.join(dataDir, 'session-history.json');
  if (!fs.existsSync(historyPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    return Array.isArray(parsed) ? (parsed as SessionHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendSessionEntry(
  dataDir: string,
  entry: Omit<SessionHistoryEntry, 'id' | 'timestamp'>
): SessionHistoryEntry[] {
  const existing = loadSessionHistory(dataDir);
  const record: SessionHistoryEntry = {
    ...entry,
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  const updated = [record, ...existing].slice(0, 100);
  fs.writeFileSync(path.join(dataDir, 'session-history.json'), JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}
