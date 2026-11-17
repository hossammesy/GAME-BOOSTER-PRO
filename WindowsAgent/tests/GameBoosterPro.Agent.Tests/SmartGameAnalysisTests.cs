using GameBoosterPro.Agent.Configuration;
using GameBoosterPro.Agent.Models;
using GameBoosterPro.Agent.Services;
using Microsoft.Extensions.Options;
using Xunit;

namespace GameBoosterPro.Agent.Tests;

public sealed class SmartGameAnalysisTests
{
    private static HardwareProfile CreateMx250Hardware(int? vramTotalMb = 2048, double? totalRamGb = 16.0) =>
        new(
            DeviceName: "WIN11-TEST-MX250",
            OsName: "Windows 11 Pro",
            OsBuild: "23H2",
            PowerSource: "AC",
            ActivePowerPlan: "متوازن (Balanced)",
            Cpu: new CpuHardwareInfo("Intel Core i7-10610U", 4, 8, 1.8, 4.9, "detected"),
            Memory: new MemoryHardwareInfo(totalRamGb, 9.5, 2666, "Dual Channel", "detected"),
            Gpu: new GpuHardwareInfo("NVIDIA GeForce MX250", "Intel UHD Graphics", vramTotalMb, "551.86", "detected"),
            Storage: new StorageHardwareInfo("NVMe SSD", 148, 512, []),
            Network: new NetworkHardwareInfo("Wi-Fi 5GHz", 22, 38, "detected"),
            GamingReadiness: new GamingReadinessInfo("esports_and_light", "Ready for esports", "2GB VRAM limit", true)
        );

    private static InstalledGame CreateGame(string id, string title, string exePath) =>
        new(
            Id: id,
            Title: title,
            Version: "1.0.0",
            CoverImageUrl: null,
            ExecutableName: Path.GetFileName(exePath),
            ExecutablePath: exePath,
            InstallPath: Path.GetDirectoryName(exePath) ?? "C:\\Games",
            DetectedGpu: "NVIDIA GeForce MX250",
            Launcher: "Steam",
            SizeGb: 40,
            LastPlayed: null,
            Compatibility: "unknown",
            EstimatedFpsRange: "",
            RecommendedResolution: "1280×720",
            VramRequirementMb: 0,
            IsOptimizedProfileActive: false,
            IsManualEntry: false,
            SafetyNoteAr: "Test entry"
        );

    private static SmartGameAnalysisService CreateService(out string tempDir)
    {
        tempDir = Path.Combine(Path.GetTempPath(), $"gbp_smart_{Guid.NewGuid():N}");
        var options = Options.Create(new AgentOptions { DataDirectory = tempDir });
        return new SmartGameAnalysisService(new AuditLogger(options));
    }

    [Fact]
    public void AnalyzeGame_UnsupportedHeavyGameOn2GbVram_ReturnsNotRecommendedAndCloudSuggestion()
    {
        var service = CreateService(out var tempDir);
        var hw = CreateMx250Hardware(vramTotalMb: 2048);
        var game = CreateGame("cp2077", "Cyberpunk 2077", @"D:\Games\Cyberpunk 2077\Cyberpunk2077.exe");

        var result = service.AnalyzeGame(game, hw, null);

        Assert.Equal("not_recommended", result.Compatibility);
        Assert.Equal("verified_metadata", result.Requirements.Status);
        Assert.Equal(6144, result.Requirements.MinVramMb);
        Assert.False(result.FpsRangeSupported);
        Assert.Null(result.EvidenceBasedFpsRangeAr);
        Assert.True(result.CloudAssessment.RecommendedInCloud);
        Assert.False(result.CloudAssessment.IsCloudHardwareConnected);

        Directory.Delete(tempDir, recursive: true);
    }

    [Fact]
    public void AnalyzeGame_MinimumOnlyGameOn2GbVram_ReturnsLimited()
    {
        var service = CreateService(out var tempDir);
        var hw = CreateMx250Hardware(vramTotalMb: 2048);
        var game = CreateGame("ets2", "Euro Truck Simulator 2", @"C:\Games\ETS2\eurotrucks2.exe");

        var result = service.AnalyzeGame(game, hw, null);

        Assert.Equal("limited", result.Compatibility);
        Assert.True(result.FpsRangeSupported);
        Assert.NotNull(result.EvidenceBasedFpsRangeAr);

        Directory.Delete(tempDir, recursive: true);
    }

