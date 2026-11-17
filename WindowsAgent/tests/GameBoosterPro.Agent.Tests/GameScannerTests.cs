using GameBoosterPro.Agent.Configuration;
using GameBoosterPro.Agent.Models;
using GameBoosterPro.Agent.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace GameBoosterPro.Agent.Tests;

public sealed class GameScannerTests
{
    [Fact]
    public void ParseSteamLibraryFoldersVdf_ExtractsAllLibraryPaths()
    {
        const string vdf = """
        "libraryfolders"
        {
            "0"
            {
                "path"      "C:\\Program Files (x86)\\Steam"
            }
            "1"
            {
                "path"      "D:\\Games\\SteamLibrary"
            }
        }
        """;

        var paths = VdfAndShortcutParsers.ParseSteamLibraryFoldersVdf(vdf);

        Assert.Equal(2, paths.Count);
        Assert.Equal(@"C:\Program Files (x86)\Steam", paths[0]);
        Assert.Equal(@"D:\Games\SteamLibrary", paths[1]);
    }

    [Fact]
    public void ParseSteamAppManifestAcf_ExtractsGameMetadata()
    {
        const string acf = """
        "AppState"
        {
            "appid"     "730"
            "name"      "Counter-Strike 2"
            "installdir" "Counter-Strike Global Offensive"
            "SizeOnDisk" "44238110720"
        }
        """;

        var parsed = VdfAndShortcutParsers.ParseSteamAppManifestAcf(acf);

        Assert.NotNull(parsed);
        Assert.Equal("730", parsed.AppId);
        Assert.Equal("Counter-Strike 2", parsed.Name);
        Assert.Equal("Counter-Strike Global Offensive", parsed.InstallDir);
        Assert.Equal(44238110720L, parsed.SizeOnDiskBytes);
    }

    [Fact]
    public void ParseEpicItemManifestJson_ExtractsInstalledGameFields()
    {
        const string json = """
        {
          "DisplayName": "Rocket League",
          "InstallLocation": "C:\\Program Files\\Epic Games\\rocketleague",
          "LaunchExecutable": "Binaries\\Win64\\RocketLeague.exe",
          "InstallSize": 28776284160
        }
        """;

        var parsed = VdfAndShortcutParsers.ParseEpicItemManifestJson(json);

        Assert.NotNull(parsed);
        Assert.Equal("Rocket League", parsed.DisplayName);
        Assert.Equal(@"C:\Program Files\Epic Games\rocketleague", parsed.InstallLocation);
        Assert.Equal(@"Binaries\Win64\RocketLeague.exe", parsed.LaunchExecutable);
    }

    [Fact]
    public void TryExtractTargetFromLnkBytes_ReturnsNullForInvalidBuffer()
    {
        var invalid = new byte[] { 1, 2, 3, 4 };
        Assert.Null(VdfAndShortcutParsers.TryExtractTargetFromLnkBytes(invalid));
    }

