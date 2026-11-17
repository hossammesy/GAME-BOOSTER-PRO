using System.Diagnostics;
using System.Runtime.Versioning;
using System.Text.Json;
using GameBoosterPro.Agent.Configuration;
using GameBoosterPro.Agent.Models;
using GameBoosterPro.Agent.Security;
using Microsoft.Extensions.Options;
using Microsoft.Win32;

namespace GameBoosterPro.Agent.Services;

public interface IOptimizationService
{
    OptimizationAnalysisResponse Analyze(HardwareProfile hardware, InstalledGame? targetGame);
    OptimizationPreviewResponse CreatePreview(HardwareProfile hardware, InstalledGame? targetGame, IReadOnlyList<string> tweakIds);
    Task<(bool Success, OptimizationApplyResponse? Response, string? ErrorCode, string? ErrorAr)> ApplyAsync(
        OptimizationApplyRequest request,
        InstalledGame? targetGame);
    Task<(bool Success, OptimizationRestoreResponse? Response, string? ErrorAr)> RestoreLatestAsync();
}

[SupportedOSPlatform("windows")]
public sealed class OptimizationService : IOptimizationService
{
    private readonly AgentOptions _options;
    private readonly IAuditLogger _auditLogger;
    private readonly string _backupsDirectory;
    private readonly Dictionary<string, (OptimizationPreviewResponse Preview, InstalledGame? Game)> _pendingPreviews = new();
    private readonly object _lock = new();

    private const string HighPerformanceGuid = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
    private const string BalancedGuid = "381b4222-f694-41f0-9685-ff5bb260df2e";

    public OptimizationService(IOptions<AgentOptions> options, IAuditLogger auditLogger)
    {
        _options = options.Value;
        _auditLogger = auditLogger;
        _backupsDirectory = Path.Combine(_options.DataDirectory, "backups");
        Directory.CreateDirectory(_backupsDirectory);
    }

