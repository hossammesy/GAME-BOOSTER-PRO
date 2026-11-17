import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAgentStatus } from './agentSupervisor';
import type { DesktopPreferences, SessionHistoryEntry } from './dataPreservation';

export interface DesktopAgentCredentials {
  baseUrl: string;
  authToken: string;
}

export interface DesktopBridgeApi {
  isDesktopApp: true;
  platform: NodeJS.Platform;
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
  browseGameExecutable: () => Promise<string | null>;
  browseGameFolder: () => Promise<string | null>;
}

const bridge: DesktopBridgeApi = {
  isDesktopApp: true,
  platform: process.platform,
  appVersion: process.env.GBP_APP_VERSION || '1.0.0',

  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChange: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized);
    ipcRenderer.on('window:maximized-changed', listener);
    return () => ipcRenderer.removeListener('window:maximized-changed', listener);
  },

  getAgentStatus: () => ipcRenderer.invoke('agent:status'),
  getAgentConnectionCredentials: () => ipcRenderer.invoke('agent:credentials'),
  restartAgent: () => ipcRenderer.invoke('agent:restart'),
  onAgentStatusChange: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: DesktopAgentStatus) =>
      callback(status);
    ipcRenderer.on('agent:status-changed', listener);
    return () => ipcRenderer.removeListener('agent:status-changed', listener);
  },

  getPreferences: () => ipcRenderer.invoke('desktop:get-preferences'),
  updatePreferences: (partial) => ipcRenderer.invoke('desktop:update-preferences', partial),

  getSessionHistory: () => ipcRenderer.invoke('desktop:get-session-history'),
  recordSessionEvent: (entry) => ipcRenderer.invoke('desktop:record-session-event', entry),

  requestElevationConsent: (actionTitleAr, reasonAr) =>
    ipcRenderer.invoke('security:request-elevation-consent', { actionTitleAr, reasonAr }),
  browseGameExecutable: () => ipcRenderer.invoke('dialog:browse-exe'),
  browseGameFolder: () => ipcRenderer.invoke('dialog:browse-folder'),
};

contextBridge.exposeInMainWorld('gbpDesktop', bridge);
