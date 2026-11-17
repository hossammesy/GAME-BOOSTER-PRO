using System.Runtime.Versioning;
using System.Text.Json;
using GameBoosterPro.Agent.Configuration;
using GameBoosterPro.Agent.Models;
using GameBoosterPro.Agent.Security;
using Microsoft.Extensions.Options;
using Microsoft.Win32;

namespace GameBoosterPro.Agent.Services;

public interface IGameScannerService
{
    IReadOnlyList<InstalledGame> GetCachedOrManualGames();
    GameScanResponse ScanInstalledGames(string detectedPrimaryGpu, IReadOnlyList<string>? customFolders = null);
    (bool Success, InstalledGame? Game, string? ErrorAr) RegisterManualGame(ManualGameRegistrationRequest request, string detectedPrimaryGpu);
    (bool Success, InstalledGame? Game, string? ErrorAr) UpdateManualGame(string gameId, ManualGameRegistrationRequest request, string detectedPrimaryGpu);
    bool RemoveManualGame(string gameId);

    IReadOnlyList<string> GetCustomFolders();
    (bool Success, IReadOnlyList<string> Folders, string? ErrorAr) AddCustomFolder(string folderPath);
    IReadOnlyList<string> RemoveCustomFolder(string folderPath);

    bool SetFavorite(string gameId, bool isFavorite);
    string RecordLastPlayed(string gameId);

    (bool Success, FileSystemBrowseResponse? Response, string? ErrorAr) BrowseFileSystem(string? path);
}