    public OptimizationAnalysisResponse Analyze(HardwareProfile hardware, InstalledGame? targetGame)
    {
        var targetName = targetGame?.Title ?? "الإعداد العام للجهاز";
        var vramMb = hardware.Gpu.VramTotalMb ?? 0;
        var ramGb = hardware.Memory.TotalGb ?? 0;

        var tweaks = new List<SystemTweakItem>
        {
            new(
                Id: "tweak_power_plan",
                TitleAr: "تفعيل خطة الطاقة: أداء عالٍ (High Performance)",
                DescriptionAr: "يمنع تقليص تردد المعالج أثناء اللعب عند توصيل الشاحن عبر PowerCfg دون تعديل الجهد أو BIOS.",
                Scope: "power_plan",
                CurrentValueAr: hardware.ActivePowerPlan,
                RecommendedValueAr: "أداء عالٍ (High Performance)",
                ExpectedImpactAr: "يحسّن استقرار تردد المعالج ويقلل التذبذب أثناء الحمل، دون ضمان رقم محدد للـ FPS.",
                RiskLevel: "low",
                RiskNoteAr: "مخاطرة منخفضة: استهلاك طاقة وحرارة أعلى قليلاً عند التشغيل على البطارية.",
                RequiresAdministrator: false,
                Reversible: true,
                ModifiesGameFiles: false,
                AffectsSecurityServices: false,
                SelectedByDefault: true
            ),
            new(
                Id: "tweak_gpu_pref",
                TitleAr: "تفضيل بطاقة الرسوميات المخصصة في إعدادات ويندوز",
                DescriptionAr: "يسجل تفضيل الأداء العالي (GpuPreference=2) في سجل مستخدم ويندوز HKCU فقط دون لمس ملفات EXE أو DLL.",
                Scope: "windows_gpu_preference",
                CurrentValueAr: "قرار النظام التلقائي",
                RecommendedValueAr: $"أداء عالٍ ({hardware.Gpu.PrimaryModel ?? "Discrete GPU"})",
                ExpectedImpactAr: "يمنع تشغيل اللعبة على معالج الرسوميات المدمج عندما تكون البطاقة المخصصة متاحة.",
                RiskLevel: "none",
                RiskNoteAr: "بدون مخاطرة: إعداد رسمي في Windows Graphics Settings وقابل للإزالة.",
                RequiresAdministrator: false,
                Reversible: true,
                ModifiesGameFiles: false,
                AffectsSecurityServices: false,
                SelectedByDefault: targetGame is not null && !string.IsNullOrWhiteSpace(targetGame.ExecutablePath)
            ),
            new(
                Id: "tweak_game_mode",
                TitleAr: "تفعيل وضع الألعاب في ويندوز 11 (Windows Game Mode)",
                DescriptionAr: "يفعّل AutoGameModeEnabled في سجل المستخدم لتقليل مهام الخلفية المجدولة أثناء اللعب.",
                Scope: "game_mode",
                CurrentValueAr: ReadAutoGameModeEnabled() == 1 ? "مفعّل" : "غير مفعّل / افتراضي",
                RecommendedValueAr: "مفعّل",
                ExpectedImpactAr: "قد يقلل مقاطعات تحديثات ويندوز في الخلفية أثناء اللعب.",
                RiskLevel: "none",
                RiskNoteAr: "بدون مخاطرة: ميزة أصلية في نظام Windows 11.",
                RequiresAdministrator: false,
                Reversible: true,
                ModifiesGameFiles: false,
                AffectsSecurityServices: false,
                SelectedByDefault: true
            ),
            new(
                Id: "tweak_bg_apps",
                TitleAr: "تنبيه التطبيقات الخلفية المستهلكة للذاكرة (إرشادي/اختياري)",
                DescriptionAr: "إغلاق التطبيقات غير الأساسية المفتوحة طوعياً مثل المتصفحات لتحرير RAM دون المساس ببرامج الحماية.",
                Scope: "background_apps",
                CurrentValueAr: $"الذاكرة المتاحة حالياً: {hardware.Memory.AvailableGb?.ToString("0.0") ?? "غير متاح"} GB",
                RecommendedValueAr: "إبقاء أكثر من 6 GB متاحة قبل اللعب",
                ExpectedImpactAr: "يقلل الحاجة إلى ملف التبديل (Pagefile) على القرص.",
                RiskLevel: "low",
                RiskNoteAr: "مخاطرة منخفضة: يجب حفظ عملك في المتصفحات قبل الإغلاق.",
                RequiresAdministrator: false,
                Reversible: true,
                ModifiesGameFiles: false,
                AffectsSecurityServices: false,
                SelectedByDefault: false
            )
        };

        var resolutionRec = vramMb is > 0 and <= 2048 ? "1280×720 أو 1600×900" : "1920×1080";
        var advisory = new List<AdvisoryGameSetting>
        {
            new("دقة العرض (Resolution)", "1920×1080", resolutionRec, "يقلل الضغط على ذاكرة VRAM وملء الشاشة", "تطبيق يدوي داخل اللعبة فقط؛ لا يمس ملفات INI/CFG."),
            new("جودة الخامات (Textures)", "High", vramMb is > 0 and <= 2048 ? "Low أو Normal" : "Medium/High", "ضروري لتفادي تجاوز سعة 2GB VRAM", "تأثير بصري طفيف مقابل تقليل التقطيع المفاجئ."),
            new("الظلال (Shadows)", "High", "Low", "يخفف حمل التظليل على المعالج الرسومي", "تطبيق يدوي داخل قائمة اللعبة دون مخاطرة."),
            new("مضاد التعرج (Anti-Aliasing)", "MSAA / TAA High", "FXAA أو Off", "يوفر موارد عرض مهمة على الشرائح الاقتصادية", "تطبيق يدوي داخل قائمة اللعبة دون مخاطرة.")
        };

        var summary = $"تحليل {targetName} بناءً على العتاد المكتشف ({hardware.Cpu.Model ?? "CPU غير محدد"} · {ramGb} GB RAM · {hardware.Gpu.PrimaryModel ?? "GPU غير محدد"} {vramMb} MB VRAM). التوصيات تقديرية ولا تضمن رقماً محدداً للإطارات.";

        _ = _auditLogger.LogOperationAsync("optimization_analyze", "success", new { targetGameId = targetGame?.Id });

        return new OptimizationAnalysisResponse(
            AnalyzedAt: DateTimeOffset.UtcNow.ToString("O"),
            TargetGameId: targetGame?.Id,
            TargetGameTitle: targetGame?.Title,
            HardwareSummaryAr: summary,
            SystemTweaks: tweaks,
            AdvisoryInGameSettings: advisory,
            ProtectedServicesNoticeAr: "سياسة الأمان: لن يتم تعديل أي ملف EXE أو DLL أو CFG أو INI أو ملفات موارد اللعبة، ولن يتم إيقاف Windows Defender أو مضاد الفيروسات أو الخدمات الأساسية."
        );
    }

