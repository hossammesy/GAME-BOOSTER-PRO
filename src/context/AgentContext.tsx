import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LocalAgentClient,
  LocalAgentError,
  validateGameExecutablePath,
} from '../services/localAgentApi';
import type {
  AgentConnectionConfig,
  AgentHealthResponse,
  AppSettingsState,
  ConnectionState,
  FileSystemBrowseResponse,
  GameLaunchResponse,
  HardwareProfile,
  InstalledGame,
  ManualGameRegistrationInput,
  NavSection,
  OptimizationAnalysisResponse,
  OptimizationPreviewResponse,
  PerformanceSample,
  PerformanceSnapshotResponse,
  RemoteWindowsGpuProfile,
  SmartGameAnalysisResponse,
} from '../types/agent';
import type {
  DesktopAgentStatus,
  DesktopPreferences,
  SessionHistoryEntry,
} from '../types/desktop';

interface NoticeBanner {
  id: string;
  tone: 'success' | 'warning' | 'error' | 'info';
  messageAr: string;
}

interface AgentContextValue {
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;
  connectionState: ConnectionState;
  connectionMessageAr: string;
  config: AgentConnectionConfig;
  updateConfig: (partial: Partial<AgentConnectionConfig>) => void;
  settings: AppSettingsState;
  updateSettings: (partial: Partial<AppSettingsState>) => void;

  health: AgentHealthResponse | null;
  hardware: HardwareProfile | null;
  games: InstalledGame[];
  lastScannedAt: string | null;
  lastScanLocations: string[];
  performance: PerformanceSnapshotResponse | null;
  performanceHistory: PerformanceSample[];

  selectedGameForOptimization: string | null;
  setSelectedGameForOptimization: (gameId: string | null) => void;
  optimizationAnalysis: OptimizationAnalysisResponse | null;
  optimizationPreview: OptimizationPreviewResponse | null;
  setOptimizationPreview: (preview: OptimizationPreviewResponse | null) => void;
  lastBackupSnapshotId: string | null;

  remoteGpuProfiles: RemoteWindowsGpuProfile[];
  addRemoteGpuProfile: (profile: Omit<RemoteWindowsGpuProfile, 'id'>) => void;
  removeRemoteGpuProfile: (id: string) => void;

  registerManualGame: (input: ManualGameRegistrationInput) => boolean;
  updateManualGame: (gameId: string, input: ManualGameRegistrationInput) => boolean;
  removeManualGame: (gameId: string) => void;
  toggleFavorite: (gameId: string) => void;
  customFolders: string[];
  addCustomGameFolder: (folderPath: string) => Promise<boolean>;
  removeCustomGameFolder: (folderPath: string) => Promise<void>;
  browseAgentFileSystem: (path?: string) => Promise<FileSystemBrowseResponse>;

  isScanningDevice: boolean;
  isScanningGames: boolean;
  isAnalyzingOptimization: boolean;
  isApplyingOptimization: boolean;

  selectedGameDetailsId: string | null;
  openGameDetails: (gameId: string) => void;
  closeGameDetails: () => void;
  smartGameAnalysis: SmartGameAnalysisResponse | null;
  isAnalyzingGameDetails: boolean;
  analyzeGameDetails: (gameId: string) => Promise<void>;
  launchStatus: GameLaunchResponse | null;
  isLaunchingGame: boolean;
  launchingGameId: string | null;
  launchGame: (gameId: string, mode: 'local' | 'cloud') => Promise<GameLaunchResponse | null>;
  selectedBackgroundPids: number[];
  toggleBackgroundPid: (pid: number) => void;

  notice: NoticeBanner | null;
  clearNotice: () => void;
  showNotice: (tone: NoticeBanner['tone'], messageAr: string) => void;

  isDesktopApp: boolean;
  desktopAgentStatus: DesktopAgentStatus | null;
  restartDesktopAgent: () => Promise<void>;
  desktopPreferences: DesktopPreferences | null;
  updateDesktopPreferences: (partial: Partial<DesktopPreferences>) => Promise<void>;
  sessionHistory: SessionHistoryEntry[];

  connectAndFetchAll: (overrideConfig?: AgentConnectionConfig) => Promise<void>;
  enableDemoMode: () => Promise<void>;
  disableDemoMode: () => void;
  scanDevice: () => Promise<void>;
  scanInstalledGames: () => Promise<void>;
  refreshPerformance: () => Promise<void>;
  runOptimizationAnalysis: (gameId: string | null) => Promise<void>;
  requestOptimizationPreview: (
    gameId: string | null,
    tweakIds: string[]
  ) => Promise<OptimizationPreviewResponse | null>;
  confirmAndApplyOptimization: (
    previewId: string,
    tweakIds: string[],
    gameId: string | null
  ) => Promise<boolean>;
  restoreDefaultSettings: () => Promise<void>;
}

const STORAGE_SETTINGS_KEY = 'gbp_settings_v1';
const STORAGE_CONFIG_KEY = 'gbp_agent_config_v1';
const STORAGE_REMOTE_PROFILES_KEY = 'gbp_remote_gpu_profiles_v1';
const STORAGE_MANUAL_GAMES_KEY = 'gbp_manual_games_v1';
const STORAGE_SESSION_HISTORY_KEY = 'gbp_session_history_v1';
const STORAGE_FAVORITES_KEY = 'gbp_game_favorites_v1';
const STORAGE_CUSTOM_FOLDERS_KEY = 'gbp_custom_folders_v1';