internal sealed class LocalGameLibraryMetadata
{
    public HashSet<string> FavoriteIds { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, string> LastPlayedById { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

[SupportedOSPlatform("windows")]
public sealed class GameScannerService : IGameScannerService
{
    private readonly ILocalDatabaseService _db;
    private readonly IAuditLogger _auditLogger;
    private readonly ILogger<GameScannerService> _logger;

    private static readonly string[] ExcludedExeKeywords =
    [
        "unins", "setup", "crash", "redist", "vcredist", "dxsetup", "updater", "helper", "launcher", "eac", "battleye"
    ];

    private static readonly string[] KnownGamePublishers =
    [
        "Valve", "Steam", "Epic Games", "Riot Games", "Ubisoft", "Electronic Arts", "EA", "Blizzard", "Rockstar Games", "CD PROJEKT RED", "Xbox", "Bethesda", "Mojang"
    ];

    public GameScannerService(
        IOptions<AgentOptions> options,
        IAuditLogger auditLogger,
        ILogger<GameScannerService> logger,
        ILocalDatabaseService? db = null)
    {
        _auditLogger = auditLogger;
        _logger = logger;
        _db = db ?? new LocalDatabaseService(options);
    }

    public IReadOnlyList<InstalledGame> GetCachedOrManualGames()
    {
        return _db.GetAllGames().Select(RefreshInstalledFlag).ToList();
    }

    public GameScanResponse ScanInstalledGames(string detectedPrimaryGpu, IReadOnlyList<string>? customFolders = null)
    {
        var discovered = new List<InstalledGame>();
        var scannedLocations = new List<string>();

        // 1. Steam library folders & app manifests
        discovered.AddRange(ScanSteamLibraries(detectedPrimaryGpu, scannedLocations));

        // 2. Epic Games Launcher manifests
        discovered.AddRange(ScanEpicManifests(detectedPrimaryGpu, scannedLocations));

        // 3. Xbox App / Microsoft Store PC Games (.GamingRoot + XboxGames + MicrosoftGame.config)
        discovered.AddRange(ScanXboxInstallations(detectedPrimaryGpu, scannedLocations));

        // 4. Windows installed applications (Registry Uninstall keys, filtered safely)
        discovered.AddRange(ScanWindowsInstalledGameEntries(detectedPrimaryGpu, scannedLocations));

        // 5. Common + User-Selected game folders
        var allCustomFolders = _db.GetCustomFolders().ToList();
        if (customFolders is not null)
        {
            foreach (var f in customFolders)
            {
                var check = SafetyPolicyGuard.ValidateWindowsDirectoryPath(f);
                if (check.IsValid && !allCustomFolders.Contains(check.NormalizedPath, StringComparer.OrdinalIgnoreCase))
                {
                    allCustomFolders.Add(check.NormalizedPath);
                }
            }
        }

        discovered.AddRange(ScanCommonAndCustomFolders(detectedPrimaryGpu, allCustomFolders, scannedLocations));

        // 6. Desktop & Start Menu shortcuts (.lnk and .url)
        discovered.AddRange(ScanShortcuts(detectedPrimaryGpu, scannedLocations));

        var dedupedAuto = DeduplicateGames(discovered);
        _db.ReplaceAutoScannedGames(dedupedAuto);

        var merged = DeduplicateGames(_db.GetAllGames().Select(RefreshInstalledFlag));

        _ = _auditLogger.LogOperationAsync("games_scan", "completed", new
        {
            locationsCount = scannedLocations.Count,
            discoveredCount = merged.Count
        });

        return new GameScanResponse(
            ScannedAt: DateTimeOffset.UtcNow.ToString("O"),
            ScannedLocations: scannedLocations.Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            GamesFound: merged.Count,
            Games: merged
        );
    }

    public (bool Success, InstalledGame? Game, string? ErrorAr) RegisterManualGame(
        ManualGameRegistrationRequest request,
        string detectedPrimaryGpu)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return (false, null, "اسم اللعبة مطلوب.");
        }

        var pathCheck = SafetyPolicyGuard.ValidateWindowsExecutablePath(request.ExecutablePath);
        if (!pathCheck.IsValid)
        {
            return (false, null, pathCheck.ErrorAr);
        }

        var exeName = Path.GetFileName(pathCheck.NormalizedPath);
        var installDir = Path.GetDirectoryName(pathCheck.NormalizedPath) ?? string.Empty;
        var vramReq = request.VramRequirementMb ?? 1500;
        var gpu = string.IsNullOrWhiteSpace(request.DetectedGpu) ? detectedPrimaryGpu : request.DetectedGpu!;
        var isInstalled = File.Exists(pathCheck.NormalizedPath);

        // Reuse ID if updating existing manual entry with same exe path
        var existingMatch = _db.GetAllGames().FirstOrDefault(g =>
            g.IsManualEntry && string.Equals(g.ExecutablePath, pathCheck.NormalizedPath, StringComparison.OrdinalIgnoreCase));

        var newGame = new InstalledGame(
            Id: existingMatch?.Id ?? $"manual_{Guid.NewGuid():N}"[..16],
            Title: request.Title.Trim(),
            Version: TryReadExecutableVersion(pathCheck.NormalizedPath),
            CoverImageUrl: existingMatch?.CoverImageUrl ?? TryFindLocalCoverDataUri(pathCheck.NormalizedPath, installDir, null),
            ExecutableName: exeName,
            ExecutablePath: pathCheck.NormalizedPath,
            InstallPath: installDir,
            DetectedGpu: gpu,
            Launcher: string.IsNullOrWhiteSpace(request.Launcher) ? "Standalone" : request.Launcher.Trim(),
            SizeGb: request.SizeGb ?? EstimateFileOrFolderSizeGb(pathCheck.NormalizedPath, installDir),
            LastPlayed: existingMatch?.LastPlayed,
            Compatibility: vramReq <= 1400 ? "optimal" : vramReq <= 1900 ? "needs_tuning" : "heavy_for_vram",
            EstimatedFpsRange: "غير مقاس (يعتمد على التحليل الذكي)",
            RecommendedResolution: "1280×720",
            VramRequirementMb: vramReq,
            IsOptimizedProfileActive: existingMatch?.IsOptimizedProfileActive ?? false,
            IsManualEntry: true,
            SafetyNoteAr: "تم تسجيل اللعبة يدوياً في قاعدة SQLite المحلية. لا يمس الوكيل ملفات اللعبة الأصلية.",
            IsInstalled: isInstalled,
            IsFavorite: existingMatch?.IsFavorite ?? false,
            LaunchUri: existingMatch?.LaunchUri
        );

        _db.UpsertGame(newGame);
        var saved = _db.GetGameById(newGame.Id) ?? newGame;

        _ = _auditLogger.LogOperationAsync("manual_game_registered", "success", new { newGame.Title, newGame.ExecutablePath });
        return (true, RefreshInstalledFlag(saved), null);
    }

    public (bool Success, InstalledGame? Game, string? ErrorAr) UpdateManualGame(
        string gameId,
        ManualGameRegistrationRequest request,
        string detectedPrimaryGpu)
    {
        var existing = _db.GetGameById(gameId);
        if (existing is null)
        {
            return (false, null, "اللعبة غير موجودة في قاعدة البيانات المحلية.");
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return (false, null, "اسم اللعبة مطلوب.");
        }

        var pathCheck = SafetyPolicyGuard.ValidateWindowsExecutablePath(request.ExecutablePath);
        if (!pathCheck.IsValid)
        {
            return (false, null, pathCheck.ErrorAr);
        }

        var exeName = Path.GetFileName(pathCheck.NormalizedPath);
        var installDir = Path.GetDirectoryName(pathCheck.NormalizedPath) ?? string.Empty;
        var vramReq = request.VramRequirementMb ?? existing.VramRequirementMb;
        var gpu = string.IsNullOrWhiteSpace(request.DetectedGpu) ? existing.DetectedGpu : request.DetectedGpu!;

        var updated = existing with
        {
            Title = request.Title.Trim(),
            Version = TryReadExecutableVersion(pathCheck.NormalizedPath) ?? existing.Version,
            CoverImageUrl = existing.CoverImageUrl ?? TryFindLocalCoverDataUri(pathCheck.NormalizedPath, installDir, null),
            ExecutableName = exeName,
            ExecutablePath = pathCheck.NormalizedPath,
            InstallPath = installDir,
            DetectedGpu = string.IsNullOrWhiteSpace(gpu) ? detectedPrimaryGpu : gpu,
            Launcher = string.IsNullOrWhiteSpace(request.Launcher) ? existing.Launcher : request.Launcher.Trim(),
            SizeGb = request.SizeGb ?? existing.SizeGb,
            VramRequirementMb = vramReq,
            IsInstalled = File.Exists(pathCheck.NormalizedPath),
            IsManualEntry = true
        };

        _db.UpsertGame(updated);
        _ = _auditLogger.LogOperationAsync("manual_game_updated", "success", new { updated.Id, updated.Title, updated.ExecutablePath });
        return (true, RefreshInstalledFlag(updated), null);
    }

    public bool RemoveManualGame(string gameId)
    {
        var existing = _db.GetGameById(gameId);
        if (existing is null) return false;

        var removed = _db.DeleteGame(gameId);
        if (removed)
        {
            _ = _auditLogger.LogOperationAsync("manual_game_removed", "success", new { gameId });
        }
        return removed;
    }

    public IReadOnlyList<string> GetCustomFolders() => _db.GetCustomFolders();

    public (bool Success, IReadOnlyList<string> Folders, string? ErrorAr) AddCustomFolder(string folderPath)
    {
        var check = SafetyPolicyGuard.ValidateWindowsDirectoryPath(folderPath);
        if (!check.IsValid)
        {
            return (false, _db.GetCustomFolders(), check.ErrorAr);
        }

        if (!Directory.Exists(check.NormalizedPath))
        {
            return (false, _db.GetCustomFolders(), $"المجلد غير موجود على الجهاز: {check.NormalizedPath}");
        }

        _db.AddCustomFolder(check.NormalizedPath);
        return (true, _db.GetCustomFolders(), null);
    }

    public IReadOnlyList<string> RemoveCustomFolder(string folderPath)
    {
        _db.RemoveCustomFolder(folderPath);
        return _db.GetCustomFolders();
    }

    public bool SetFavorite(string gameId, bool isFavorite)
    {
        _db.SetFavorite(gameId, isFavorite);
        return true;
    }

    public string RecordLastPlayed(string gameId) => _db.RecordLastPlayed(gameId);

    public (bool Success, FileSystemBrowseResponse? Response, string? ErrorAr) BrowseFileSystem(string? path)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                var drives = DriveInfo.GetDrives()
                    .Where(d => d.IsReady && (d.DriveType == DriveType.Fixed || d.DriveType == DriveType.Removable))
                    .Select(d => new FileSystemEntryItem(
                        Name: string.IsNullOrWhiteSpace(d.VolumeLabel)
                            ? d.Name.TrimEnd('\\')
                            : $"{d.Name.TrimEnd('\\')} ({d.VolumeLabel})",
                        FullPath: d.RootDirectory.FullName,
                        EntryType: "drive",
                        SizeBytes: d.TotalSize
                    ))
                    .ToList();

                return (true, new FileSystemBrowseResponse(null, null, drives), null);
            }