    public OptimizationPreviewResponse CreatePreview(
        HardwareProfile hardware,
        InstalledGame? targetGame,
        IReadOnlyList<string> tweakIds)
    {
        var analysis = Analyze(hardware, targetGame);
        var validIds = tweakIds.Where(SafetyPolicyGuard.IsAllowedTweakId).Distinct().ToList();
        var changes = new List<OptimizationChangeDiff>();

        foreach (var id in validIds)
        {
            var item = analysis.SystemTweaks.FirstOrDefault(t => t.Id == id);
            if (item is null) continue;

            var registryTarget = id switch
            {
                "tweak_power_plan" => "PowerCfg /SetActiveScheme (GUID_MIN_POWER_SAVINGS / High Performance)",
                "tweak_gpu_pref" => @"HKCU\Software\Microsoft\DirectX\UserGpuPreferences",
                "tweak_game_mode" => @"HKCU\Software\Microsoft\GameBar\AutoGameModeEnabled",
                _ => "Advisory Memory Guidance Only (No Automated Process Kill)"
            };

            changes.Add(new OptimizationChangeDiff(
                TweakId: item.Id,
                TitleAr: item.TitleAr,
                BeforeValueAr: item.CurrentValueAr,
                AfterValueAr: item.RecommendedValueAr,
                RegistryOrApiTarget: registryTarget,
                RequiresAdministrator: item.RequiresAdministrator,
                IsReversible: item.Reversible
            ));
        }

        var previewId = $"prev_{Guid.NewGuid():N}"[..16];
        var snapshotId = $"snap_{DateTimeOffset.UtcNow:yyyyMMdd_HHmmss}";

        var preview = new OptimizationPreviewResponse(
            PreviewId: previewId,
            GeneratedAt: DateTimeOffset.UtcNow.ToString("O"),
            Changes: changes,
            BackupSnapshotId: snapshotId,
            SafetyChecks: new OptimizationSafetyChecks(
                OriginalGameFilesUntouched: true,
                WindowsSecurityUntouched: true,
                UserConfirmationRequired: true
            )
        );

        lock (_lock)
        {
            _pendingPreviews[previewId] = (preview, targetGame);
        }

        _ = _auditLogger.LogOperationAsync("optimization_preview", "success", new { previewId, changesCount = changes.Count });
        return preview;
    }

