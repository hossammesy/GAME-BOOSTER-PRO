using System.Text.Json.Serialization;

namespace GameBoosterPro.Agent.Models;

public sealed record AgentHealthResponse(
    string Status,
    string AgentVersion,
    string Os,
    string Elevation,
    long UptimeSeconds,
    bool OriginValidated,
    bool SecurityServicesProtected,
    string Timestamp
);

public sealed record CpuHardwareInfo(
    string? Model,
    int? Cores,
    int? Threads,
    double? BaseClockGhz,
    double? BoostClockGhz,
    string Status
);

public sealed record MemoryHardwareInfo(
    double? TotalGb,
    double? AvailableGb,
    int? SpeedMhz,
    string? ChannelMode,
    string Status
);

public sealed record GpuHardwareInfo(
    string? PrimaryModel,
    string? IntegratedModel,
    int? VramTotalMb,
    string? DriverVersion,
    string Status
);

public sealed record StorageDriveInfo(
    string Name,
    string DriveFormat,
    string Type,
    double FreeSpaceGb,
    double TotalSpaceGb
);

public sealed record StorageHardwareInfo(
    string Type,
    double FreeSpaceGb,
    double TotalSpaceGb,
    IReadOnlyList<StorageDriveInfo> Drives
);

public sealed record NetworkHardwareInfo(
    string AdapterType,
    double? EstimatedBandwidthMbps,
    int? LatencyMs,
    string Status
);

public sealed record GamingReadinessInfo(
    string Tier,
    string SummaryAr,
    string BottleneckNoteAr,
    bool VramLimitWarning
);

public sealed record HardwareProfile(
    string DeviceName,
    string OsName,
    string OsBuild,
    string PowerSource,
    string ActivePowerPlan,
    CpuHardwareInfo Cpu,
    MemoryHardwareInfo Memory,
    GpuHardwareInfo Gpu,
    StorageHardwareInfo Storage,
    NetworkHardwareInfo Network,
    GamingReadinessInfo GamingReadiness
);

public sealed record InstalledGame(
    string Id,
    string Title,
    string? Version,
    string? CoverImageUrl,
    string ExecutableName,
    string ExecutablePath,
    string InstallPath,
    string DetectedGpu,
    string Launcher,
    double SizeGb,
    string? LastPlayed,
    string Compatibility,
    string EstimatedFpsRange,
    string RecommendedResolution,
    int VramRequirementMb,
    bool IsOptimizedProfileActive,
    bool IsManualEntry,
    string SafetyNoteAr,
    bool IsInstalled = true,
    bool IsFavorite = false,
    string? LaunchUri = null
);

public sealed record GameRequirementsMetadata(
    string Status,
    string SourceLabelAr,
    string? MinCpuAr,
    string? RecCpuAr,
    double? MinRamGb,
    double? RecRamGb,
    int? MinVramMb,
    int? RecVramMb,
    double? MinStorageGb,
    string? DirectXVersion
);

public sealed record GraphicsSettingRecommendation(
    string SettingKey,
    string SettingNameAr,
    string RecommendedValueAr,
    string Basis,
    string BasisLabelAr,
    string ReasonAr
);

public sealed record HardwareChecksSummary(
    string CpuStatusAr,
    string RamStatusAr,
    string GpuAndVramStatusAr,
    string StorageStatusAr,
    string DriverStatusAr,
    string SystemLoadNoteAr
);

public sealed record CloudGameAssessment(
    bool RecommendedInCloud,
    string InternetRequirementAr,
    string LatencyRequirementAr,
    string CostNoteAr,
    string ProviderSupportNoteAr,
    bool IsCloudHardwareConnected
);

public sealed record SmartGameAnalysisResponse(
    string GameId,
    string GameTitle,
    string? Version,
    string ExecutablePath,
    string Launcher,
    string? CoverImageUrl,
    string AnalyzedAt,
    string Compatibility,
    string CompatibilityLabelAr,
    string CompatibilityExplanationAr,
    HardwareChecksSummary HardwareChecks,
    GameRequirementsMetadata Requirements,
    string? EvidenceBasedFpsRangeAr,
    bool FpsRangeSupported,
    IReadOnlyList<GraphicsSettingRecommendation> GraphicsRecommendations,
    CloudGameAssessment CloudAssessment,
    string SafeOptimizationSummaryAr
);

public sealed record GameLaunchRequest(
    string Mode,
    bool ApplyPendingOptimization = false,
    bool PreferLauncherUri = false
);

public sealed record GameLaunchResponse(
    bool Launched,
    string Status,
    string Mode,
    int? Pid,
    string MessageAr,
    string Timestamp,
    string? LastPlayed = null
);

