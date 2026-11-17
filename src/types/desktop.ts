export type DesktopAgentProcessState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'restarting'
  | 'crashed'
  | 'missing_binary';

export interface DesktopAgentStatus {
  state: DesktopAgentProcessState;
  pid: number | null;
  baseUrl: string;
  restartAttempts: number;
  lastHealthCheckAt: string | null;
  messageAr: string;
  binaryPath: string | null;
}

export interface DesktopPreferences {
  startWithWindows: boolean;
  keepAgentRunning: boolean;
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    isMaximized?: boolean;
  };
}

export interface SessionHistoryEntry {
  id: string;
  timestamp: string;
  category:
    | 'scan'
    | 'analysis'
    | 'optimization_apply'
    | 'optimization_restore'
    | 'launch'
    | 'agent';
  titleAr: string;
  detailAr: string;
  outcome: 'success' | 'warning' | 'info';
}

export interface DesktopAgentCredentials {
  baseUrl: string;
  authToken: string;
}

export interface DesktopBridgeApi {
  isDesktopApp: true;
  platform: string;
  appVersion: string;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<boolean>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;

  getAgentStatus: () => Promise<DesktopAgentStatus>;
  getAgentConnectionCredentials: () => Promise<DesktopAgentCredentials>;
  restartAgent: () => Promise<DesktopAgentStatus>;
  onAgentStatusChange: (callback: (status: DesktopAgentStatus) => void) => () => void;

  getPreferences: () => Promise<DesktopPreferences>;
  updatePreferences: (partial: Partial<DesktopPreferences>) => Promise<DesktopPreferences>;

  getSessionHistory: () => Promise<SessionHistoryEntry[]>;
  recordSessionEvent: (
    entry: Omit<SessionHistoryEntry, 'id' | 'timestamp'>
  ) => Promise<SessionHistoryEntry[]>;

  requestElevationConsent: (actionTitleAr: string, reasonAr: string) => Promise<boolean>;
  browseGameExecutable?: () => Promise<string | null>;
  browseGameFolder?: () => Promise<string | null>;
}

declare global {
  interface Window {
    gbpDesktop?: DesktopBridgeApi;
  }
}