    public async Task<(bool Success, OptimizationApplyResponse? Response, string? ErrorCode, string? ErrorAr)> ApplyAsync(
        OptimizationApplyRequest request,
        InstalledGame? targetGame)
    {
        if (!request.ExplicitUserConfirmation)
        {
            await _auditLogger.LogOperationAsync("optimization_apply", "rejected_no_confirmation");
            return (false, null, "CONFIRMATION_REQUIRED", "يجب تأكيد المستخدم الصريح قبل تطبيق أي تغييرات على النظام.");
        }

        if (!_options.AllowSystemChanges)
        {
            await _auditLogger.LogOperationAsync("optimization_apply", "rejected_preview_only_mode");
            return (false, null, "PREVIEW_ONLY_MODE", "الوكيل يعمل حالياً في وضع التحليل والمعاينة فقط (AllowSystemChanges=false).");
        }

        if (request.TweakIds is null || request.TweakIds.Count == 0 ||
            request.TweakIds.Any(id => !SafetyPolicyGuard.IsAllowedTweakId(id)))
        {
            await _auditLogger.LogOperationAsync("optimization_apply", "rejected_disallowed_tweak", new { request.TweakIds });
            return (false, null, "DISALLOWED_TWEAK", "تم رفض الطلب: يحتوي على إجراء غير مدرج في القائمة الآمنة المعتمدة.");
        }

        OptimizationPreviewResponse? preview;
        lock (_lock)
        {
            if (!_pendingPreviews.TryGetValue(request.PreviewId, out var entry))
            {
                return (false, null, "INVALID_PREVIEW_ID", "معرف المعاينة غير صالح أو منتهي الصلاحية. أنشئ معاينة جديدة أولاً.");
            }
            preview = entry.Preview;
            targetGame ??= entry.Game;
            _pendingPreviews.Remove(request.PreviewId);
        }

        // Capture real backup snapshot BEFORE applying changes
        var prevPowerGuid = ReadActivePowerSchemeGuid();
        var prevGameMode = ReadAutoGameModeEnabled();
        string? prevGpuPref = null;
        string? gpuPrefExe = targetGame?.ExecutablePath;
        if (!string.IsNullOrWhiteSpace(gpuPrefExe))
        {
            prevGpuPref = ReadUserGpuPreference(gpuPrefExe);
        }

        var snapshot = new BackupSnapshot(
            SnapshotId: preview.BackupSnapshotId,
            CreatedAt: DateTimeOffset.UtcNow.ToString("O"),
            PreviousPowerPlanGuid: prevPowerGuid,
            PreviousAutoGameModeEnabled: prevGameMode,
            GpuPreferenceExecutablePath: gpuPrefExe,
            PreviousGpuPreferenceValue: prevGpuPref,
            AppliedTweakIds: request.TweakIds
        );

        await SaveBackupSnapshotAsync(snapshot);

        var appliedCount = 0;
        foreach (var tweakId in request.TweakIds.Distinct())
        {
            switch (tweakId)
            {
                case "tweak_power_plan":
                    if (TrySetActivePowerScheme(HighPerformanceGuid)) appliedCount++;
                    break;
                case "tweak_game_mode":
                    WriteAutoGameModeEnabled(1);
                    appliedCount++;
                    break;
                case "tweak_gpu_pref":
                    if (!string.IsNullOrWhiteSpace(gpuPrefExe) &&
                        SafetyPolicyGuard.ValidateWindowsExecutablePath(gpuPrefExe).IsValid)
                    {
                        WriteUserGpuPreference(gpuPrefExe, "GpuPreference=2;");
                        appliedCount++;
                    }
                    break;
                case "tweak_bg_apps":
                    // Advisory/safe-no-op: never force-kill user apps automatically without process-level confirmation
                    appliedCount++;
                    break;
            }
        }

        await _auditLogger.LogOperationAsync("optimization_apply", "applied", new
        {
            snapshot.SnapshotId,
            appliedCount,
            tweakIds = request.TweakIds
        });

        return (true, new OptimizationApplyResponse(
            AppliedAt: DateTimeOffset.UtcNow.ToString("O"),
            BackupSnapshotId: snapshot.SnapshotId,
            AppliedCount: appliedCount,
            Status: "applied",
            MessageAr: "تم تطبيق التعديلات الآمنة على مستوى إعدادات ويندوز فقط وحفظ نسخة احتياطية للاستعادة، دون المساس بملفات الألعاب أو خدمات الأمان."
        ), null, null);
    }