public sealed record ManualGameRegistrationRequest(
    string Title,
    string ExecutablePath,
    string Launcher,
    string? DetectedGpu,
    double? SizeGb,
    int? VramRequirementMb
);

public sealed record GameScanRequest(
    IReadOnlyList<string>? CustomFolders = null
);

public sealed record CustomGameFolderRequest(
    string FolderPath
);

public sealed record FavoriteToggleRequest(
    bool IsFavorite
);

public sealed record FileSystemEntryItem(
    string Name,
    string FullPath,
    string EntryType,
    long? SizeBytes
);

public sealed record FileSystemBrowseResponse(
    string? CurrentPath,
    string? ParentPath,
    IReadOnlyList<FileSystemEntryItem> Entries
);

public sealed record GameScanResponse(
    string ScannedAt,
    IReadOnlyList<string> ScannedLocations,
    int GamesFound,
    IReadOnlyList<InstalledGame> Games
);

public sealed record PerformanceSample(
    string Timestamp,
    double? CpuUsagePercent,
    double? CpuClockGhz,
    double? CpuTempCelsius,
    double? RamUsedGb,
    double? RamTotalGb,
    double? GpuUsagePercent,
    int? VramUsedMb,
    int? VramTotalMb,
    double? GpuTempCelsius,
    string? ActiveGameProcess,
    int? Fps,
    double? FrameTimeMs
);

public sealed record SensorsAvailability(
    bool CpuUsage,
    bool RamUsage,
    bool GpuUsage,
    bool VramUsage,
    bool CpuTemp,
    bool GpuTemp,
    bool FpsHook
);

public sealed record ProcessMetric(
    int Pid,
    string Name,
    string Category,
    double CpuPercent,
    double RamMb,
    bool CanSafelyPause
);

public sealed record PerformanceSnapshotResponse(
    PerformanceSample Sample,
    SensorsAvailability SensorsAvailable,
    IReadOnlyList<ProcessMetric> TopProcesses
);

public sealed record SystemTweakItem(
    string Id,
    string TitleAr,
    string DescriptionAr,
    string Scope,
    string CurrentValueAr,
    string RecommendedValueAr,
    string ExpectedImpactAr,
    string RiskLevel,
    string RiskNoteAr,
    bool RequiresAdministrator,
    bool Reversible,
    bool ModifiesGameFiles,
    bool AffectsSecurityServices,
    bool SelectedByDefault
);

public sealed record AdvisoryGameSetting(
    string SettingNameAr,
    string CurrentOrDefaultAr,
    string RecommendedForHardwareAr,
    string VramImpactAr,
    string RiskNoteAr
);

public sealed record OptimizationAnalyzeRequest(string? TargetGameId);

public sealed record OptimizationAnalysisResponse(
    string AnalyzedAt,
    string? TargetGameId,
    string? TargetGameTitle,
    string HardwareSummaryAr,
    IReadOnlyList<SystemTweakItem> SystemTweaks,
    IReadOnlyList<AdvisoryGameSetting> AdvisoryInGameSettings,
    string ProtectedServicesNoticeAr
);

public sealed record OptimizationPreviewRequest(
    string? TargetGameId,
    IReadOnlyList<string> TweakIds
);

public sealed record OptimizationChangeDiff(
    string TweakId,
    string TitleAr,
    string BeforeValueAr,
    string AfterValueAr,
    string RegistryOrApiTarget,
    bool RequiresAdministrator,
    bool IsReversible
);

public sealed record OptimizationSafetyChecks(
    bool OriginalGameFilesUntouched,
    bool WindowsSecurityUntouched,
    bool UserConfirmationRequired
);

public sealed record OptimizationPreviewResponse(
    string PreviewId,
    string GeneratedAt,
    IReadOnlyList<OptimizationChangeDiff> Changes,
    string BackupSnapshotId,
    OptimizationSafetyChecks SafetyChecks
);

public sealed record OptimizationApplyRequest(
    string PreviewId,
    IReadOnlyList<string> TweakIds,
    string? TargetGameId,
    bool ExplicitUserConfirmation
);

public sealed record OptimizationApplyResponse(
    string AppliedAt,
    string BackupSnapshotId,
    int AppliedCount,
    string Status,
    string MessageAr
);

public sealed record OptimizationRestoreResponse(
    string RestoredAt,
    string? RestoredFromSnapshotId,
    string Status,
    string MessageAr
);

public sealed record BackupSnapshot(
    string SnapshotId,
    string CreatedAt,
    string? PreviousPowerPlanGuid,
    int? PreviousAutoGameModeEnabled,
    string? GpuPreferenceExecutablePath,
    string? PreviousGpuPreferenceValue,
    IReadOnlyList<string> AppliedTweakIds
);

public sealed record ApiErrorResponse(
    string ErrorCode,
    string MessageAr,
    string Detail
);
