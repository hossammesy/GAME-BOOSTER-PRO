using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace GameBoosterPro.Agent.Services;

public sealed record ParsedSteamManifest(
    string AppId,
    string Name,
    string InstallDir,
    long SizeOnDiskBytes,
    long? LastUpdatedEpoch = null
);

public sealed record ParsedEpicManifest(
    string DisplayName,
    string InstallLocation,
    string LaunchExecutable,
    long InstallSizeBytes,
    string? CatalogNamespace = null,
    string? CatalogItemId = null,
    string? AppName = null
);

public sealed record ParsedXboxGameConfig(
    string DisplayName,
    string? ExecutableName,
    string? LogoRelativePath
);

public static partial class VdfAndShortcutParsers
{
    public static IReadOnlyList<string> ParseSteamLibraryFoldersVdf(string content)
    {
        var paths = new List<string>();
        if (string.IsNullOrWhiteSpace(content)) return paths;

        foreach (Match match in SteamLibraryPathRegex().Matches(content))
        {
            var raw = match.Groups[1].Value.Replace("\\\\", "\\").Trim();
            if (!string.IsNullOrWhiteSpace(raw) && !paths.Contains(raw, StringComparer.OrdinalIgnoreCase))
            {
                paths.Add(raw);
            }
        }
        return paths;
    }

    public static ParsedSteamManifest? ParseSteamAppManifestAcf(string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return null;

        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (Match match in AcfKeyValueRegex().Matches(content))
        {
            var key = match.Groups[1].Value;
            var val = match.Groups[2].Value;
            values.TryAdd(key, val);
        }

        if (!values.TryGetValue("name", out var name) || string.IsNullOrWhiteSpace(name))
            return null;
        if (!values.TryGetValue("installdir", out var installDir) || string.IsNullOrWhiteSpace(installDir))
            return null;

        values.TryGetValue("appid", out var appId);
        long sizeBytes = 0;
        if (values.TryGetValue("SizeOnDisk", out var sizeRaw))
        {
            long.TryParse(sizeRaw, out sizeBytes);
        }

        long? lastUpdated = null;
        if (values.TryGetValue("LastUpdated", out var luRaw) && long.TryParse(luRaw, out var luVal) && luVal > 0)
        {
            lastUpdated = luVal;
        }

        return new ParsedSteamManifest(
            AppId: appId ?? string.Empty,
            Name: name.Trim(),
            InstallDir: installDir.Trim(),
            SizeOnDiskBytes: sizeBytes,
            LastUpdatedEpoch: lastUpdated
        );
    }

    public static ParsedEpicManifest? ParseEpicItemManifestJson(string jsonContent)
    {
        if (string.IsNullOrWhiteSpace(jsonContent)) return null;

        try
        {
            using var doc = JsonDocument.Parse(jsonContent);
            var root = doc.RootElement;

            var displayName = root.TryGetProperty("DisplayName", out var dn) ? dn.GetString() : null;
            var installLocation = root.TryGetProperty("InstallLocation", out var il) ? il.GetString() : null;
            var launchExe = root.TryGetProperty("LaunchExecutable", out var le) ? le.GetString() : null;
            var catNs = root.TryGetProperty("CatalogNamespace", out var cn) ? cn.GetString() : null;
            var catId = root.TryGetProperty("CatalogItemId", out var ci) ? ci.GetString() : null;
            var appName = root.TryGetProperty("AppName", out var an) ? an.GetString() : null;

            long installSize = 0;
            if (root.TryGetProperty("InstallSize", out var isz) && isz.ValueKind == JsonValueKind.Number)
            {
                isz.TryGetInt64(out installSize);
            }

            if (string.IsNullOrWhiteSpace(displayName) || string.IsNullOrWhiteSpace(installLocation))
                return null;

            return new ParsedEpicManifest(
                DisplayName: displayName.Trim(),
                InstallLocation: installLocation.Trim(),
                LaunchExecutable: launchExe?.Trim() ?? string.Empty,
                InstallSizeBytes: installSize,
                CatalogNamespace: catNs?.Trim(),
                CatalogItemId: catId?.Trim(),
                AppName: appName?.Trim()
            );
        }
        catch
        {
            return null;
        }
    }

