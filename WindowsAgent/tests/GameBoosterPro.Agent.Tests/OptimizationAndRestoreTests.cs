using GameBoosterPro.Agent.Configuration;
using GameBoosterPro.Agent.Models;
using GameBoosterPro.Agent.Services;
using Microsoft.Extensions.Options;
using Xunit;

namespace GameBoosterPro.Agent.Tests;

public sealed class OptimizationAndRestoreTests
{
    private static HardwareProfile CreateTestHardware() =>
        new(
            DeviceName: "TEST-LAPTOP",
            OsName: "Windows 11 Pro",
            OsBuild: "23H2",
            PowerSource: "AC",
            ActivePowerPlan: "متوازن (Balanced)",
            Cpu: new CpuHardwareInfo("Intel Core i7-10610U", 4, 8, 1.8, 4.9, "detected"),
            Memory: new MemoryHardwareInfo(16.0, 9.2, 2666, "Dual Channel", "detected"),
            Gpu: new GpuHardwareInfo("NVIDIA GeForce MX250", "Intel UHD Graphics", 2048, "551.86", "detected"),
            Storage: new StorageHardwareInfo("NVMe SSD", 140, 512, []),
            Network: new NetworkHardwareInfo("Wi-Fi", null, null, "adapter_detected"),
            GamingReadiness: new GamingReadinessInfo("esports_and_light", "Ready", "2GB VRAM", true)
        );

    [Fact]
    public void AnalyzeAndPreview_NeverModifyGameFilesOrSecurity_AndIncludeRiskAndReversibility()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"gbp_opt_{Guid.NewGuid():N}");
        var options = Options.Create(new AgentOptions { DataDirectory = tempDir, AllowSystemChanges = false });
        var service = new OptimizationService(options, new AuditLogger(options));
        var hw = CreateTestHardware();

        var analysis = service.Analyze(hw, null);
        Assert.All(analysis.SystemTweaks, t =>
        {
            Assert.True(t.Reversible);
            Assert.False(t.ModifiesGameFiles);
            Assert.False(t.AffectsSecurityServices);
            Assert.False(string.IsNullOrWhiteSpace(t.ExpectedImpactAr));
            Assert.False(string.IsNullOrWhiteSpace(t.RiskNoteAr));
        });

        var preview = service.CreatePreview(hw, null, ["tweak_power_plan", "malicious_tweak"]);
        Assert.Single(preview.Changes);
        Assert.Equal("tweak_power_plan", preview.Changes[0].TweakId);
        Assert.True(preview.SafetyChecks.OriginalGameFilesUntouched);
        Assert.True(preview.SafetyChecks.WindowsSecurityUntouched);
        Assert.True(preview.SafetyChecks.UserConfirmationRequired);

        Directory.Delete(tempDir, recursive: true);
    }

    [Fact]
    public async Task ApplyAsync_RequiresExplicitConfirmationAndValidPreviewId()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"gbp_apply_{Guid.NewGuid():N}");
        var options = Options.Create(new AgentOptions { DataDirectory = tempDir, AllowSystemChanges = true });
        var service = new OptimizationService(options, new AuditLogger(options));
        var hw = CreateTestHardware();

        var preview = service.CreatePreview(hw, null, ["tweak_bg_apps"]);

        // 1. Missing explicit confirmation must fail
        var (okNoConfirm, _, errCode1, _) = await service.ApplyAsync(
            new OptimizationApplyRequest(preview.PreviewId, ["tweak_bg_apps"], null, ExplicitUserConfirmation: false),
            null
        );
        Assert.False(okNoConfirm);
        Assert.Equal("CONFIRMATION_REQUIRED", errCode1);

        // 2. Disallowed tweak must fail
        var (okDisallowed, _, errCode2, _) = await service.ApplyAsync(
            new OptimizationApplyRequest(preview.PreviewId, ["disable_defender"], null, ExplicitUserConfirmation: true),
            null
        );
        Assert.False(okDisallowed);
        Assert.Equal("DISALLOWED_TWEAK", errCode2);

        // 3. Invalid preview ID must fail
        var (okBadPreview, _, errCode3, _) = await service.ApplyAsync(
            new OptimizationApplyRequest("prev_does_not_exist", ["tweak_bg_apps"], null, ExplicitUserConfirmation: true),
            null
        );
        Assert.False(okBadPreview);
        Assert.Equal("INVALID_PREVIEW_ID", errCode3);

        // 4. Valid preview + explicit confirmation + safe tweak creates backup snapshot & succeeds
        var (okValid, applyRes, _, _) = await service.ApplyAsync(
            new OptimizationApplyRequest(preview.PreviewId, ["tweak_bg_apps"], null, ExplicitUserConfirmation: true),
            null
        );
        Assert.True(okValid);
        Assert.NotNull(applyRes);
        Assert.True(File.Exists(Path.Combine(tempDir, "backups", $"{applyRes.BackupSnapshotId}.json")));

        // 5. Restore succeeds and references the created snapshot
        var (okRestore, restoreRes, _) = await service.RestoreLatestAsync();
        Assert.True(okRestore);
        Assert.NotNull(restoreRes);
        Assert.Equal(applyRes.BackupSnapshotId, restoreRes.RestoredFromSnapshotId);

        Directory.Delete(tempDir, recursive: true);
    }
}
