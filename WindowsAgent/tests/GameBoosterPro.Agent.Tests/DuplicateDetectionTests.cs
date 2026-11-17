using GameBoosterPro.Agent.Models;
using GameBoosterPro.Agent.Services;
using Xunit;

namespace GameBoosterPro.Agent.Tests;

public sealed class DuplicateDetectionTests
{
    [Fact]
    public void DeduplicateGames_RemovesDuplicateExecutablePathsRegardlessOfCasingOrTrailingSlash()
    {
        var games = new[]
        {
            MakeGame("steam_730", "Counter-Strike 2", @"D:\Games\CS2\cs2.exe", "Steam"),
            MakeGame("lnk_cs2", "CS 2 Shortcut", @"d:\games\cs2\cs2.exe", "Standalone"),
        };

        var deduped = GameScannerService.DeduplicateGames(games);

        Assert.Single(deduped);
        Assert.Equal("steam_730", deduped[0].Id);
    }

    [Fact]
    public void DeduplicateGames_RemovesDuplicateNormalizedTitlesAcrossSources()
    {
        var games = new[]
        {
            MakeGame("epic_rl", "Rocket League", @"C:\Program Files\Epic Games\rocketleague\RocketLeague.exe", "Epic Games"),
            MakeGame("reg_rl", "Rocket-League!", string.Empty, "Standalone"),
        };

        var deduped = GameScannerService.DeduplicateGames(games);

        Assert.Single(deduped);
        Assert.Equal("epic_rl", deduped[0].Id);
    }

    private static InstalledGame MakeGame(string id, string title, string exePath, string launcher) =>
        new(
            Id: id,
            Title: title,
            Version: null,
            CoverImageUrl: null,
            ExecutableName: string.IsNullOrEmpty(exePath) ? "غير محدد" : Path.GetFileName(exePath),
            ExecutablePath: exePath,
            InstallPath: string.IsNullOrEmpty(exePath) ? string.Empty : Path.GetDirectoryName(exePath)!,
            DetectedGpu: "NVIDIA GeForce MX250",
            Launcher: launcher,
            SizeGb: 25,
            LastPlayed: null,
            Compatibility: "optimal",
            EstimatedFpsRange: "60 FPS",
            RecommendedResolution: "1280×720",
            VramRequirementMb: 1200,
            IsOptimizedProfileActive: false,
            IsManualEntry: false,
            SafetyNoteAr: "Read-only"
        );
}