    public static ParsedXboxGameConfig? TryParseXboxMicrosoftGameConfigXml(string xmlContent)
    {
        if (string.IsNullOrWhiteSpace(xmlContent)) return null;

        try
        {
            var doc = XDocument.Parse(xmlContent);
            var shellVisuals = doc.Descendants("ShellVisuals").FirstOrDefault();
            var displayName = shellVisuals?.Attribute("DefaultDisplayName")?.Value?.Trim();
            if (string.IsNullOrWhiteSpace(displayName))
            {
                displayName = doc.Descendants("Identity").FirstOrDefault()?.Attribute("Name")?.Value?.Trim();
            }

            if (string.IsNullOrWhiteSpace(displayName))
            {
                return null;
            }

            var exeElement = doc.Descendants("Executable").FirstOrDefault();
            var exeName = exeElement?.Attribute("Name")?.Value?.Trim();

            var logoPath =
                shellVisuals?.Attribute("Square150x150Logo")?.Value?.Trim()
                ?? shellVisuals?.Attribute("StoreLogo")?.Value?.Trim()
                ?? shellVisuals?.Attribute("Square44x44Logo")?.Value?.Trim();

            return new ParsedXboxGameConfig(
                DisplayName: displayName,
                ExecutableName: exeName,
                LogoRelativePath: logoPath
            );
        }
        catch
        {
            return null;
        }
    }

    public static string? TryParseUrlShortcut(string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return null;
        foreach (var rawLine in content.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries))
        {
            var line = rawLine.Trim();
            if (line.StartsWith("URL=", StringComparison.OrdinalIgnoreCase))
            {
                var uri = line[4..].Trim();
                return string.IsNullOrWhiteSpace(uri) ? null : uri;
            }
        }
        return null;
    }

    /// <summary>
    /// Minimal MS-SHLLINK (.lnk) binary parser extracting the local target path without COM Interop.
    /// Returns null for invalid/non-local shortcuts.
    /// </summary>
    public static string? TryExtractTargetFromLnkBytes(byte[] data)
    {
        // ShellLinkHeader is 76 bytes; first 4 bytes = 0x0000004C
        if (data is null || data.Length < 76) return null;
        if (BitConverter.ToInt32(data, 0) != 0x4C) return null;

        var flags = BitConverter.ToUInt32(data, 0x14);
        var hasLinkTargetIdList = (flags & 0x01) != 0;
        var hasLinkInfo = (flags & 0x02) != 0;

        if (!hasLinkInfo) return null;

        var offset = 76;
        if (hasLinkTargetIdList)
        {
            if (offset + 2 > data.Length) return null;
            var idListSize = BitConverter.ToUInt16(data, offset);
            offset += 2 + idListSize;
        }

        if (offset + 28 > data.Length) return null;
        var linkInfoSize = BitConverter.ToInt32(data, offset);
        var linkInfoHeaderSize = BitConverter.ToInt32(data, offset + 4);
        var linkInfoFlags = BitConverter.ToUInt32(data, offset + 8);

        if (linkInfoSize <= 0 || offset + linkInfoSize > data.Length) return null;
        var volumeIdAndLocalBasePathPresent = (linkInfoFlags & 0x01) != 0;
        if (!volumeIdAndLocalBasePathPresent) return null;

        // Prefer Unicode LocalBasePathOffsetUnicode if LinkInfoHeaderSize >= 0x24
        if (linkInfoHeaderSize >= 0x24 && offset + 0x20 <= data.Length)
        {
            var unicodeLocalBaseOffset = BitConverter.ToInt32(data, offset + 0x1C);
            if (unicodeLocalBaseOffset > 0 && offset + unicodeLocalBaseOffset < data.Length)
            {
                return ReadNullTerminatedUnicode(data, offset + unicodeLocalBaseOffset);
            }
        }

        var localBasePathOffset = BitConverter.ToInt32(data, offset + 16);
        if (localBasePathOffset > 0 && offset + localBasePathOffset < data.Length)
        {
            return ReadNullTerminatedAnsi(data, offset + localBasePathOffset);
        }

        return null;
    }

    private static string? ReadNullTerminatedAnsi(byte[] data, int start)
    {
        var end = Array.IndexOf(data, (byte)0, start);
        if (end <= start) return null;
        return Encoding.Default.GetString(data, start, end - start).Trim();
    }

    private static string? ReadNullTerminatedUnicode(byte[] data, int start)
    {
        var sb = new StringBuilder();
        for (var i = start; i + 1 < data.Length; i += 2)
        {
            var ch = BitConverter.ToChar(data, i);
            if (ch == '\0') break;
            sb.Append(ch);
        }
        var result = sb.ToString().Trim();
        return result.Length > 0 ? result : null;
    }

    [GeneratedRegex(@"""path""\s+""([^""]+)""", RegexOptions.IgnoreCase)]
    private static partial Regex SteamLibraryPathRegex();

    [GeneratedRegex(@"^\s*""([^""]+)""\s+""([^""]*)""", RegexOptions.Multiline)]
    private static partial Regex AcfKeyValueRegex();
}