    [Fact]
    public void RegisterManualGame_RejectsCommandInjectionAndNonExePaths()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"gbp_test_{Guid.NewGuid():N}");
        var options = Options.Create(new AgentOptions { DataDirectory = tempDir });
        var logger = new AuditLogger(options);
        var scanner = new GameScannerService(options, logger, NullLogger<GameScannerService>.Instance);

        var (okBadExt, _, _) = scanner.RegisterManualGame(
            new ManualGameRegistrationRequest("Test", @"C:\Games\test.bat", "Standalone", null, null, null),
            "NVIDIA GeForce MX250"
        );
        var (okCmdInj, _, _) = scanner.RegisterManualGame(
            new ManualGameRegistrationRequest("Test", @"C:\Games\game.exe & calc.exe", "Standalone", null, null, null),
            "NVIDIA GeForce MX250"
        );
        var (okValid, created, _) = scanner.RegisterManualGame(
            new ManualGameRegistrationRequest("Hades", @"C:\Games\Hades\Hades.exe", "Standalone", null, 14.5, 1024),
            "NVIDIA GeForce MX250"
        );

        Assert.False(okBadExt);
        Assert.False(okCmdInj);
        Assert.True(okValid);
        Assert.NotNull(created);
        Assert.Equal("Hades.exe", created.ExecutableName);

        Directory.Delete(tempDir, recursive: true);
    }

    [Fact]
    public void TryParseXboxMicrosoftGameConfigXml_ExtractsTitleExeAndLogo()
    {
        const string xml = """
        <?xml version="1.0" encoding="utf-8"?>
        <Game configVersion="1">
          <Identity Name="Microsoft.ForzaHorizon5" Version="1.0.0.0" />
          <ExecutableList>
            <Executable Name="ForzaHorizon5.exe" Id="Game" />
          </ExecutableList>
          <ShellVisuals DefaultDisplayName="Forza Horizon 5" Square150x150Logo="Assets\Logo150.png" />
        </Game>
        """;

        var parsed = VdfAndShortcutParsers.TryParseXboxMicrosoftGameConfigXml(xml);

        Assert.NotNull(parsed);
        Assert.Equal("Forza Horizon 5", parsed.DisplayName);
        Assert.Equal("ForzaHorizon5.exe", parsed.ExecutableName);
        Assert.Equal(@"Assets\Logo150.png", parsed.LogoRelativePath);
    }

    [Fact]
    public void TryParseUrlShortcut_AndOfficialUriGuard_AllowOnlySafeLauncherUris()
    {
        const string urlShortcut = "[InternetShortcut]\nURL=steam://rungameid/730\n";
        var uri = VdfAndShortcutParsers.TryParseUrlShortcut(urlShortcut);

        Assert.Equal("steam://rungameid/730", uri);
        Assert.True(GameBoosterPro.Agent.Security.SafetyPolicyGuard.IsAllowedOfficialLaunchUri(uri));
        Assert.True(GameBoosterPro.Agent.Security.SafetyPolicyGuard.IsAllowedOfficialLaunchUri("com.epicgames.launcher://apps/Sugar?action=launch&silent=true"));
        Assert.False(GameBoosterPro.Agent.Security.SafetyPolicyGuard.IsAllowedOfficialLaunchUri("https://malicious.example.com/payload.exe"));
        Assert.False(GameBoosterPro.Agent.Security.SafetyPolicyGuard.IsAllowedOfficialLaunchUri("steam://rungameid/730 & calc.exe"));
    }

    [Fact]
    public void FavoritesAndCustomFolders_PersistLocallyWithoutCloudSync()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"gbp_fav_test_{Guid.NewGuid():N}");
        var fakeGamesDir = Path.Combine(tempDir, "CustomGames");
        Directory.CreateDirectory(fakeGamesDir);

        var options = Options.Create(new AgentOptions { DataDirectory = tempDir });
        var logger = new AuditLogger(options);
        var scanner = new GameScannerService(options, logger, NullLogger<GameScannerService>.Instance);

        var (_, registered, _) = scanner.RegisterManualGame(
            new ManualGameRegistrationRequest("Celeste", @"C:\Games\Celeste\Celeste.exe", "Standalone", null, null, null),
            "NVIDIA GeForce MX250"
        );
        Assert.NotNull(registered);

        scanner.SetFavorite(registered.Id, true);
        var (okFolder, folders, _) = scanner.AddCustomFolder(fakeGamesDir);
        Assert.True(okFolder);
        Assert.Contains(fakeGamesDir, folders);

        var fetched = scanner.GetCachedOrManualGames().Single(g => g.Id == registered.Id);
        Assert.True(fetched.IsFavorite);

        Directory.Delete(tempDir, recursive: true);
    }

    [Fact]
    public void LocalDatabaseService_PersistsGamesSettingsFoldersAndMigratesLegacyJson()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"gbp_sqlite_{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempDir);

        // Seed a legacy custom_folders.json before initializing SQLite
        File.WriteAllText(
            Path.Combine(tempDir, "custom_folders.json"),
            """["D:\\MyCustomGames"]"""
        );

        var options = Options.Create(new AgentOptions { DataDirectory = tempDir });
        var db = new LocalDatabaseService(options);

        Assert.True(File.Exists(db.DatabasePath));
        Assert.Contains(@"D:\MyCustomGames", db.GetCustomFolders());

        db.UpsertSettings(new Dictionary<string, string>
        {
            ["theme"] = "dark",
            ["language"] = "ar",
            ["networkTier"] = "medium_10_30"
        });

        var settings = db.GetAllSettings();
        Assert.Equal("dark", settings["theme"]);
        Assert.Equal("ar", settings["language"]);

        var logger = new AuditLogger(options);
        var scanner = new GameScannerService(options, logger, NullLogger<GameScannerService>.Instance, db);
        var (_, created, _) = scanner.RegisterManualGame(
            new ManualGameRegistrationRequest("Inside", @"C:\Games\Inside\Inside.exe", "Standalone", null, 3.2, 1024),
            "NVIDIA GeForce MX250"
        );
        Assert.NotNull(created);

        var (updatedOk, updatedGame, _) = scanner.UpdateManualGame(
            created.Id,
            new ManualGameRegistrationRequest("INSIDE Definitive", @"D:\Games\Inside\Inside.exe", "Steam", "NVIDIA GeForce MX250", 3.5, 1024),
            "NVIDIA GeForce MX250"
        );
        Assert.True(updatedOk);
        Assert.NotNull(updatedGame);
        Assert.Equal("INSIDE Definitive", updatedGame.Title);
        Assert.Equal("Steam", updatedGame.Launcher);
        Assert.Equal(@"D:\Games\Inside\Inside.exe", updatedGame.ExecutablePath);

        var stamp = scanner.RecordLastPlayed(created.Id);
        Assert.False(string.IsNullOrWhiteSpace(stamp));
        Assert.Equal(stamp, db.GetGameById(created.Id)?.LastPlayed);

        Assert.True(scanner.RemoveManualGame(created.Id));
        Assert.Null(db.GetGameById(created.Id));

        Directory.Delete(tempDir, recursive: true);
    }

    [Fact]
    public void BrowseFileSystem_ListsDirectoriesAndExes_AndRejectsUnsafePaths()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"gbp_browse_{Guid.NewGuid():N}");
        var subDir = Path.Combine(tempDir, "GameSub");
        Directory.CreateDirectory(subDir);
        File.WriteAllText(Path.Combine(tempDir, "launcher.exe"), "stub");
        File.WriteAllText(Path.Combine(tempDir, "readme.txt"), "ignore");

        var options = Options.Create(new AgentOptions { DataDirectory = tempDir });
        var logger = new AuditLogger(options);
        var scanner = new GameScannerService(options, logger, NullLogger<GameScannerService>.Instance);

        var (okBad, _, _) = scanner.BrowseFileSystem(@"C:\Games & calc.exe");
        Assert.False(okBad);

        if (OperatingSystem.IsWindows())
        {
            var (okValid, browseRes, _) = scanner.BrowseFileSystem(tempDir);
            Assert.True(okValid);
            Assert.NotNull(browseRes);
            Assert.Contains(browseRes.Entries, e => e.EntryType == "directory" && e.Name == "GameSub");
            Assert.Contains(browseRes.Entries, e => e.EntryType == "exe" && e.Name == "launcher.exe");
            Assert.DoesNotContain(browseRes.Entries, e => e.Name == "readme.txt");
        }

        Directory.Delete(tempDir, recursive: true);
    }
}
