using GameBoosterPro.Agent.Models;
using GameBoosterPro.Agent.Services;
using Xunit;

namespace GameBoosterPro.Agent.Tests;

public sealed class HardwareModelsTests
{
    [Fact]
    public void EvaluateGamingReadiness_Flags2GbVramLimit_ForMx250Profile()
    {
        var cpu = new CpuHardwareInfo("Intel(R) Core(TM) i7-10610U CPU @ 1.80GHz", 4, 8, 2.3, null, "detected");
        var ram = new MemoryHardwareInfo(16.0, 9.4, 2666, "Dual Channel", "detected");
        var gpu = new GpuHardwareInfo("NVIDIA GeForce MX250", "Intel(R) UHD Graphics", 2048, "551.86", "detected");

        var readiness = HardwareDetectionService.EvaluateGamingReadiness(cpu, ram, gpu);

        Assert.Equal("esports_and_light", readiness.Tier);
        Assert.True(readiness.VramLimitWarning);
        Assert.Contains("2048 MB", readiness.BottleneckNoteAr);
    }

    [Fact]
    public void EvaluateGamingReadiness_HandlesUnavailableGpuMetrics_WithoutInventingValues()
    {
        var cpu = new CpuHardwareInfo(null, null, 8, null, null, "unavailable");
        var ram = new MemoryHardwareInfo(null, null, null, null, "unavailable");
        var gpu = new GpuHardwareInfo(null, null, null, null, "unavailable");

        var readiness = HardwareDetectionService.EvaluateGamingReadiness(cpu, ram, gpu);

        Assert.Equal("cloud_recommended", readiness.Tier);
        Assert.True(readiness.VramLimitWarning);
    }

    [Fact]
    public void PerformanceSample_AllowsNullForUnavailableSensors()
    {
        var sample = new PerformanceSample(
            Timestamp: "12:00:00",
            CpuUsagePercent: 22.5,
            CpuClockGhz: null,
            CpuTempCelsius: null,
            RamUsedGb: 6.4,
            RamTotalGb: 16.0,
            GpuUsagePercent: null,
            VramUsedMb: null,
            VramTotalMb: 2048,
            GpuTempCelsius: null,
            ActiveGameProcess: null,
            Fps: null,
            FrameTimeMs: null
        );

        Assert.Null(sample.CpuTempCelsius);
        Assert.Null(sample.GpuTempCelsius);
        Assert.Null(sample.Fps);
        Assert.Equal(22.5, sample.CpuUsagePercent);
    }
}