            var check = SafetyPolicyGuard.ValidateWindowsDirectoryPath(path);
            if (!check.IsValid)
            {
                return (false, null, check.ErrorAr);
            }

            if (!Directory.Exists(check.NormalizedPath))
            {
                return (false, null, $"المسار غير موجود: {check.NormalizedPath}");
            }

            var entries = new List<FileSystemEntryItem>();
            var dirInfo = new DirectoryInfo(check.NormalizedPath);

            foreach (var sub in dirInfo.EnumerateDirectories())
            {
                if ((sub.Attributes & FileAttributes.Hidden) != 0 && (sub.Attributes & FileAttributes.System) != 0)
                    continue;
                entries.Add(new FileSystemEntryItem(sub.Name, sub.FullName, "directory", null));
            }

            foreach (var file in dirInfo.EnumerateFiles("*.exe"))
            {
                entries.Add(new FileSystemEntryItem(file.Name, file.FullName, "exe", file.Length));
            }

            entries.Sort((a, b) =>
            {
                if (a.EntryType != b.EntryType)
                {
                    return a.EntryType == "directory" ? -1 : 1;
                }
                return string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase);
            });

            var parent = dirInfo.Parent?.FullName;
            return (true, new FileSystemBrowseResponse(dirInfo.FullName, parent, entries), null);
        }
        catch (UnauthorizedAccessException)
        {
            return (false, null, "ليس لدى الوكيل صلاحية لقراءة هذا المجلد.");
        }
        catch (Exception ex)
        {
            return (false, null, $"تعذر استعراض المجلد: {ex.Message}");
        }
    }

    public static IReadOnlyList<InstalledGame> DeduplicateGames(IEnumerable<InstalledGame> games)
    {
        var result = new List<InstalledGame>();
        var seenExePaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenNormalizedTitles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var game in games)
        {
            var exeKey = NormalizePathKey(game.ExecutablePath);
            var titleKey = NormalizeTitleKey(game.Title);

            if (!string.IsNullOrEmpty(exeKey) && seenExePaths.Contains(exeKey))
                continue;
            if (!string.IsNullOrEmpty(titleKey) && seenNormalizedTitles.Contains(titleKey))
                continue;

            if (!string.IsNullOrEmpty(exeKey)) seenExePaths.Add(exeKey);
            if (!string.IsNullOrEmpty(titleKey)) seenNormalizedTitles.Add(titleKey);
            result.Add(game);
        }

        return result;
    }

    private static InstalledGame RefreshInstalledFlag(InstalledGame game)
    {
        var hasExe = !string.IsNullOrWhiteSpace(game.ExecutablePath) && File.Exists(game.ExecutablePath);
        var hasInstallOrUri =
            (!string.IsNullOrWhiteSpace(game.InstallPath) && Directory.Exists(game.InstallPath))
            || SafetyPolicyGuard.IsAllowedOfficialLaunchUri(game.LaunchUri);

        return game with { IsInstalled = hasExe || hasInstallOrUri };
    }

    private static string NormalizePathKey(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return string.Empty;
        try
        {
            return Path.GetFullPath(path.Trim()).TrimEnd('\\').ToLowerInvariant();
        }
        catch
        {
            return path.Trim().ToLowerInvariant();
        }
    }

    private static string NormalizeTitleKey(string title)
    {
        if (string.IsNullOrWhiteSpace(title)) return string.Empty;
        var chars = title.Where(char.IsLetterOrDigit).ToArray();
        return new string(chars).ToLowerInvariant();
    }

    private List<InstalledGame> ScanSteamLibraries(string gpuLabel, List<string> scannedLocations)
    {
        var list = new List<InstalledGame>();
        try
        {
            var steamPath = Registry.GetValue(@"HKEY_CURRENT_USER\Software\Valve\Steam", "SteamPath", null)?.ToString()
                            ?? Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Valve\Steam", "InstallPath", null)?.ToString();

            if (string.IsNullOrWhiteSpace(steamPath) || !Directory.Exists(steamPath))
                return list;

            var libraryRoots = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { steamPath };
            var vdfPath = Path.Combine(steamPath, "steamapps", "libraryfolders.vdf");
            if (File.Exists(vdfPath))
            {
                var content = File.ReadAllText(vdfPath);
                foreach (var lib in VdfAndShortcutParsers.ParseSteamLibraryFoldersVdf(content))
                {
                    if (Directory.Exists(lib)) libraryRoots.Add(lib);
                }
            }

            foreach (var root in libraryRoots)
            {
                var steamApps = Path.Combine(root, "steamapps");
                if (!Directory.Exists(steamApps)) continue;
                scannedLocations.Add(steamApps);

                foreach (var acfFile in Directory.EnumerateFiles(steamApps, "appmanifest_*.acf"))
                {
                    var manifest = VdfAndShortcutParsers.ParseSteamAppManifestAcf(File.ReadAllText(acfFile));
                    if (manifest is null) continue;
                    if (manifest.AppId == "228980") continue;

                    var installPath = Path.Combine(steamApps, "common", manifest.InstallDir);
                    if (!Directory.Exists(installPath)) continue;

                    var exePath = FindPrimaryExecutableShallow(installPath, manifest.Name) ?? string.Empty;
                    var exeName = !string.IsNullOrEmpty(exePath) ? Path.GetFileName(exePath) : "Steam Launcher";
                    var launchUri = !string.IsNullOrWhiteSpace(manifest.AppId)
                        ? $"steam://rungameid/{manifest.AppId}"
                        : null;
                    var cover = TryFindSteamLocalCoverDataUri(steamPath, manifest.AppId)
                                ?? TryFindLocalCoverDataUri(exePath, installPath, null);
                    var lastPlayed = manifest.LastUpdatedEpoch.HasValue
                        ? $"تحديث/نشاط: {DateTimeOffset.FromUnixTimeSeconds(manifest.LastUpdatedEpoch.Value).LocalDateTime:yyyy-MM-dd}"
                        : null;

                    list.Add(BuildDetectedGame(
                        id: $"steam_{manifest.AppId}",
                        title: manifest.Name,
                        exeName: exeName,
                        exePath: exePath,
                        installPath: installPath,
                        gpuLabel: gpuLabel,
                        launcher: "Steam",
                        sizeGb: Math.Round(manifest.SizeOnDiskBytes / (1024.0 * 1024.0 * 1024.0), 1),
                        coverImageUrl: cover,
                        lastPlayed: lastPlayed,
                        launchUri: launchUri
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Steam scan encountered an error");
        }
        return list;
    }

    private List<InstalledGame> ScanEpicManifests(string gpuLabel, List<string> scannedLocations)
    {
        var list = new List<InstalledGame>();
        try
        {
            var epicManifestsDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "Epic", "EpicGamesLauncher", "Data", "Manifests"
            );

            if (!Directory.Exists(epicManifestsDir)) return list;
            scannedLocations.Add(epicManifestsDir);

            foreach (var itemFile in Directory.EnumerateFiles(epicManifestsDir, "*.item"))
            {
                var parsed = VdfAndShortcutParsers.ParseEpicItemManifestJson(File.ReadAllText(itemFile));
                if (parsed is null || !Directory.Exists(parsed.InstallLocation)) continue;

                var candidateExe = string.IsNullOrWhiteSpace(parsed.LaunchExecutable)
                    ? string.Empty
                    : Path.Combine(parsed.InstallLocation, parsed.LaunchExecutable);
                var resolvedExe = File.Exists(candidateExe)
                    ? candidateExe
                    : FindPrimaryExecutableShallow(parsed.InstallLocation, parsed.DisplayName) ?? string.Empty;

                string? launchUri = null;
                if (!string.IsNullOrWhiteSpace(parsed.CatalogNamespace) &&
                    !string.IsNullOrWhiteSpace(parsed.CatalogItemId) &&
                    !string.IsNullOrWhiteSpace(parsed.AppName))
                {
                    launchUri = $"com.epicgames.launcher://apps/{parsed.CatalogNamespace}%3A{parsed.CatalogItemId}%3A{parsed.AppName}?action=launch&silent=true";
                }

                list.Add(BuildDetectedGame(
                    id: $"epic_{NormalizeTitleKey(parsed.DisplayName)}",
                    title: parsed.DisplayName,
                    exeName: string.IsNullOrEmpty(resolvedExe) ? "Epic Launcher" : Path.GetFileName(resolvedExe),
                    exePath: resolvedExe,
                    installPath: parsed.InstallLocation,
                    gpuLabel: gpuLabel,
                    launcher: "Epic Games",
                    sizeGb: Math.Round(parsed.InstallSizeBytes / (1024.0 * 1024.0 * 1024.0), 1),
                    coverImageUrl: TryFindLocalCoverDataUri(resolvedExe, parsed.InstallLocation, null),
                    launchUri: launchUri
                ));
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Epic manifest scan encountered an error");
        }
        return list;
    }

    private List<InstalledGame> ScanXboxInstallations(string gpuLabel, List<string> scannedLocations)
    {
        var list = new List<InstalledGame>();
        var xboxRoots = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        try
        {
            foreach (var drive in DriveInfo.GetDrives().Where(d => d.IsReady && d.DriveType == DriveType.Fixed))
            {
                var defaultXboxDir = Path.Combine(drive.RootDirectory.FullName, "XboxGames");
                if (Directory.Exists(defaultXboxDir)) xboxRoots.Add(defaultXboxDir);

                var gamingRootFile = Path.Combine(drive.RootDirectory.FullName, ".GamingRoot");
                if (File.Exists(gamingRootFile))
                {
                    try
                    {
                        var bytes = File.ReadAllBytes(gamingRootFile);
                        var rawText = System.Text.Encoding.Unicode.GetString(bytes).Replace("\0", string.Empty).Trim();
                        var cleanedFolder = new string(rawText.Where(c => !char.IsControl(c) && !Path.GetInvalidPathChars().Contains(c)).ToArray()).Trim();
                        if (!string.IsNullOrWhiteSpace(cleanedFolder))
                        {
                            var candidate = Path.Combine(drive.RootDirectory.FullName, cleanedFolder.TrimStart('\\'));
                            if (Directory.Exists(candidate)) xboxRoots.Add(candidate);
                        }
                    }
                    catch
                    {
                        // ignore unreadable .GamingRoot
                    }
                }
            }

            foreach (var root in xboxRoots)
            {
                scannedLocations.Add(root);
                foreach (var gameDir in Directory.EnumerateDirectories(root))
                {
                    try
                    {
                        var contentDir = Directory.Exists(Path.Combine(gameDir, "Content"))
                            ? Path.Combine(gameDir, "Content")
                            : gameDir;

                        var configFile = Path.Combine(contentDir, "MicrosoftGame.config");
                        ParsedXboxGameConfig? config = null;
                        if (File.Exists(configFile))
                        {
                            config = VdfAndShortcutParsers.TryParseXboxMicrosoftGameConfigXml(File.ReadAllText(configFile));
                        }

                        var title = config?.DisplayName ?? Path.GetFileName(gameDir);
                        var exePath = string.Empty;
                        if (!string.IsNullOrWhiteSpace(config?.ExecutableName))
                        {
                            var candidate = Path.Combine(contentDir, config.ExecutableName);
                            if (File.Exists(candidate)) exePath = candidate;
                        }
                        if (string.IsNullOrEmpty(exePath))
                        {
                            exePath = FindPrimaryExecutableShallow(contentDir, title) ?? string.Empty;
                        }

                        if (string.IsNullOrEmpty(exePath) && config is null) continue;

                        string? coverUri = null;
                        if (!string.IsNullOrWhiteSpace(config?.LogoRelativePath))
                        {
                            coverUri = TryConvertImageFileToDataUri(Path.Combine(contentDir, config.LogoRelativePath));
                        }
                        coverUri ??= TryFindLocalCoverDataUri(exePath, contentDir, null);

                        list.Add(BuildDetectedGame(
                            id: $"xbox_{NormalizeTitleKey(title)}",
                            title: title,
                            exeName: string.IsNullOrEmpty(exePath) ? "Xbox App" : Path.GetFileName(exePath),
                            exePath: exePath,
                            installPath: contentDir,
                            gpuLabel: gpuLabel,
                            launcher: "Xbox App",
                            sizeGb: 0,
                            coverImageUrl: coverUri
                        ));
                    }
                    catch (UnauthorizedAccessException)
                    {
                        // Xbox protected folders cannot be inspected without ACL permission — skip gracefully
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Xbox games scan encountered access limitation");
        }

        return list;
    }

    private List<InstalledGame> ScanWindowsInstalledGameEntries(string gpuLabel, List<string> scannedLocations)
    {
        var list = new List<InstalledGame>();
        var uninstallRoots = new[]
        {
            (Registry.LocalMachine, @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
            (Registry.LocalMachine, @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
            (Registry.CurrentUser, @"Software\Microsoft\Windows\CurrentVersion\Uninstall")
        };

        scannedLocations.Add(@"Registry\Uninstall");

        foreach (var (hive, subKeyPath) in uninstallRoots)
        {
            try
            {
                using var rootKey = hive.OpenSubKey(subKeyPath);
                if (rootKey is null) continue;

                foreach (var appKeyName in rootKey.GetSubKeyNames())
                {
                    using var appKey = rootKey.OpenSubKey(appKeyName);
                    var displayName = appKey?.GetValue("DisplayName")?.ToString()?.Trim();
                    var publisher = appKey?.GetValue("Publisher")?.ToString()?.Trim() ?? string.Empty;
                    var installLocation = appKey?.GetValue("InstallLocation")?.ToString()?.Trim();

                    if (string.IsNullOrWhiteSpace(displayName) || string.IsNullOrWhiteSpace(installLocation))
                        continue;

                    var looksLikeGamePublisher = KnownGamePublishers.Any(p =>
                        publisher.Contains(p, StringComparison.OrdinalIgnoreCase) ||
                        installLocation.Contains(p, StringComparison.OrdinalIgnoreCase));

                    if (!looksLikeGamePublisher || !Directory.Exists(installLocation))
                        continue;

                    var exePath = FindPrimaryExecutableShallow(installLocation, displayName) ?? string.Empty;
                    var launcher = publisher.Contains("Riot", StringComparison.OrdinalIgnoreCase)
                        ? "Riot Client"
                        : publisher.Contains("Xbox", StringComparison.OrdinalIgnoreCase)
                        ? "Xbox App"
                        : "Standalone";

                    list.Add(BuildDetectedGame(
                        id: $"reg_{NormalizeTitleKey(displayName)}",
                        title: displayName,
                        exeName: string.IsNullOrEmpty(exePath) ? "غير محدد" : Path.GetFileName(exePath),
                        exePath: exePath,
                        installPath: installLocation,
                        gpuLabel: gpuLabel,
                        launcher: launcher,
                        sizeGb: 0,
                        coverImageUrl: TryFindLocalCoverDataUri(exePath, installLocation, null)
                    ));
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Registry uninstall scan skipped subkey {SubKey}", subKeyPath);
            }
        }

        return list;
    }

    private List<InstalledGame> ScanCommonAndCustomFolders(
        string gpuLabel,
        IReadOnlyList<string> customFolders,
        List<string> scannedLocations)
    {
        var list = new List<InstalledGame>();
        var rootCandidates = new List<(string Path, bool IsCustom)>
        {
            (@"C:\Riot Games", false),
            (@"C:\Games", false),
            (@"D:\Games", false),
        };

        foreach (var custom in customFolders)
        {
            if (!rootCandidates.Any(r => string.Equals(r.Path, custom, StringComparison.OrdinalIgnoreCase)))
            {
                rootCandidates.Add((custom, true));
            }
        }

        foreach (var (root, isCustom) in rootCandidates)
        {
            if (!Directory.Exists(root)) continue;
            scannedLocations.Add(root);

            try
            {
                // If user selected a folder directly containing the game EXE
                if (isCustom)
                {
                    var directExe = FindPrimaryExecutableShallow(root, Path.GetFileName(root), topOnly: true);
                    if (directExe is not null)
                    {
                        var dirName = Path.GetFileName(root);
                        list.Add(BuildDetectedGame(
                            id: $"custom_{NormalizeTitleKey(dirName)}",
                            title: dirName,
                            exeName: Path.GetFileName(directExe),
                            exePath: directExe,
                            installPath: root,
                            gpuLabel: gpuLabel,
                            launcher: "Standalone",
                            sizeGb: EstimateFileOrFolderSizeGb(directExe, root),
                            coverImageUrl: TryFindLocalCoverDataUri(directExe, root, null)
                        ));
                    }
                }

                foreach (var dir in Directory.EnumerateDirectories(root))
                {
                    var folderName = Path.GetFileName(dir);
                    if (folderName.Equals("Riot Client", StringComparison.OrdinalIgnoreCase)) continue;

                    var exePath = FindPrimaryExecutableShallow(dir, folderName);
                    if (exePath is null) continue;

                    var launcher = root.Contains("Riot", StringComparison.OrdinalIgnoreCase)
                        ? "Riot Client"
                        : "Standalone";

                    list.Add(BuildDetectedGame(
                        id: $"{(isCustom ? "custom" : "dir")}_{NormalizeTitleKey(folderName)}",
                        title: folderName,
                        exeName: Path.GetFileName(exePath),
                        exePath: exePath,
                        installPath: dir,
                        gpuLabel: gpuLabel,
                        launcher: launcher,
                        sizeGb: EstimateFileOrFolderSizeGb(exePath, dir),
                        coverImageUrl: TryFindLocalCoverDataUri(exePath, dir, null)
                    ));
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Folder scan skipped {Root}", root);
            }
        }

        return list;
    }

    private List<InstalledGame> ScanShortcuts(string gpuLabel, List<string> scannedLocations)
    {
        var list = new List<InstalledGame>();
        var shortcutFolders = new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
            Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory),
            Environment.GetFolderPath(Environment.SpecialFolder.Programs),
            Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms)
        }.Where(p => !string.IsNullOrWhiteSpace(p) && Directory.Exists(p))
         .Distinct(StringComparer.OrdinalIgnoreCase);

        foreach (var folder in shortcutFolders)
        {
            scannedLocations.Add(folder);

            try
            {
                var filesToCheck = new List<string>();
                filesToCheck.AddRange(Directory.EnumerateFiles(folder, "*.lnk"));
                filesToCheck.AddRange(Directory.EnumerateFiles(folder, "*.url"));

                // Scan 1 level of Start Menu subfolders (e.g. Start Menu\Programs\Games, Riot Games, etc.)
                foreach (var subDir in Directory.EnumerateDirectories(folder))
                {
                    try
                    {
                        filesToCheck.AddRange(Directory.EnumerateFiles(subDir, "*.lnk"));
                        filesToCheck.AddRange(Directory.EnumerateFiles(subDir, "*.url"));
                    }
                    catch
                    {
                        // skip restricted subfolders
                    }
                }

                foreach (var shortcutPath in filesToCheck)
                {
                    var title = Path.GetFileNameWithoutExtension(shortcutPath);
                    if (shortcutPath.EndsWith(".url", StringComparison.OrdinalIgnoreCase))
                    {
                        var uri = VdfAndShortcutParsers.TryParseUrlShortcut(File.ReadAllText(shortcutPath));
                        if (!SafetyPolicyGuard.IsAllowedOfficialLaunchUri(uri)) continue;

                        var launcher = uri!.StartsWith("steam://", StringComparison.OrdinalIgnoreCase)
                            ? "Steam"
                            : uri.StartsWith("com.epicgames.launcher://", StringComparison.OrdinalIgnoreCase)
                            ? "Epic Games"
                            : "Standalone";

                        list.Add(BuildDetectedGame(
                            id: $"url_{NormalizeTitleKey(title)}",
                            title: title,
                            exeName: $"{launcher} Shortcut",
                            exePath: string.Empty,
                            installPath: folder,
                            gpuLabel: gpuLabel,
                            launcher: launcher,
                            sizeGb: 0,
                            launchUri: uri
                        ));
                        continue;
                    }

                    var bytes = File.ReadAllBytes(shortcutPath);
                    var target = VdfAndShortcutParsers.TryExtractTargetFromLnkBytes(bytes);
                    if (string.IsNullOrWhiteSpace(target) ||
                        !target.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ||
                        !File.Exists(target))
                        continue;

                    var exeBase = Path.GetFileNameWithoutExtension(target);
                    if (ExcludedExeKeywords.Any(k => exeBase.Contains(k, StringComparison.OrdinalIgnoreCase)))
                        continue;

                    var isGameFolder = target.Contains("Steam", StringComparison.OrdinalIgnoreCase)
                                       || target.Contains("Epic Games", StringComparison.OrdinalIgnoreCase)
                                       || target.Contains("Riot Games", StringComparison.OrdinalIgnoreCase)
                                       || target.Contains(@"\Games\", StringComparison.OrdinalIgnoreCase)
                                       || target.Contains("XboxGames", StringComparison.OrdinalIgnoreCase)
                                       || shortcutPath.Contains(@"\Games\", StringComparison.OrdinalIgnoreCase);

                    if (!isGameFolder) continue;

                    var installDir = Path.GetDirectoryName(target) ?? string.Empty;
                    list.Add(BuildDetectedGame(
                        id: $"lnk_{NormalizeTitleKey(title)}",
                        title: title,
                        exeName: Path.GetFileName(target),
                        exePath: target,
                        installPath: installDir,
                        gpuLabel: gpuLabel,
                        launcher: target.Contains("Riot", StringComparison.OrdinalIgnoreCase) ? "Riot Client" : "Standalone",
                        sizeGb: 0,
                        coverImageUrl: TryFindLocalCoverDataUri(target, installDir, null)
                    ));
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Shortcut scan skipped {Folder}", folder);
            }
        }

        return list;
    }

    private static string? FindPrimaryExecutableShallow(string rootDir, string gameTitle, bool topOnly = false)
    {
        try
        {
            var candidates = new List<string>();
            candidates.AddRange(Directory.EnumerateFiles(rootDir, "*.exe", SearchOption.TopDirectoryOnly));

            if (!topOnly)
            {
                foreach (var sub in Directory.EnumerateDirectories(rootDir))
                {
                    candidates.AddRange(Directory.EnumerateFiles(sub, "*.exe", SearchOption.TopDirectoryOnly));
                }
            }

            var filtered = candidates
                .Where(path =>
                {
                    var name = Path.GetFileNameWithoutExtension(path);
                    return !ExcludedExeKeywords.Any(k => name.Contains(k, StringComparison.OrdinalIgnoreCase));
                })
                .ToList();

            if (filtered.Count == 0) return null;

            var titleNorm = NormalizeTitleKey(gameTitle);
            var exactMatch = filtered.FirstOrDefault(p =>
                !string.IsNullOrEmpty(titleNorm) &&
                NormalizeTitleKey(Path.GetFileNameWithoutExtension(p)).Contains(titleNorm, StringComparison.OrdinalIgnoreCase));

            return exactMatch ?? filtered[0];
        }
        catch
        {
            return null;
        }
    }

    private static string? TryFindSteamLocalCoverDataUri(string steamRoot, string appId)
    {
        if (string.IsNullOrWhiteSpace(steamRoot) || string.IsNullOrWhiteSpace(appId)) return null;
        var cacheDir = Path.Combine(steamRoot, "appcache", "librarycache");
        if (!Directory.Exists(cacheDir)) return null;

        var candidates = new[]
        {
            Path.Combine(cacheDir, $"{appId}_library_600x900.jpg"),
            Path.Combine(cacheDir, $"{appId}_header.jpg"),
            Path.Combine(cacheDir, $"{appId}_library_hero.jpg"),
            Path.Combine(cacheDir, appId, "library_600x900.jpg"),
            Path.Combine(cacheDir, appId, "header.jpg"),
        };

        foreach (var file in candidates)
        {
            var uri = TryConvertImageFileToDataUri(file);
            if (uri is not null) return uri;
        }
        return null;
    }

    private static string? TryFindLocalCoverDataUri(string? exePath, string? installDir, string? hintLogoPath)
    {
        if (!string.IsNullOrWhiteSpace(hintLogoPath))
        {
            var hintUri = TryConvertImageFileToDataUri(hintLogoPath);
            if (hintUri is not null) return hintUri;
        }

        if (!string.IsNullOrWhiteSpace(installDir) && Directory.Exists(installDir))
        {
            var imageNames = new[]
            {
                "cover.jpg", "cover.png", "header.jpg", "header.png",
                "boxart.jpg", "boxart.png", "logo.png", "splash.png", "splash.jpg"
            };
            foreach (var name in imageNames)
            {
                var uri = TryConvertImageFileToDataUri(Path.Combine(installDir, name));
                if (uri is not null) return uri;
            }
        }

        if (!string.IsNullOrWhiteSpace(exePath))
        {
            var exeDir = Path.GetDirectoryName(exePath);
            if (!string.IsNullOrWhiteSpace(exeDir) && Directory.Exists(exeDir))
            {
                var ico = Path.Combine(exeDir, $"{Path.GetFileNameWithoutExtension(exePath)}.png");
                var uri = TryConvertImageFileToDataUri(ico);
                if (uri is not null) return uri;
            }
        }

        return null;
    }

    private static string? TryConvertImageFileToDataUri(string filePath)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath)) return null;
            var info = new FileInfo(filePath);
            if (info.Length == 0 || info.Length > 512 * 1024) return null;

            var ext = info.Extension.ToLowerInvariant();
            var mime = ext switch
            {
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".webp" => "image/webp",
                ".ico" => "image/x-icon",
                _ => null
            };
            if (mime is null) return null;

            var bytes = File.ReadAllBytes(filePath);
            return $"data:{mime};base64,{Convert.ToBase64String(bytes)}";
        }
        catch
        {
            return null;
        }
    }

    private static double EstimateFileOrFolderSizeGb(string? exePath, string? installDir)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(installDir) && Directory.Exists(installDir))
            {
                long total = 0;
                foreach (var file in Directory.EnumerateFiles(installDir, "*", SearchOption.TopDirectoryOnly))
                {
                    total += new FileInfo(file).Length;
                }
                return Math.Round(total / (1024.0 * 1024.0 * 1024.0), 2);
            }
            if (!string.IsNullOrWhiteSpace(exePath) && File.Exists(exePath))
            {
                return Math.Round(new FileInfo(exePath).Length / (1024.0 * 1024.0 * 1024.0), 2);
            }
        }
        catch
        {
            // ignore size errors
        }
        return 0;
    }

    private static InstalledGame BuildDetectedGame(
        string id,
        string title,
        string exeName,
        string exePath,
        string installPath,
        string gpuLabel,
        string launcher,
        double sizeGb,
        string? coverImageUrl = null,
        string? lastPlayed = null,
        string? launchUri = null)
    {
        var isInstalled = (!string.IsNullOrWhiteSpace(exePath) && File.Exists(exePath))
                          || SafetyPolicyGuard.IsAllowedOfficialLaunchUri(launchUri)
                          || (!string.IsNullOrWhiteSpace(installPath) && Directory.Exists(installPath));

        return new InstalledGame(
            Id: id,
            Title: title,
            Version: TryReadExecutableVersion(exePath),
            CoverImageUrl: coverImageUrl,
            ExecutableName: exeName,
            ExecutablePath: exePath,
            InstallPath: installPath,
            DetectedGpu: gpuLabel,
            Launcher: launcher,
            SizeGb: sizeGb,
            LastPlayed: lastPlayed,
            Compatibility: "needs_tuning",
            EstimatedFpsRange: "غير مقاس (يعتمد على التحليل الذكي)",
            RecommendedResolution: "1280×720",
            VramRequirementMb: 1500,
            IsOptimizedProfileActive: false,
            IsManualEntry: false,
            SafetyNoteAr: "تم رصد اللعبة بالقراءة فقط دون تعديل ملفاتها الأصلية.",
            IsInstalled: isInstalled,
            IsFavorite: false,
            LaunchUri: launchUri
        );
    }

    private static string? TryReadExecutableVersion(string exePath)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(exePath) || !File.Exists(exePath)) return null;
            var info = System.Diagnostics.FileVersionInfo.GetVersionInfo(exePath);
            var ver = info.ProductVersion ?? info.FileVersion;
            return string.IsNullOrWhiteSpace(ver) ? null : ver.Trim();
        }
        catch
        {
            return null;
        }
    }
}
