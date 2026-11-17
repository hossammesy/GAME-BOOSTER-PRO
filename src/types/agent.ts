export type ConnectionState =
  | 'connected'
  | 'disconnected'
  | 'permission_required'
  | 'error';

export type NavSection =
  | 'dashboard'
  | 'games'
  | 'optimization'
  | 'cloud'
  | 'performance'
  | 'settings';

export type ThemeMode = 'dark' | 'light';

export type NetworkTier = 'low_under_10' | 'medium_10_30' | 'high_over_30';

export interface AgentHealthResponse {
  status: 'ok' | 'degraded';
  agentVersion: string;
  os: string;
  elevation: 'standard_user' | 'administrator';
  uptimeSeconds: number;
  originValidated: boolean;
  securityServicesProtected: boolean;
  timestamp: string;
}

export interface StorageDriveInfo {
  name: string;
  driveFormat: string;
  type: string;
  freeSpaceGb: number;
  totalSpaceGb: number;
}

export interface HardwareProfile {
  deviceName: string;
  osName: string;
  osBuild: string;
  powerSource: string;
  activePowerPlan: string;
  cpu: {
    model: string | null;
    cores: number | null;
    threads: number | null;
    baseClockGhz: number | null;
    boostClockGhz: number | null;
    status?: string;
  };
  memory: {
    totalGb: number | null;
    availableGb?: number | null;
    speedMhz: number | null;
    channelMode: 'Dual Channel' | 'Single Channel' | string | null;
    status?: string;
  };
  gpu: {
    primaryModel: string | null;
    integratedModel: string | null;
    vramTotalMb: number | null;
    driverVersion: string | null;
    status?: string;
  };
  storage: {
    type: string;
    freeSpaceGb: number;
    totalSpaceGb: number;
    drives?: StorageDriveInfo[];
  };
  network: {
    adapterType: string;
    estimatedBandwidthMbps: number | null;
    latencyMs: number | null;
    status?: string;
  };
  gamingReadiness: {
    tier: 'esports_and_light' | 'medium_720p' | 'cloud_recommended';
    summaryAr: string;
    bottleneckNoteAr: string;
    vramLimitWarning: boolean;
  };
}

export type GameLauncher =
  | 'Steam'
  | 'Epic Games'
  | 'Xbox App'
  | 'Riot Client'
  | 'Standalone';

export type GameCompatibility =
  | 'optimal'
  | 'needs_tuning'
  | 'heavy_for_vram'
  | 'excellent'
  | 'good'
  | 'limited'
  | 'not_recommended'
  | 'unknown';

export type SmartCompatibilityTier =
  | 'excellent'
  | 'good'
  | 'limited'
  | 'not_recommended'
  | 'unknown';

export interface GameRequirementsMetadata {
  status: 'verified_metadata' | 'unknown';
  sourceLabelAr: string;
  minCpuAr: string | null;
  recCpuAr: string | null;
  minRamGb: number | null;
  recRamGb: number | null;
  minVramMb: number | null;
  recVramMb: number | null;
  minStorageGb: number | null;
  directXVersion: string | null;
}

export interface GraphicsSettingRecommendation {
  settingKey:
    | 'resolution'
    | 'textures'
    | 'shadows'
    | 'anti_aliasing'
    | 'effects'
    | 'view_distance'
    | 'vsync'
    | 'fps_target';
  settingNameAr: string;
  recommendedValueAr: string;
  basis: 'verified_profile' | 'hardware_estimate' | 'unknown';
  basisLabelAr: string;
  reasonAr: string;
}

export interface SmartGameAnalysisResponse {
  gameId: string;
  gameTitle: string;
  version: string | null;
  executablePath: string;
  launcher: string;
  coverImageUrl: string | null;
  analyzedAt: string;
  compatibility: SmartCompatibilityTier;
  compatibilityLabelAr: string;
  compatibilityExplanationAr: string;
  hardwareChecks: {
    cpuStatusAr: string;
    ramStatusAr: string;
    gpuAndVramStatusAr: string;
    storageStatusAr: string;
    driverStatusAr: string;
    systemLoadNoteAr: string;
  };
  requirements: GameRequirementsMetadata;
  evidenceBasedFpsRangeAr: string | null;
  fpsRangeSupported: boolean;
  graphicsRecommendations: GraphicsSettingRecommendation[];
  cloudAssessment: {
    recommendedInCloud: boolean;
    internetRequirementAr: string;
    latencyRequirementAr: string;
    costNoteAr: string;
    providerSupportNoteAr: string;
    isCloudHardwareConnected: boolean;
  };
  safeOptimizationSummaryAr: string;
}

export interface GameLaunchRequest {
  mode: 'local' | 'cloud';
  applyPendingOptimization?: boolean;
}

export interface GameLaunchResponse {
  launched: boolean;
  status: 'launched' | 'agent_required' | 'blocked_safety' | 'executable_not_found' | 'failed';
  mode: 'local' | 'cloud';
  pid: number | null;
  messageAr: string;
  timestamp: string;
  lastPlayed?: string | null;
}

export interface InstalledGame {
  id: string;
  title: string;
  version?: string | null;
  coverImageUrl?: string | null;
  executableName: string;
  executablePath: string;
  installPath: string;
  detectedGpu: string;
  launcher: GameLauncher;
  sizeGb: number;
  lastPlayed: string | null;
  compatibility: GameCompatibility;
  estimatedFpsRange: string;
  recommendedResolution: string;
  vramRequirementMb: number;
  isOptimizedProfileActive: boolean;
  isManualEntry?: boolean;
  isInstalled?: boolean;
  isFavorite?: boolean;
  launchUri?: string | null;
  safetyNoteAr: string;
}