    [Fact]
    public void AnalyzeGame_MissingRequirements_NeverGuessesAndReturnsUnknown()
    {
        var service = CreateService(out var tempDir);
        var hw = CreateMx250Hardware();
        var game = CreateGame("unlisted", "Obscure Indie Prototype 99", @"C:\Games\Prototype\proto.exe");

        var result = service.AnalyzeGame(game, hw, null);

        Assert.Equal("unknown", result.Compatibility);
        Assert.Equal("unknown", result.Requirements.Status);
        Assert.Null(result.Requirements.MinVramMb);
        Assert.Null(result.Requirements.MinRamGb);
        Assert.Null(result.Requirements.MinCpuAr);
        Assert.False(result.FpsRangeSupported);
        Assert.Null(result.EvidenceBasedFpsRangeAr);

        var fpsTarget = result.GraphicsRecommendations.Single(r => r.SettingKey == "fps_target");
        Assert.Equal("unknown", fpsTarget.Basis);

        Directory.Delete(tempDir, recursive: true);
    }

    [Fact]
    public void AnalyzeGame_MissingHardwareVramSensor_ReturnsUnknownCompatibility()
    {
        var service = CreateService(out var tempDir);
        var hw = CreateMx250Hardware(vramTotalMb: null);
        var game = CreateGame("valorant", "VALORANT", @"C:\Riot Games\VALORANT\VALORANT.exe");

        var result = service.AnalyzeGame(game, hw, null);

        Assert.Equal("unknown", result.Compatibility);
        Assert.False(result.FpsRangeSupported);
        Assert.Null(result.EvidenceBasedFpsRangeAr);

        Directory.Delete(tempDir, recursive: true);
    }

    [Fact]
    public void AnalyzeGame_LightEsportsGame_ReturnsAllEightGraphicsSettingsWithVerifiedVsEstimateDistinction()
    {
        var service = CreateService(out var tempDir);
        var hw = CreateMx250Hardware(vramTotalMb: 2048, totalRamGb: 16.0);
        var game = CreateGame("valorant", "VALORANT", @"C:\Riot Games\VALORANT\VALORANT.exe");

        var result = service.AnalyzeGame(game, hw, null);

        Assert.Equal("excellent", result.Compatibility);
        Assert.Equal(8, result.GraphicsRecommendations.Count);

        var expectedKeys = new[]
        {
            "resolution",
            "textures",
            "shadows",
            "anti_aliasing",
            "effects",
            "view_distance",
            "vsync",
            "fps_target"
        };
        foreach (var key in expectedKeys)
        {
            Assert.Contains(result.GraphicsRecommendations, r => r.SettingKey == key);
        }

        Assert.Contains(result.GraphicsRecommendations, r => r.Basis == "verified_profile");
        Assert.Contains(result.GraphicsRecommendations, r => r.Basis == "hardware_estimate");

        Directory.Delete(tempDir, recursive: true);
    }

    [Fact]
    public async Task SafeLaunchAsync_EnforcesPathSafetyMissingExeAndHonestCloudStatus()
    {
        var service = CreateService(out var tempDir);

        // 1. Injected shell characters must be blocked
        var unsafeGame = CreateGame("bad", "Bad Path", @"C:\Games\game.exe & calc.exe");
        var blocked = await service.SafeLaunchAsync(unsafeGame, new GameLaunchRequest("local"));
        Assert.False(blocked.Launched);
        Assert.Equal("blocked_safety", blocked.Status);

        // 2. Non-existent executable must report executable_not_found
        var missingGame = CreateGame("missing", "Missing Exe", Path.Combine(tempDir, "nonexistent.exe"));
        var notFound = await service.SafeLaunchAsync(missingGame, new GameLaunchRequest("local"));
        Assert.False(notFound.Launched);
        Assert.Equal("executable_not_found", notFound.Status);

        // 3. Cloud launch without connected provider must honestly return agent_required
        var validGame = CreateGame("cp2077", "Cyberpunk 2077", @"D:\Games\Cyberpunk2077.exe");
        var cloud = await service.SafeLaunchAsync(validGame, new GameLaunchRequest("cloud"));
        Assert.False(cloud.Launched);
        Assert.Equal("agent_required", cloud.Status);
        Assert.Equal("cloud", cloud.Mode);

        Directory.Delete(tempDir, recursive: true);
    }
}
