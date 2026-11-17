using System.Text.RegularExpressions;

namespace GameBoosterPro.Agent.Security;

/// <summary>
/// Central security policy guard enforcing invariants across all agent services:
/// 1. Loopback-only binding.
/// 2. Allowlisted optimization IDs only (never arbitrary commands).
/// 3. Protected Windows Defender / Antivirus / Firewall / Essential services.
/// 4. Strict ban on touching original game EXE, DLL, CFG, INI, or asset files.
/// </summary>
public static partial class SafetyPolicyGuard
{
    public static readonly IReadOnlySet<string> AllowedTweakIds = new HashSet<string>(StringComparer.Ordinal)
    {
        "tweak_power_plan",
        "tweak_gpu_pref",
        "tweak_game_mode",
        "tweak_bg_apps",
    };

    public static readonly IReadOnlySet<string> ProtectedProcessNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "MsMpEng",
        "NisSrv",
        "SecurityHealthService",
        "SecurityHealthSystray",
        "MpDefenderCoreService",
        "WinDefend",
        "mpssvc",
        "csrss",
        "smss",
        "lsass",
        "wininit",
        "winlogon",
        "services",
        "svchost",
        "System",
        "dwm",
        "explorer",
    };

    public static readonly IReadOnlySet<string> ProtectedGameFileExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        ".exe", ".dll", ".cfg", ".ini", ".pak", ".vpk", ".ucas", ".utoc", ".rpf", ".assets"
    };

    public static bool IsLoopbackHost(string host)
    {
        if (string.IsNullOrWhiteSpace(host)) return false;
        var trimmed = host.Trim();
        return string.Equals(trimmed, "127.0.0.1", StringComparison.OrdinalIgnoreCase)
            || string.Equals(trimmed, "localhost", StringComparison.OrdinalIgnoreCase)
            || string.Equals(trimmed, "::1", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsAllowedTweakId(string tweakId) =>
        !string.IsNullOrWhiteSpace(tweakId) && AllowedTweakIds.Contains(tweakId);

    public static bool IsProtectedProcess(string processNameWithoutExtension)
    {
        if (string.IsNullOrWhiteSpace(processNameWithoutExtension)) return true;
        var normalized = processNameWithoutExtension.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)
            ? processNameWithoutExtension[..^4]
            : processNameWithoutExtension;
        return ProtectedProcessNames.Contains(normalized);
    }

    public static (bool IsValid, string NormalizedPath, string? ErrorAr) ValidateWindowsExecutablePath(string? rawPath)
    {
        if (string.IsNullOrWhiteSpace(rawPath))
        {
            return (false, string.Empty, "مسار الملف التنفيذي (.exe) مطلوب.");
        }

        var trimmed = rawPath.Trim();
        if (trimmed.IndexOfAny([';', '&', '|', '`', '$', '<', '>', '\r', '\n']) >= 0)
        {
            return (false, string.Empty, "المسار يحتوي على رموز غير مسموح بها أمنياً.");
        }

        if (!WindowsExeRegex().IsMatch(trimmed))
        {
            return (false, trimmed, "يجب أن يكون المسار مسار ويندوز صحيحاً وينتهي بـ .exe.");
        }

        return (true, trimmed, null);
    }

    public static (bool IsValid, string NormalizedPath, string? ErrorAr) ValidateWindowsDirectoryPath(string? rawPath)
    {
        if (string.IsNullOrWhiteSpace(rawPath))
        {
            return (false, string.Empty, "مسار المجلد مطلوب.");
        }

        var trimmed = rawPath.Trim().Trim('"');
        if (trimmed.IndexOfAny([';', '&', '|', '`', '$', '<', '>', '\r', '\n']) >= 0)
        {
            return (false, string.Empty, "مسار المجلد يحتوي على رموز غير مسموح بها أمنياً.");
        }

        if (!WindowsDirRegex().IsMatch(trimmed))
        {
            return (false, trimmed, "يجب إدخال مسار مجلد ويندوز صحيح (مثال: D:\\Games).");
        }

        return (true, trimmed, null);
    }

    /// <summary>
    /// Allows ONLY official launcher launch URIs (Steam rungameid, Epic com.epicgames.launcher, or Xbox shell:AppsFolder).
    /// Blocks arbitrary web/command URIs.
    /// </summary>
    public static bool IsAllowedOfficialLaunchUri(string? rawUri)
    {
        if (string.IsNullOrWhiteSpace(rawUri)) return false;
        var trimmed = rawUri.Trim();
        if (trimmed.IndexOfAny([';', '&', '|', '`', '$', '<', '>', '"', '\r', '\n']) >= 0)
        {
            return false;
        }

        return SteamLaunchUriRegex().IsMatch(trimmed)
            || EpicLaunchUriRegex().IsMatch(trimmed)
            || XboxAppsFolderUriRegex().IsMatch(trimmed);
    }

    /// <summary>
    /// Ensures registry or power targets only modify approved Windows user/power areas and never game files.
    /// </summary>
    public static bool IsSafeModificationTarget(string targetPath)
    {
        if (string.IsNullOrWhiteSpace(targetPath)) return false;
        var ext = Path.GetExtension(targetPath);
        if (!string.IsNullOrEmpty(ext) && ProtectedGameFileExtensions.Contains(ext))
        {
            return false;
        }
        return true;
    }

    [GeneratedRegex(@"^[A-Za-z]:\\(?:[^\\/:*?""<>|\r\n]+\\)*[^\\/:*?""<>|\r\n]+\.exe$", RegexOptions.IgnoreCase)]
    private static partial Regex WindowsExeRegex();

    [GeneratedRegex(@"^[A-Za-z]:\\(?:[^\\/:*?""<>|\r\n]+\\?)*$", RegexOptions.IgnoreCase)]
    private static partial Regex WindowsDirRegex();

    [GeneratedRegex(@"^steam://rungameid/\d{1,12}$", RegexOptions.IgnoreCase)]
    private static partial Regex SteamLaunchUriRegex();

    [GeneratedRegex(@"^com\.epicgames\.launcher://apps/[A-Za-z0-9_.\-%:]+(\?action=launch(&silent=true)?)?$", RegexOptions.IgnoreCase)]
    private static partial Regex EpicLaunchUriRegex();

    [GeneratedRegex(@"^shell:AppsFolder\\[A-Za-z0-9_.\-]+![A-Za-z0-9_.\-]+$", RegexOptions.IgnoreCase)]
    private static partial Regex XboxAppsFolderUriRegex();
}