export type GameSortOption =
  | 'favorites_first'
  | 'title_asc'
  | 'launcher'
  | 'compatibility'
  | 'last_played'
  | 'size_desc';

export interface FileSystemEntryItem {
  name: string;
  fullPath: string;
  entryType: 'drive' | 'directory' | 'exe';
  sizeBytes: number | null;
}

export interface FileSystemBrowseResponse {
  currentPath: string | null;
  parentPath: string | null;
  entries: FileSystemEntryItem[];
}

export interface ManualGameRegistrationInput {
  title: string;
  executablePath: string;
  launcher: GameLauncher;
  detectedGpu: string;
  sizeGb?: number;
  vramRequirementMb?: number;
}

export interface GameScanResponse {
  scannedAt: string;
  scannedLocations: string[];
  gamesFound: number;
  games: InstalledGame[];
}

export interface PerformanceSample {
  timestamp: string;
  cpuUsagePercent: number | null;
  cpuClockGhz: number | null;
  cpuTempCelsius: number | null;
  ramUsedGb: number | null;
  ramTotalGb: number | null;
  gpuUsagePercent: number | null;
  vramUsedMb: number | null;
  vramTotalMb: number | null;
  gpuTempCelsius: number | null;
  activeGameProcess: string | null;
  fps: number | null;
  frameTimeMs: number | null;
  isStaticDemoSnapshot?: boolean;
}

export interface ProcessMetric {
  pid: number;
  name: string;
  category: 'game' | 'system' | 'background_safe_to_pause' | 'security_protected';
  cpuPercent: number;
  ramMb: number;
  canSafelyPause: boolean;
}

export interface PerformanceSnapshotResponse {
  sample: PerformanceSample;
  sensorsAvailable: {
    cpuUsage: boolean;
    ramUsage: boolean;
    gpuUsage: boolean;
    vramUsage: boolean;
    cpuTemp: boolean;
    gpuTemp: boolean;
    fpsHook: boolean;
  };
  topProcesses: ProcessMetric[];
}

export type OptimizationRiskLevel = 'none' | 'low';

export interface SystemTweakItem {
  id: string;
  titleAr: string;
  descriptionAr: string;
  scope: 'power_plan' | 'windows_gpu_preference' | 'game_mode' | 'background_apps';
  currentValueAr: string;
  recommendedValueAr: string;
  expectedImpactAr: string;
  riskLevel: OptimizationRiskLevel;
  riskNoteAr: string;
  reversible: true;
  modifiesGameFiles: false;
  affectsSecurityServices: false;
  selectedByDefault: boolean;
}

export interface AdvisoryGameSetting {
  settingNameAr: string;
  currentOrDefaultAr: string;
  recommendedForHardwareAr: string;
  vramImpactAr: string;
  riskNoteAr: string;
}

export interface OptimizationAnalysisResponse {
  analyzedAt: string;
  targetGameId: string | null;
  targetGameTitle: string | null;
  hardwareSummaryAr: string;
  systemTweaks: SystemTweakItem[];
  advisoryInGameSettings: AdvisoryGameSetting[];
  protectedServicesNoticeAr: string;
}

export interface OptimizationChangeDiff {
  tweakId: string;
  titleAr: string;
  beforeValueAr: string;
  afterValueAr: string;
  registryOrApiTarget: string;
  isReversible: boolean;
}

export interface OptimizationPreviewResponse {
  previewId: string;
  generatedAt: string;
  changes: OptimizationChangeDiff[];
  backupSnapshotId: string;
  safetyChecks: {
    originalGameFilesUntouched: boolean;
    windowsSecurityUntouched: boolean;
    userConfirmationRequired: boolean;
  };
}

export interface OptimizationApplyRequest {
  previewId: string;
  tweakIds: string[];
  targetGameId: string | null;
  explicitUserConfirmation: boolean;
}

export interface OptimizationApplyResponse {
  appliedAt: string;
  backupSnapshotId: string;
  appliedCount: number;
  status: 'applied';
  messageAr: string;
}

export interface OptimizationRestoreResponse {
  restoredAt: string;
  restoredFromSnapshotId: string | null;
  status: 'restored';
  messageAr: string;
}

export interface CloudProviderIntegration {
  id: 'geforce_now' | 'xbox_cloud' | 'boosteroid';
  name: string;
  officialUrl: string;
  minBandwidthMbps: number;
  recommendedBandwidthMbps: number;
  supportsBrowserOrDesktop: string;
  integrationStatusAr: string;
  suitabilityNoteAr: string;
}

export interface RemoteWindowsGpuProfile {
  id: string;
  label: string;
  protocol: 'Moonlight / Sunshine' | 'Parsec';
  hostAddress: string;
  port: number;
  targetBitrateMbps: number;
  targetResolution: '1280x720@60' | '1920x1080@60' | '1920x1080@30';
  notes: string;
}

export interface AgentConnectionConfig {
  baseUrl: string;
  authToken: string;
  demoMode: boolean;
}

export interface AppSettingsState {
  theme: ThemeMode;
  language: 'ar';
  networkTier: NetworkTier;
  connectionType: 'Wi-Fi 5GHz' | 'Ethernet' | 'Wi-Fi 2.4GHz';
  pollIntervalMs: 2000 | 5000 | 0;
}