const DEFAULT_CONFIG: AgentConnectionConfig = {
  baseUrl: 'http://127.0.0.1:48920',
  authToken: '',
  demoMode: false,
};

const DEFAULT_SETTINGS: AppSettingsState = {
  theme: 'dark',
  language: 'ar',
  networkTier: 'medium_10_30',
  connectionType: 'Wi-Fi 5GHz',
  pollIntervalMs: 2000,
};

const DEFAULT_REMOTE_PROFILES: RemoteWindowsGpuProfile[] = [
  {
    id: 'home-rtx-rig',
    label: 'حاسوب المكتب المنزلي (Sunshine Host)',
    protocol: 'Moonlight / Sunshine',
    hostAddress: '192.168.1.45',
    port: 47989,
    targetBitrateMbps: 18,
    targetResolution: '1920x1080@60',
    notes: 'يتطلب تشغيل خادم Sunshine على جهاز ويندوز البعيد وتوصيل الشبكة بتردد 5GHz أو كابل.',
  },
];

const AgentContext = createContext<AgentContextValue | null>(null);

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');

  const [config, setConfig] = useState<AgentConnectionConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AgentConnectionConfig>;
        return {
          baseUrl: parsed.baseUrl || DEFAULT_CONFIG.baseUrl,
          authToken: parsed.authToken || '',
          demoMode: Boolean(parsed.demoMode),
        };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_CONFIG;
  });

  const [settings, setSettings] = useState<AppSettingsState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...(JSON.parse(saved) as Partial<AppSettingsState>) };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_SETTINGS;
  });

  const [remoteGpuProfiles, setRemoteGpuProfiles] = useState<RemoteWindowsGpuProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_REMOTE_PROFILES_KEY);
      if (saved) {
        return JSON.parse(saved) as RemoteWindowsGpuProfile[];
      }
    } catch {
      // ignore
    }
    return DEFAULT_REMOTE_PROFILES;
  });

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    config.demoMode ? 'connected' : 'disconnected'
  );
  const [connectionMessageAr, setConnectionMessageAr] = useState<string>(
    config.demoMode
      ? 'وضع العرض التجريبي مفعّل — بيانات محاكاة للعتاد والألعاب'
      : 'غير متصل بالوكيل المحلي على نظام ويندوز'
  );

  const [health, setHealth] = useState<AgentHealthResponse | null>(null);
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [agentGames, setAgentGames] = useState<InstalledGame[]>([]);
  const [manualGames, setManualGames] = useState<InstalledGame[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MANUAL_GAMES_KEY);
      if (saved) {
        return JSON.parse(saved) as InstalledGame[];
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_FAVORITES_KEY);
      if (saved) {
        return JSON.parse(saved) as string[];
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CUSTOM_FOLDERS_KEY);
      if (saved) {
        return JSON.parse(saved) as string[];
      }
    } catch {
      // ignore
    }
    return [];
  });

  const games = useMemo(() => {
    const favSet = new Set(favoriteIds);
    const existingPaths = new Set(agentGames.map((g) => g.executablePath.toLowerCase()));
    const uniqueManual = manualGames.filter(
      (m) => !m.executablePath || !existingPaths.has(m.executablePath.toLowerCase())
    );
    return [...uniqueManual, ...agentGames].map((g) => ({
      ...g,
      isInstalled: g.isInstalled ?? true,
      isFavorite: Boolean(g.isFavorite) || favSet.has(g.id),
    }));
  }, [agentGames, manualGames, favoriteIds]);

  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [lastScanLocations, setLastScanLocations] = useState<string[]>([]);
  const [performance, setPerformance] = useState<PerformanceSnapshotResponse | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceSample[]>([]);

  const [selectedGameForOptimization, setSelectedGameForOptimization] = useState<string | null>(null);
  const [optimizationAnalysis, setOptimizationAnalysis] = useState<OptimizationAnalysisResponse | null>(null);
  const [optimizationPreview, setOptimizationPreview] = useState<OptimizationPreviewResponse | null>(null);
  const [lastBackupSnapshotId, setLastBackupSnapshotId] = useState<string | null>(null);

  const [isScanningDevice, setIsScanningDevice] = useState(false);
  const [isScanningGames, setIsScanningGames] = useState(false);
  const [isAnalyzingOptimization, setIsAnalyzingOptimization] = useState(false);
  const [isApplyingOptimization, setIsApplyingOptimization] = useState(false);

  const [selectedGameDetailsId, setSelectedGameDetailsId] = useState<string | null>(null);
  const [smartGameAnalysis, setSmartGameAnalysis] = useState<SmartGameAnalysisResponse | null>(null);
  const [isAnalyzingGameDetails, setIsAnalyzingGameDetails] = useState(false);
  const [launchStatus, setLaunchStatus] = useState<GameLaunchResponse | null>(null);
  const [isLaunchingGame, setIsLaunchingGame] = useState(false);
  const [launchingGameId, setLaunchingGameId] = useState<string | null>(null);
  const [selectedBackgroundPids, setSelectedBackgroundPids] = useState<number[]>([]);

  const [notice, setNotice] = useState<NoticeBanner | null>(null);

  const isDesktopApp =
    typeof window !== 'undefined' && Boolean(window.gbpDesktop?.isDesktopApp);
  const [desktopAgentStatus, setDesktopAgentStatus] =
    useState<DesktopAgentStatus | null>(null);
  const [desktopPreferences, setDesktopPreferences] =
    useState<DesktopPreferences | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SESSION_HISTORY_KEY);
      if (saved) {
        return JSON.parse(saved) as SessionHistoryEntry[];
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const clientRef = useRef<LocalAgentClient>(new LocalAgentClient(config));

  useEffect(() => {
    clientRef.current.updateConfig(config);
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_REMOTE_PROFILES_KEY, JSON.stringify(remoteGpuProfiles));
    } catch {
      // ignore
    }
  }, [remoteGpuProfiles]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MANUAL_GAMES_KEY, JSON.stringify(manualGames));
    } catch {
      // ignore
    }
  }, [manualGames]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(favoriteIds));
    } catch {
      // ignore
    }
  }, [favoriteIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CUSTOM_FOLDERS_KEY, JSON.stringify(customFolders));
    } catch {
      // ignore
    }
  }, [customFolders]);

  const clearNotice = useCallback(() => setNotice(null), []);

  const showNotice = useCallback((tone: NoticeBanner['tone'], messageAr: string) => {
    setNotice({
      id: `${Date.now()}`,
      tone,
      messageAr,
    });
  }, []);

  const recordSessionEvent = useCallback(
    (entry: Omit<SessionHistoryEntry, 'id' | 'timestamp'>) => {
      const bridge = typeof window !== 'undefined' ? window.gbpDesktop : undefined;
      if (bridge?.isDesktopApp) {
        void bridge
          .recordSessionEvent(entry)
          .then((updated) => {
            setSessionHistory(updated);
          })
          .catch(() => {
            // keep UI smooth if disk write fails
          });
        return;
      }

      setSessionHistory((prev) => {
        const next: SessionHistoryEntry[] = [
          {
            id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: new Date().toISOString(),
            ...entry,
          },
          ...prev,
        ].slice(0, 100);
        try {
          localStorage.setItem(STORAGE_SESSION_HISTORY_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  const handleAgentError = useCallback(
    (err: unknown) => {
      if (err instanceof LocalAgentError) {
        setConnectionState(err.connectionState);
        setConnectionMessageAr(err.message);
        showNotice(
          err.connectionState === 'permission_required' ? 'warning' : 'error',
          err.message
        );
      } else {
        setConnectionState('error');
        const msg = 'حدث خطأ غير متوقع أثناء التواصل مع الوكيل المحلي.';
        setConnectionMessageAr(msg);
        showNotice('error', msg);
      }
    },
    [showNotice]
  );

  const updateConfig = useCallback((partial: Partial<AgentConnectionConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<AppSettingsState>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        if (!config.demoMode && connectionState === 'connected') {
          void clientRef.current
            .saveSettingsToAgent({
              theme: next.theme,
              language: next.language,
              networkTier: next.networkTier,
              connectionType: next.connectionType,
              pollIntervalMs: String(next.pollIntervalMs),
            })
            .catch(() => {
              // fallback silently to localStorage if agent write unavailable
            });
        }
        return next;
      });
    },
    [config.demoMode, connectionState]
  );

  const connectAndFetchAll = useCallback(
    async (overrideConfig?: AgentConnectionConfig) => {
      const targetConfig = overrideConfig ?? config;
      clientRef.current.updateConfig(targetConfig);
      setIsScanningDevice(true);
      try {
        const healthRes = await clientRef.current.getHealth();
        const [hwRes, gamesRes, perfRes] = await Promise.all([
          clientRef.current.getHardware(),
          clientRef.current.getGames(),
          clientRef.current.getPerformance(),
        ]);

        setHealth(healthRes);
        setHardware(hwRes);
        setAgentGames(gamesRes);
        setPerformance(perfRes);
        setPerformanceHistory([perfRes.sample]);
        setConnectionState('connected');
        setConnectionMessageAr(
          targetConfig.demoMode
            ? 'وضع العرض التجريبي مفعّل — يعرض بيانات محاكاة لجهاز Windows 11 / MX250'
            : `متصل بالوكيل المحلي (${healthRes.agentVersion})`
        );
        if (!targetConfig.demoMode) {
          void Promise.all([
            clientRef.current.getCustomFolders().then((folders) => {
              if (folders.length > 0) setCustomFolders(folders);
            }),
            clientRef.current.getSettingsFromAgent().then((savedMap) => {
              if (Object.keys(savedMap).length > 0) {
                setSettings((prev) => ({
                  ...prev,
                  theme: savedMap.theme === 'light' ? 'light' : savedMap.theme === 'dark' ? 'dark' : prev.theme,
                  networkTier:
                    savedMap.networkTier === 'low_under_10' ||
                    savedMap.networkTier === 'medium_10_30' ||
                    savedMap.networkTier === 'high_over_30'
                      ? savedMap.networkTier
                      : prev.networkTier,
                  connectionType:
                    savedMap.connectionType === 'Wi-Fi 5GHz' ||
                    savedMap.connectionType === 'Ethernet' ||
                    savedMap.connectionType === 'Wi-Fi 2.4GHz'
                      ? savedMap.connectionType
                      : prev.connectionType,
                }));
              }
            }),
          ]).catch(() => {});
          showNotice('success', 'تم الاتصال بالوكيل المحلي وجلب بيانات العتاد والألعاب بنجاح.');
        }
      } catch (err) {
        setHealth(null);
        handleAgentError(err);
      } finally {
        setIsScanningDevice(false);
      }
    },
    [config, handleAgentError, showNotice]
  );

  const enableDemoMode = useCallback(async () => {
    const nextConfig: AgentConnectionConfig = { ...config, demoMode: true };
    setConfig(nextConfig);
    await connectAndFetchAll(nextConfig);
    showNotice(
      'info',
      'تم تفعيل وضع العرض التجريبي. جميع البيانات الظاهرة هي عينة تعريفية لجهاز i7-10610U / MX250.'
    );
  }, [config, connectAndFetchAll, showNotice]);

  const disableDemoMode = useCallback(() => {
    const nextConfig: AgentConnectionConfig = { ...config, demoMode: false };
    setConfig(nextConfig);
    clientRef.current.updateConfig(nextConfig);
    setHealth(null);
    setHardware(null);
    setAgentGames([]);
    setPerformance(null);
    setPerformanceHistory([]);
    setOptimizationAnalysis(null);
    setOptimizationPreview(null);
    setConnectionState('disconnected');
    setConnectionMessageAr('تم إيقاف وضع العرض التجريبي. غير متصل بالوكيل المحلي.');
    showNotice('info', 'تم الخروج من وضع العرض التجريبي. يمكنك الآن ربط الوكيل المحلي من الإعدادات.');
  }, [config, showNotice]);

  const scanDevice = useCallback(async () => {
    if (!config.demoMode && connectionState !== 'connected') {
      await connectAndFetchAll();
      return;
    }
    setIsScanningDevice(true);
    try {
      const [healthRes, hwRes, scanRes, perfRes] = await Promise.all([
        clientRef.current.getHealth(),
        clientRef.current.getHardware(),
        clientRef.current.scanGames(),
        clientRef.current.getPerformance(),
      ]);
      setHealth(healthRes);
      setHardware(hwRes);
      setAgentGames(scanRes.games);
      setLastScannedAt(scanRes.scannedAt);
      setLastScanLocations(scanRes.scannedLocations);
      setPerformance(perfRes);
      setPerformanceHistory((prev) =>
        config.demoMode ? [perfRes.sample] : [...prev.slice(-29), perfRes.sample]
      );
      setConnectionState('connected');
      recordSessionEvent({
        category: 'scan',
        titleAr: 'فحص شامل للجهاز والألعاب',
        detailAr: `تم رصد ${scanRes.gamesFound} لعبة مثبتة (${hwRes.cpu.model ?? 'غير متوفر'}).`,
        outcome: 'success',
      });
      showNotice(
        'success',
        `اكتمل فحص الجهاز بنجاح. تم رصد ${scanRes.gamesFound} لعبة مثبتة.`
      );
    } catch (err) {
      handleAgentError(err);
    } finally {
      setIsScanningDevice(false);
    }
  }, [config.demoMode, connectionState, connectAndFetchAll, handleAgentError, recordSessionEvent, showNotice]);

  const scanInstalledGames = useCallback(async () => {
    if (!config.demoMode && connectionState !== 'connected') {
      showNotice(
        'warning',
        'الوكيل المحلي غير متصل. لا يمكن للمتصفح فحص مجلدات ويندوز مباشرة دون تشغيل الوكيل المحلي أو تفعيل الوضع التجريبي.'
      );
      return;
    }
    setIsScanningGames(true);
    try {
      const scanRes = await clientRef.current.scanGames(customFolders);
      setAgentGames(scanRes.games);
      setLastScannedAt(scanRes.scannedAt);
      setLastScanLocations(scanRes.scannedLocations);
      recordSessionEvent({
        category: 'scan',
        titleAr: 'مسح مكتبة الألعاب المثبتة',
        detailAr: `تم العثور على ${scanRes.gamesFound} لعبة في مسارات النظام.`,
        outcome: 'success',
      });
      showNotice('success', `تم فحص الأقراص المحلية والعثور على ${scanRes.gamesFound} لعبة مثبتة.`);
    } catch (err) {
      handleAgentError(err);
    } finally {
      setIsScanningGames(false);
    }
  }, [config.demoMode, connectionState, customFolders, handleAgentError, recordSessionEvent, showNotice]);

  const refreshPerformance = useCallback(async () => {
    if (!config.demoMode && connectionState !== 'connected') {
      return;
    }
    try {
      const snap = await clientRef.current.getPerformance();
      setPerformance(snap);
      setPerformanceHistory((prev) => [...prev.slice(-29), snap.sample]);
    } catch (err) {
      handleAgentError(err);
    }
  }, [config.demoMode, connectionState, handleAgentError]);

  const runOptimizationAnalysis = useCallback(
    async (gameId: string | null) => {
      if (!config.demoMode && connectionState !== 'connected') {
        showNotice(
          'warning',
          'يلزم الاتصال بالوكيل المحلي (أو تفعيل الوضع التجريبي) لتحليل العتاد واقتراح الإعدادات.'
        );
        return;
      }
      setIsAnalyzingOptimization(true);
      setOptimizationPreview(null);
      try {
        const result = await clientRef.current.analyzeOptimization(gameId);
        setOptimizationAnalysis(result);
        setSelectedGameForOptimization(gameId);
      } catch (err) {
        handleAgentError(err);
      } finally {
        setIsAnalyzingOptimization(false);
      }
    },
    [config.demoMode, connectionState, handleAgentError, showNotice]
  );

  const requestOptimizationPreview = useCallback(
    async (
      gameId: string | null,
      tweakIds: string[]
    ): Promise<OptimizationPreviewResponse | null> => {
      if (!config.demoMode && connectionState !== 'connected') {
        showNotice('warning', 'يلزم الاتصال بالوكيل المحلي لمعاينة التعديلات.');
        return null;
      }
      try {
        const prev = await clientRef.current.previewOptimization(gameId, tweakIds);
        setOptimizationPreview(prev);
        return prev;
      } catch (err) {
        handleAgentError(err);
        return null;
      }
    },
    [config.demoMode, connectionState, handleAgentError, showNotice]
  );

  const confirmAndApplyOptimization = useCallback(
    async (
      previewId: string,
      tweakIds: string[],
      gameId: string | null
    ): Promise<boolean> => {
      setIsApplyingOptimization(true);
      try {
        const res = await clientRef.current.applyOptimization({
          previewId,
          tweakIds,
          targetGameId: gameId,
          explicitUserConfirmation: true,
        });
        setLastBackupSnapshotId(res.backupSnapshotId);
        setOptimizationPreview(null);
        const [hwRes, gamesRes, analysisRes] = await Promise.all([
          clientRef.current.getHardware(),
          clientRef.current.getGames(),
          clientRef.current.analyzeOptimization(gameId),
        ]);
        setHardware(hwRes);
        setAgentGames(gamesRes);
        setOptimizationAnalysis(analysisRes);
        recordSessionEvent({
          category: 'optimization_apply',
          titleAr: 'تطبيق تحسينات ويندوز الآمنة',
          detailAr: `تم تطبيق ${tweakIds.length} تعديل بعد أخذ نسخة احتياطية (${res.backupSnapshotId}).`,
          outcome: 'success',
        });
        showNotice('success', res.messageAr);
        return true;
      } catch (err) {
        handleAgentError(err);
        return false;
      } finally {
        setIsApplyingOptimization(false);
      }
    },
    [handleAgentError, recordSessionEvent, showNotice]
  );

  const restoreDefaultSettings = useCallback(async () => {
    if (!config.demoMode && connectionState !== 'connected') {
      showNotice('warning', 'يلزم الاتصال بالوكيل المحلي لاستعادة الإعدادات الافتراضية.');
      return;
    }
    setIsApplyingOptimization(true);
    try {
      const res = await clientRef.current.restoreOptimization();
      setLastBackupSnapshotId(null);
      const [hwRes, gamesRes, analysisRes] = await Promise.all([
        clientRef.current.getHardware(),
        clientRef.current.getGames(),
        clientRef.current.analyzeOptimization(selectedGameForOptimization),
      ]);
      setHardware(hwRes);
      setAgentGames(gamesRes);
      setOptimizationAnalysis(analysisRes);
      recordSessionEvent({
        category: 'optimization_restore',
        titleAr: 'استعادة إعدادات ويندوز الافتراضية',
        detailAr: res.messageAr,
        outcome: 'info',
      });
      showNotice('info', res.messageAr);
    } catch (err) {
      handleAgentError(err);
    } finally {
      setIsApplyingOptimization(false);
    }
  }, [
    config.demoMode,
    connectionState,
    handleAgentError,
    recordSessionEvent,
    selectedGameForOptimization,
    showNotice,
  ]);

  const addRemoteGpuProfile = useCallback(
    (profile: Omit<RemoteWindowsGpuProfile, 'id'>) => {
      const newProfile: RemoteWindowsGpuProfile = {
        ...profile,
        id: `remote_${Date.now()}`,
      };
      setRemoteGpuProfiles((prev) => [...prev, newProfile]);
      showNotice('success', `تم حفظ ملف الخادم البعيد "${profile.label}".`);
    },
    [showNotice]
  );

  const removeRemoteGpuProfile = useCallback(
    (id: string) => {
      setRemoteGpuProfiles((prev) => prev.filter((p) => p.id !== id));
      showNotice('info', 'تم حذف ملف الخادم البعيد من القائمة.');
    },
    [showNotice]
  );

  const registerManualGame = useCallback(
    (input: ManualGameRegistrationInput): boolean => {
      const title = input.title.trim();
      if (!title) {
        showNotice('warning', 'يرجى إدخال اسم اللعبة.');
        return false;
      }
      const pathCheck = validateGameExecutablePath(input.executablePath);
      if (!pathCheck.valid) {
        showNotice('warning', pathCheck.reasonAr ?? 'مسار الملف التنفيذي غير صالح.');
        return false;
      }

      const vramMb = input.vramRequirementMb ?? 0;
      const compatibility: InstalledGame['compatibility'] =
        input.vramRequirementMb === undefined ? 'unknown' : vramMb <= 1400 ? 'good' : vramMb <= 2048 ? 'limited' : 'not_recommended';

      const newGame: InstalledGame = {
        id: `manual_${Date.now()}`,
        title,
        version: null,
        coverImageUrl: null,
        executableName: pathCheck.executableName,
        executablePath: pathCheck.normalized,
        installPath: pathCheck.installPath,
        detectedGpu: input.detectedGpu || 'NVIDIA GeForce MX250 (2GB)',
        launcher: input.launcher,
        sizeGb: input.sizeGb ?? 0,
        lastPlayed: null,
        compatibility,
        estimatedFpsRange: 'غير متوفر قبل التحليل الذكي',
        recommendedResolution: '1280×720',
        vramRequirementMb: vramMb,
        isOptimizedProfileActive: false,
        isManualEntry: true,
        isInstalled: true,
        isFavorite: false,
        safetyNoteAr:
          'تم تسجيل اللعبة يدوياً محلياً. لن يقوم التطبيق بتعديل ملفات EXE أو DLL أو CFG أو INI داخل مسار اللعبة.',
      };

      setManualGames((prev) => [newGame, ...prev]);

      if (!config.demoMode && connectionState === 'connected') {
        void clientRef.current
          .registerManualGameOnAgent({
            title,
            executablePath: pathCheck.normalized,
            launcher: input.launcher,
            detectedGpu: input.detectedGpu,
            sizeGb: input.sizeGb,
            vramRequirementMb: input.vramRequirementMb,
          })
          .then((savedGame) => {
            setAgentGames((prev) => [savedGame, ...prev.filter((g) => g.id !== savedGame.id)]);
          })
          .catch(() => {
            // Keep local manual registration if agent call fails
          });
      }

      showNotice('success', `تم تسجيل اللعبة "${title}" في قائمة ألعابك المثبتة.`);
      return true;
    },
    [config.demoMode, connectionState, showNotice]
  );

  const updateManualGame = useCallback(
    (gameId: string, input: ManualGameRegistrationInput): boolean => {
      const title = input.title.trim();
      if (!title) {
        showNotice('warning', 'يرجى إدخال اسم اللعبة.');
        return false;
      }
      const pathCheck = validateGameExecutablePath(input.executablePath);
      if (!pathCheck.valid) {
        showNotice('warning', pathCheck.reasonAr ?? 'مسار الملف التنفيذي غير صالح.');
        return false;
      }

      const vramMb = input.vramRequirementMb ?? 0;
      const compatibility: InstalledGame['compatibility'] =
        input.vramRequirementMb === undefined
          ? 'unknown'
          : vramMb <= 1400
          ? 'good'
          : vramMb <= 2048
          ? 'limited'
          : 'not_recommended';

      const applyPatch = (list: InstalledGame[]) =>
        list.map((g) =>
          g.id === gameId
            ? {
                ...g,
                title,
                executableName: pathCheck.executableName,
                executablePath: pathCheck.normalized,
                installPath: pathCheck.installPath,
                launcher: input.launcher,
                detectedGpu: input.detectedGpu || g.detectedGpu,
                sizeGb: input.sizeGb ?? g.sizeGb,
                vramRequirementMb: vramMb,
                compatibility,
                isManualEntry: true,
              }
            : g
        );

      setManualGames(applyPatch);
      setAgentGames(applyPatch);

      if (!config.demoMode && connectionState === 'connected') {
        void clientRef.current
          .updateManualGameOnAgent(gameId, {
            title,
            executablePath: pathCheck.normalized,
            launcher: input.launcher,
            detectedGpu: input.detectedGpu,
            sizeGb: input.sizeGb,
            vramRequirementMb: input.vramRequirementMb,
          })
          .then((saved) => {
            setAgentGames((prev) => prev.map((g) => (g.id === saved.id ? saved : g)));
          })
          .catch((err) => {
            handleAgentError(err);
          });
      }

      showNotice('success', `تم تحديث بيانات "${title}" وحفظها محلياً.`);
      return true;
    },
    [config.demoMode, connectionState, handleAgentError, showNotice]
  );

  const removeManualGame = useCallback(
    (gameId: string) => {
      setManualGames((prev) => prev.filter((g) => g.id !== gameId));
      setAgentGames((prev) => prev.filter((g) => g.id !== gameId));
      setFavoriteIds((prev) => prev.filter((id) => id !== gameId));
      if (!config.demoMode && connectionState === 'connected') {
        void clientRef.current.deleteManualGameOnAgent(gameId).catch(() => {});
      }
      showNotice('info', 'تمت إزالة اللعبة من القائمة المحلية.');
    },
    [config.demoMode, connectionState, showNotice]
  );

  const toggleFavorite = useCallback(
    (gameId: string) => {
      const currentlyFav =
        favoriteIds.includes(gameId) ||
        Boolean(games.find((g) => g.id === gameId)?.isFavorite);
      const nextFav = !currentlyFav;

      setFavoriteIds((prev) =>
        nextFav ? Array.from(new Set([...prev, gameId])) : prev.filter((id) => id !== gameId)
      );
      setManualGames((prev) =>
        prev.map((g) => (g.id === gameId ? { ...g, isFavorite: nextFav } : g))
      );
      setAgentGames((prev) =>
        prev.map((g) => (g.id === gameId ? { ...g, isFavorite: nextFav } : g))
      );

      if (!config.demoMode && connectionState === 'connected') {
        void clientRef.current.toggleFavoriteOnAgent(gameId, nextFav).catch(() => {});
      }
    },
    [config.demoMode, connectionState, favoriteIds, games]
  );

  const addCustomGameFolder = useCallback(
    async (folderPath: string): Promise<boolean> => {
      const trimmed = folderPath.trim().replace(/^"|"$/g, '');
      const validDir = /^[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\?)*$/.test(trimmed);
      if (!validDir) {
        showNotice('warning', 'يرجى إدخال مسار مجلد ويندوز صحيح (مثال: D:\\Games).');
        return false;
      }

      if (!config.demoMode && connectionState === 'connected') {
        try {
          const updated = await clientRef.current.addCustomFolder(trimmed);
          setCustomFolders(updated);
          showNotice('success', `تم حفظ مجلد الألعاب "${trimmed}" للفحص التلقائي.`);
          return true;
        } catch (err) {
          handleAgentError(err);
          return false;
        }
      }

      setCustomFolders((prev) =>
        prev.some((f) => f.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
      );
      showNotice('success', `تمت إضافة المجلد "${trimmed}" إلى قائمة الفحص.`);
      return true;
    },
    [config.demoMode, connectionState, handleAgentError, showNotice]
  );

  const removeCustomGameFolder = useCallback(
    async (folderPath: string): Promise<void> => {
      if (!config.demoMode && connectionState === 'connected') {
        try {
          const updated = await clientRef.current.removeCustomFolder(folderPath);
          setCustomFolders(updated);
          showNotice('info', 'تمت إزالة المجلد من مسارات الفحص.');
          return;
        } catch (err) {
          handleAgentError(err);
          return;
        }
      }

      setCustomFolders((prev) =>
        prev.filter((f) => f.toLowerCase() !== folderPath.toLowerCase())
      );
      showNotice('info', 'تمت إزالة المجلد من القائمة.');
    },
    [config.demoMode, connectionState, handleAgentError, showNotice]
  );

  const browseAgentFileSystem = useCallback(
    async (path?: string): Promise<FileSystemBrowseResponse> => {
      return clientRef.current.browseFileSystem(path);
    },
    []
  );

  const analyzeGameDetails = useCallback(
    async (gameId: string) => {
      if (!config.demoMode && connectionState !== 'connected') {
        showNotice(
          'warning',
          'يلزم الاتصال بالوكيل المحلي (أو تفعيل الوضع التجريبي) لإجراء التحليل الذكي للعبة.'
        );
        return;
      }
      setIsAnalyzingGameDetails(true);
      try {
        const fallbackGame = games.find((g) => g.id === gameId) ?? null;
        const result = await clientRef.current.analyzeGameSmart(
          gameId,
          fallbackGame,
          hardware,
          performance
        );
        setSmartGameAnalysis(result);
      } catch (err) {
        handleAgentError(err);
      } finally {
        setIsAnalyzingGameDetails(false);
      }
    },
    [config.demoMode, connectionState, games, hardware, performance, handleAgentError, showNotice]
  );

  const openGameDetails = useCallback(
    (gameId: string) => {
      setSelectedGameDetailsId(gameId);
      setLaunchStatus(null);
      setActiveSection('games');
      void analyzeGameDetails(gameId);
    },
    [analyzeGameDetails]
  );

  const closeGameDetails = useCallback(() => {
    setSelectedGameDetailsId(null);
    setSmartGameAnalysis(null);
    setLaunchStatus(null);
  }, []);

  const launchGame = useCallback(
    async (gameId: string, mode: 'local' | 'cloud'): Promise<GameLaunchResponse | null> => {
      setIsLaunchingGame(true);
      setLaunchingGameId(gameId);
      try {
        const fallbackGame = games.find((g) => g.id === gameId) ?? null;
        const res = await clientRef.current.launchGameSafely(
          gameId,
          { mode, applyPendingOptimization: false },
          fallbackGame
        );
        setLaunchStatus(res);
        if (res.launched && res.lastPlayed) {
          const lp = res.lastPlayed;
          setManualGames((prev) =>
            prev.map((g) => (g.id === gameId ? { ...g, lastPlayed: lp } : g))
          );
          setAgentGames((prev) =>
            prev.map((g) => (g.id === gameId ? { ...g, lastPlayed: lp } : g))
          );
        }
        recordSessionEvent({
          category: 'launch',
          titleAr: `تشغيل ${fallbackGame?.title ?? gameId}`,
          detailAr: res.messageAr,
          outcome: res.launched ? 'success' : 'info',
        });
        showNotice(res.launched ? 'success' : 'info', res.messageAr);
        return res;
      } catch (err) {
        handleAgentError(err);
        return null;
      } finally {
        setIsLaunchingGame(false);
        setLaunchingGameId(null);
      }
    },
    [games, handleAgentError, recordSessionEvent, showNotice]
  );

  const toggleBackgroundPid = useCallback((pid: number) => {
    setSelectedBackgroundPids((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  }, []);

  const restartDesktopAgent = useCallback(async () => {
    const bridge = typeof window !== 'undefined' ? window.gbpDesktop : undefined;
    if (!bridge?.isDesktopApp) return;

    try {
      const status = await bridge.restartAgent();
      setDesktopAgentStatus(status);
      if (status.state === 'running') {
        const creds = await bridge.getAgentConnectionCredentials();
        const nextConfig: AgentConnectionConfig = {
          baseUrl: creds.baseUrl,
          authToken: creds.authToken,
          demoMode: false,
        };
        setConfig(nextConfig);
        await connectAndFetchAll(nextConfig);
        showNotice('success', 'تمت إعادة تشغيل الوكيل المحلي والاتصال بنجاح.');
      } else {
        showNotice('warning', status.messageAr);
      }
    } catch {
      showNotice('error', 'تعذرت إعادة تشغيل الوكيل المحلي تلقائياً.');
    }
  }, [connectAndFetchAll, showNotice]);

  const updateDesktopPreferences = useCallback(
    async (partial: Partial<DesktopPreferences>) => {
      const bridge = typeof window !== 'undefined' ? window.gbpDesktop : undefined;
      if (!bridge?.isDesktopApp) return;
      try {
        const updated = await bridge.updatePreferences(partial);
        setDesktopPreferences(updated);
        showNotice('success', 'تم حفظ تفضيلات تطبيق سطح المكتب بنجاح.');
      } catch {
        showNotice('error', 'تعذر حفظ تفضيلات تطبيق سطح المكتب.');
      }
    },
    [showNotice]
  );

  // Clear game details sub-view if navigating away from 'games'
  useEffect(() => {
    if (activeSection !== 'games' && selectedGameDetailsId !== null) {
      setSelectedGameDetailsId(null);
      setLaunchStatus(null);
    }
  }, [activeSection, selectedGameDetailsId]);

  // Initial load: connect to desktop bridge supervisor or persisted Demo Mode
  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.gbpDesktop : undefined;
    if (bridge?.isDesktopApp) {
      let unsubscribe: (() => void) | undefined;

      void (async () => {
        try {
          const [status, prefs, history, creds] = await Promise.all([
            bridge.getAgentStatus(),
            bridge.getPreferences(),
            bridge.getSessionHistory(),
            bridge.getAgentConnectionCredentials(),
          ]);
          setDesktopAgentStatus(status);
          setDesktopPreferences(prefs);
          setSessionHistory(history);

          const desktopConfig: AgentConnectionConfig = {
            baseUrl: creds.baseUrl,
            authToken: creds.authToken,
            demoMode: false,
          };
          setConfig(desktopConfig);

          if (status.state === 'running') {
            await connectAndFetchAll(desktopConfig);
          } else {
            setConnectionState('disconnected');
            setConnectionMessageAr(status.messageAr);
          }
        } catch {
          // fallback safely
        }
      })();

      unsubscribe = bridge.onAgentStatusChange((nextStatus) => {
        setDesktopAgentStatus(nextStatus);
        if (nextStatus.state === 'crashed' || nextStatus.state === 'restarting') {
          setConnectionState('error');
          setConnectionMessageAr(nextStatus.messageAr);
        } else if (nextStatus.state === 'missing_binary') {
          setConnectionState('disconnected');
          setConnectionMessageAr(nextStatus.messageAr);
        } else if (nextStatus.state === 'running') {
          void bridge.getAgentConnectionCredentials().then((creds) => {
            const nextConfig: AgentConnectionConfig = {
              baseUrl: creds.baseUrl,
              authToken: creds.authToken,
              demoMode: false,
            };
            setConfig(nextConfig);
            void connectAndFetchAll(nextConfig);
          });
        }
      });

      return () => {
        unsubscribe?.();
      };
    }

    if (config.demoMode) {
      void connectAndFetchAll(config);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll performance metrics ONLY when connected to a real Local Agent (never fabricate live polls in Demo Mode)
  useEffect(() => {
    if (
      config.demoMode ||
      connectionState !== 'connected' ||
      settings.pollIntervalMs === 0
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshPerformance();
    }, settings.pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [config.demoMode, connectionState, settings.pollIntervalMs, refreshPerformance]);

  const value = useMemo<AgentContextValue>(
    () => ({
      activeSection,
      setActiveSection,
      connectionState,
      connectionMessageAr,
      config,
      updateConfig,
      settings,
      updateSettings,
      health,
      hardware,
      games,
      lastScannedAt,
      lastScanLocations,
      performance,
      performanceHistory,
      selectedGameForOptimization,
      setSelectedGameForOptimization,
      optimizationAnalysis,
      optimizationPreview,
      setOptimizationPreview,
      lastBackupSnapshotId,
      remoteGpuProfiles,
      addRemoteGpuProfile,
      removeRemoteGpuProfile,
      registerManualGame,
      updateManualGame,
      removeManualGame,
      toggleFavorite,
      customFolders,
      addCustomGameFolder,
      removeCustomGameFolder,
      browseAgentFileSystem,
      isScanningDevice,
      isScanningGames,
      isAnalyzingOptimization,
      isApplyingOptimization,
      selectedGameDetailsId,
      openGameDetails,
      closeGameDetails,
      smartGameAnalysis,
      isAnalyzingGameDetails,
      analyzeGameDetails,
      launchStatus,
      isLaunchingGame,
      launchingGameId,
      launchGame,
      selectedBackgroundPids,
      toggleBackgroundPid,
      notice,
      clearNotice,
      showNotice,
      isDesktopApp,
      desktopAgentStatus,
      restartDesktopAgent,
      desktopPreferences,
      updateDesktopPreferences,
      sessionHistory,
      connectAndFetchAll,
      enableDemoMode,
      disableDemoMode,
      scanDevice,
      scanInstalledGames,
      refreshPerformance,
      runOptimizationAnalysis,
      requestOptimizationPreview,
      confirmAndApplyOptimization,
      restoreDefaultSettings,
    }),
    [
      activeSection,
      connectionState,
      connectionMessageAr,
      config,
      updateConfig,
      settings,
      updateSettings,
      health,
      hardware,
      games,
      lastScannedAt,
      lastScanLocations,
      performance,
      performanceHistory,
      selectedGameForOptimization,
      optimizationAnalysis,
      optimizationPreview,
      lastBackupSnapshotId,
      remoteGpuProfiles,
      addRemoteGpuProfile,
      removeRemoteGpuProfile,
      registerManualGame,
      updateManualGame,
      removeManualGame,
      toggleFavorite,
      customFolders,
      addCustomGameFolder,
      removeCustomGameFolder,
      browseAgentFileSystem,
      isScanningDevice,
      isScanningGames,
      isAnalyzingOptimization,
      isApplyingOptimization,
      selectedGameDetailsId,
      openGameDetails,
      closeGameDetails,
      smartGameAnalysis,
      isAnalyzingGameDetails,
      analyzeGameDetails,
      launchStatus,
      isLaunchingGame,
      launchingGameId,
      launchGame,
      selectedBackgroundPids,
      toggleBackgroundPid,
      notice,
      clearNotice,
      showNotice,
      isDesktopApp,
      desktopAgentStatus,
      restartDesktopAgent,
      desktopPreferences,
      updateDesktopPreferences,
      sessionHistory,
      connectAndFetchAll,
      enableDemoMode,
      disableDemoMode,
      scanDevice,
      scanInstalledGames,
      refreshPerformance,
      runOptimizationAnalysis,
      requestOptimizationPreview,
      confirmAndApplyOptimization,
      restoreDefaultSettings,
    ]
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
};

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return ctx;
}