    public async Task<(bool Success, OptimizationRestoreResponse? Response, string? ErrorAr)> RestoreLatestAsync()
    {
        var latestFile = Directory.EnumerateFiles(_backupsDirectory, "snap_*.json")
            .OrderByDescending(f => f)
            .FirstOrDefault();

        if (latestFile is null)
        {
            TrySetActivePowerScheme(BalancedGuid);
            await _auditLogger.LogOperationAsync("optimization_restore", "restored_default_fallback");
            return (true, new OptimizationRestoreResponse(
                RestoredAt: DateTimeOffset.UtcNow.ToString("O"),
                RestoredFromSnapshotId: null,
                Status: "restored",
                MessageAr: "لم تُرصد نسخة احتياطية سابقة؛ تمت إعادة خطة الطاقة إلى الوضع المتوازن الافتراضي."
            ), null);
        }

        var json = await File.ReadAllTextAsync(latestFile);
        var snapshot = JsonSerializer.Deserialize<BackupSnapshot>(json);
        if (snapshot is null)
        {
            return (false, null, "تعذر قراءة ملف النسخة الاحتياطية للاستعادة.");
        }

        if (!string.IsNullOrWhiteSpace(snapshot.PreviousPowerPlanGuid))
        {
            TrySetActivePowerScheme(snapshot.PreviousPowerPlanGuid);
        }

        if (snapshot.PreviousAutoGameModeEnabled.HasValue)
        {
            WriteAutoGameModeEnabled(snapshot.PreviousAutoGameModeEnabled.Value);
        }

        if (!string.IsNullOrWhiteSpace(snapshot.GpuPreferenceExecutablePath))
        {
            if (snapshot.PreviousGpuPreferenceValue is null)
            {
                DeleteUserGpuPreference(snapshot.GpuPreferenceExecutablePath);
            }
            else
            {
                WriteUserGpuPreference(snapshot.GpuPreferenceExecutablePath, snapshot.PreviousGpuPreferenceValue);
            }
        }

        await _auditLogger.LogOperationAsync("optimization_restore", "restored", new { snapshot.SnapshotId });

        return (true, new OptimizationRestoreResponse(
            RestoredAt: DateTimeOffset.UtcNow.ToString("O"),
            RestoredFromSnapshotId: snapshot.SnapshotId,
            Status: "restored",
            MessageAr: $"تمت استعادة إعدادات ويندوز السابقة من النسخة الاحتياطية {snapshot.SnapshotId} بنجاح."
        ), null);
    }

    private async Task SaveBackupSnapshotAsync(BackupSnapshot snapshot)
    {
        var filePath = Path.Combine(_backupsDirectory, $"{snapshot.SnapshotId}.json");
        var json = JsonSerializer.Serialize(snapshot, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(filePath, json);
    }

    private static string? ReadActivePowerSchemeGuid()
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes");
            return key?.GetValue("ActivePowerScheme")?.ToString();
        }
        catch { return null; }
    }

    private static bool TrySetActivePowerScheme(string guid)
    {
        if (!Guid.TryParse(guid, out var parsed)) return false;
        try
        {
            using var proc = Process.Start(new ProcessStartInfo
            {
                FileName = "powercfg.exe",
                Arguments = $"/setactive {parsed:D}",
                CreateNoWindow = true,
                UseShellExecute = false
            });
            proc?.WaitForExit(3000);
            return proc?.ExitCode == 0;
        }
        catch { return false; }
    }

    private static int? ReadAutoGameModeEnabled()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\GameBar");
            var val = key?.GetValue("AutoGameModeEnabled");
            return val is int i ? i : null;
        }
        catch { return null; }
    }

    private static void WriteAutoGameModeEnabled(int value)
    {
        using var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\GameBar");
        key.SetValue("AutoGameModeEnabled", value, RegistryValueKind.DWord);
    }

    private static string? ReadUserGpuPreference(string exePath)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\DirectX\UserGpuPreferences");
            return key?.GetValue(exePath)?.ToString();
        }
        catch { return null; }
    }

    private static void WriteUserGpuPreference(string exePath, string value)
    {
        using var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\DirectX\UserGpuPreferences");
        key.SetValue(exePath, value, RegistryValueKind.String);
    }

    private static void DeleteUserGpuPreference(string exePath)
    {
        using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\DirectX\UserGpuPreferences", writable: true);
        key?.DeleteValue(exePath, throwOnMissingValue: false);
    }
}
