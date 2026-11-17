using System.Diagnostics;
using System.Runtime.Versioning;
using GameBoosterPro.Agent.Models;
using GameBoosterPro.Agent.Security;

namespace GameBoosterPro.Agent.Services;

public interface ISmartGameAnalysisService
{
    SmartGameAnalysisResponse AnalyzeGame(
        InstalledGame game,
        HardwareProfile hardware,
        PerformanceSnapshotResponse? performance);

    Task<GameLaunchResponse> SafeLaunchAsync(
        InstalledGame game,
        GameLaunchRequest request);
}

internal sealed record VerifiedGameRequirementProfile(
    string CanonicalTitle,
    string SourceLabelAr,
    string MinCpuAr,
    string RecCpuAr,
    double MinRamGb,
    double RecRamGb,
    int MinVramMb,
    int RecVramMb,
    double MinStorageGb,
    string DirectXVersion,
    bool CloudRecommendedFor2GbVram,
    string ProviderSupportNoteAr
);

[SupportedOSPlatform("windows")]
public sealed class SmartGameAnalysisService : ISmartGameAnalysisService
{
    private readonly IAuditLogger _auditLogger;

    private static readonly IReadOnlyDictionary<string, VerifiedGameRequirementProfile> VerifiedCatalog =
        new Dictionary<string, VerifiedGameRequirementProfile>(StringComparer.OrdinalIgnoreCase)
        {
            ["valorant"] = new(
                "VALORANT",
                "بيانات متطلبات Riot Games الرسمية",
                "Intel Core i3-4150",
                "Intel Core i5-9400F",
                4, 4,
                1024, 1024,
                35,
                "DirectX 11",
                false,
                "متوفرة محلياً بسلاسة؛ لا تتطلب ألعاباً سحابية على MX250."
            ),
            ["leagueoflegends"] = new(
                "League of Legends",
                "بيانات متطلبات Riot Games الرسمية",
                "Intel Core i3-530",
                "Intel Core i5-3300",
                2, 4,
                512, 1024,
                16,
                "DirectX 11",
                false,
                "متوفرة على GeForce NOW لكنها تعمل محلياً بكفاءة أعلى."
            ),
            ["rocketleague"] = new(
                "Rocket League",
                "بيانات متطلبات Epic Games / Psyonix الرسمية",
                "Dual Core 2.5 GHz",
                "Quad Core 3.0+ GHz",
                4, 8,
                1024, 2048,
                20,
                "DirectX 11",
                false,
                "مدعومة على GeForce NOW وتعمل محلياً بشكل جيد على 900p/720p."
            ),
            ["counterstrike2"] = new(
                "Counter-Strike 2",
                "بيانات متطلبات Valve / Steam الرسمية",
                "4-Thread CPU (Core i5 750+)",
                "4+ Core CPU",
                8, 8,
                1024, 2048,
                85,
                "DirectX 11",
                false,
                "مدعومة على GeForce NOW؛ وتعمل محلياً بدقة 720p منخفضة عند تبريد جيد."
            ),
            ["grandtheftautov"] = new(
                "Grand Theft Auto V",
                "بيانات متطلبات Rockstar Games الرسمية",
                "Intel Core 2 Quad Q6600",
                "Intel Core i5-3470",
                4, 8,
                1024, 2048,
                110,
                "DirectX 11",
                false,
                "بعض إصداراتها متاحة عبر خوادم Windows البعيدة؛ محلياً تعمل بحد 2GB VRAM عند إبقاء الخامات Normal."
            ),
            ["eurotrucksimulator2"] = new(
                "Euro Truck Simulator 2",
                "بيانات متطلبات SCS Software الرسمية",
                "Intel Core i5-6400",
                "Intel Core i5-9600",
                8, 12,
                2048, 4096,
                25,
                "DirectX 11",
                true,
                "مدعومة على GeForce NOW؛ محلياً تقترب من حد 2GB VRAM في المدن المزدحمة."
            ),
            ["cyberpunk2077"] = new(
                "Cyberpunk 2077",
                "بيانات متطلبات CD PROJEKT RED الرسمية",
                "Intel Core i7-6700",
                "Intel Core i7-12700",
                12, 16,
                6144, 8192,
                70,
                "DirectX 12",
                true,
                "تتطلب بطاقة 6GB VRAM كحد أدنى؛ يُنصح بتشغيلها عبر GeForce NOW أو خادم GPU بعيد."
            ),
            ["reddeadredemption2"] = new(
                "Red Dead Redemption 2",
                "بيانات متطلبات Rockstar Games الرسمية",
                "Intel Core i5-2500K",
                "Intel Core i7-4770K",
                8, 12,
                2048, 6144,
                150,
                "DirectX 12 / Vulkan",
                true,
                "تتطلب موارد رسومية تتجاوز قدرة MX250 لتشغيل مريح؛ يُنصح بالسحابي أو خادم بعيد."
            )
        };

    public SmartGameAnalysisService(IAuditLogger auditLogger)
    {
        _auditLogger = auditLogger;
    }

    public SmartGameAnalysisResponse AnalyzeGame(
        InstalledGame game,
        HardwareProfile hardware,
        PerformanceSnapshotResponse? performance)
    {
        var normalizedKey = NormalizeTitle(game.Title);
        VerifiedCatalog.TryGetValue(normalizedKey, out var verifiedProfile);

        var vramMb = hardware.Gpu.VramTotalMb;
        var totalRamGb = hardware.Memory.TotalGb;
        var availRamGb = hardware.Memory.AvailableGb;
        var cpuUsage = performance?.Sample.CpuUsagePercent;
        var ramUsedGb = performance?.Sample.RamUsedGb;

        var hardwareChecks = new HardwareChecksSummary(
            CpuStatusAr: hardware.Cpu.Model is not null
                ? $"{hardware.Cpu.Model} ({hardware.Cpu.Cores ?? 0} أنوية / {hardware.Cpu.Threads ?? 0} خيوط)"
                : "غير متاح من مستشعر النظام",
            RamStatusAr: totalRamGb.HasValue
                ? $"الإجمالي {totalRamGb.Value:0.0} GB · المتاح الآن {(availRamGb.HasValue ? $"{availRamGb.Value:0.0} GB" : "غير محدد")}"
                : "غير متاح",
            GpuAndVramStatusAr: hardware.Gpu.PrimaryModel is not null
                ? $"{hardware.Gpu.PrimaryModel} ({(vramMb.HasValue ? $"{vramMb.Value} MB VRAM" : "VRAM غير متاح")}) · المدمج: {hardware.Gpu.IntegratedModel ?? "غير متاح"}"
                : "بطاقة الرسوميات غير متاحة",
            StorageStatusAr: $"{hardware.Storage.FreeSpaceGb:0.0} GB متاحة من أصل {hardware.Storage.TotalSpaceGb:0.0} GB",
            DriverStatusAr: hardware.Gpu.DriverVersion is not null
                ? $"إصدار التعريف: {hardware.Gpu.DriverVersion}"
                : "إصدار التعريف غير متاح",
            SystemLoadNoteAr: cpuUsage.HasValue || ramUsedGb.HasValue
                ? $"الحمل الحالي: CPU {(cpuUsage.HasValue ? $"{cpuUsage.Value:0}%" : "غير متاح")} · RAM المستخدم {(ramUsedGb.HasValue ? $"{ramUsedGb.Value:0.0} GB" : "غير متاح")}"
                : "حمل النظام الحي غير متاح حالياً"
        );

        // Case 1: Unknown requirements — NEVER invent or guess!
        if (verifiedProfile is null)
        {
            var unknownReqs = new GameRequirementsMetadata(
                Status: "unknown",
                SourceLabelAr: "لا توجد بيانات متطلبات موثقة لهذه اللعبة في القاعدة المحلية (لم يتم التخمين)",
                MinCpuAr: null, RecCpuAr: null,
                MinRamGb: null, RecRamGb: null,
                MinVramMb: null, RecVramMb: null,
                MinStorageGb: null, DirectXVersion: null
            );

            return new SmartGameAnalysisResponse(
                GameId: game.Id,
                GameTitle: game.Title,
                Version: game.Version,
                ExecutablePath: game.ExecutablePath,
                Launcher: game.Launcher,
                CoverImageUrl: game.CoverImageUrl,
                AnalyzedAt: DateTimeOffset.UtcNow.ToString("O"),
                Compatibility: "unknown",
                CompatibilityLabelAr: "غير معروف (Unknown)",
                CompatibilityExplanationAr: "تعذر العثور على متطلبات رسمية موثقة لهذه اللعبة؛ لذا لم يتم تخمين التوافق أو تقدير معدل الإطارات.",
                HardwareChecks: hardwareChecks,
                Requirements: unknownReqs,
                EvidenceBasedFpsRangeAr: null,
                FpsRangeSupported: false,
                GraphicsRecommendations: BuildGraphicsRecommendations(null, vramMb, hardware.Gpu.PrimaryModel),
                CloudAssessment: new CloudGameAssessment(
                    RecommendedInCloud: false,
                    InternetRequirementAr: "15 - 25 Mbps للبث السحابي بدقة 720p/1080p",
                    LatencyRequirementAr: "أقل من 50 ms (غير مقاس حالياً)",
                    CostNoteAr: "يتطلب اشتراكاً لدى مزوّد سحابي متوافق أو خادم Windows GPU خاصاً بك.",
                    ProviderSupportNoteAr: "تحقق يدوياً من توفر اللعبة في كتالوج المزوّد السحابي.",
                    IsCloudHardwareConnected: false
                ),
                SafeOptimizationSummaryAr: "يمكن تطبيق خطة الطاقة وتفضيل البطاقة المخصصة عبر Windows Settings فقط بعد معاينتك وموافقتك."
            );
        }

        // Case 2: Verified requirements — evaluate rigorously against real detected hardware
        var requirements = new GameRequirementsMetadata(
            Status: "verified_metadata",
            SourceLabelAr: verifiedProfile.SourceLabelAr,
            MinCpuAr: verifiedProfile.MinCpuAr,
            RecCpuAr: verifiedProfile.RecCpuAr,
            MinRamGb: verifiedProfile.MinRamGb,
            RecRamGb: verifiedProfile.RecRamGb,
            MinVramMb: verifiedProfile.MinVramMb,
            RecVramMb: verifiedProfile.RecVramMb,
            MinStorageGb: verifiedProfile.MinStorageGb,
            DirectXVersion: verifiedProfile.DirectXVersion
        );

        var (tier, labelAr, explanationAr, fpsRangeAr, fpsSupported) =
            EvaluateVerifiedCompatibility(verifiedProfile, hardware);

        _ = _auditLogger.LogOperationAsync("smart_game_analysis", "completed", new
        {
            gameId = game.Id,
            title = game.Title,
            compatibility = tier,
            verified = true
        });

        return new SmartGameAnalysisResponse(
            GameId: game.Id,
            GameTitle: game.Title,
            Version: game.Version,
            ExecutablePath: game.ExecutablePath,
            Launcher: game.Launcher,
            CoverImageUrl: game.CoverImageUrl,
            AnalyzedAt: DateTimeOffset.UtcNow.ToString("O"),
            Compatibility: tier,
            CompatibilityLabelAr: labelAr,
            CompatibilityExplanationAr: explanationAr,
            HardwareChecks: hardwareChecks,
            Requirements: requirements,
            EvidenceBasedFpsRangeAr: fpsRangeAr,
            FpsRangeSupported: fpsSupported,
            GraphicsRecommendations: BuildGraphicsRecommendations(verifiedProfile, vramMb, hardware.Gpu.PrimaryModel),
            CloudAssessment: new CloudGameAssessment(
                RecommendedInCloud: verifiedProfile.CloudRecommendedFor2GbVram || tier == "not_recommended",
                InternetRequirementAr: "15 - 25 Mbps (أو 10+ Mbps للحد الأدنى 720p)",
                LatencyRequirementAr: "يفضل أقل من 45 - 60 ms عبر Wi-Fi 5GHz أو Ethernet",
                CostNoteAr: "يتطلب حساباً واشتراكاً ساريين في GeForce NOW / Xbox Cloud / Boosteroid أو خادم GPU خاصاً.",
                ProviderSupportNoteAr: verifiedProfile.ProviderSupportNoteAr,
                IsCloudHardwareConnected: false
            ),
            SafeOptimizationSummaryAr: "يُوصى باختيار بطاقة NVIDIA في إعدادات ويندوز وتفعيل Game Mode وإغلاق البرامج غير الضرورية التي تختارها بنفسك دون المساس بملفات اللعبة أو برامج الحماية."
        );
    }

    public async Task<GameLaunchResponse> SafeLaunchAsync(
        InstalledGame game,
        GameLaunchRequest request)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        var mode = string.Equals(request.Mode, "cloud", StringComparison.OrdinalIgnoreCase) ? "cloud" : "local";

        if (mode == "cloud")
        {
            await _auditLogger.LogOperationAsync("game_launch_cloud", "provider_not_connected", new { game.Id });
            return new GameLaunchResponse(
                Launched: false,
                Status: "agent_required",
                Mode: "cloud",
                Pid: null,
                MessageAr: "لا يوجد مزوّد بث سحابي متصل مباشرة بالوكيل؛ استخدم رابط المزوّد الرسمي أو عميل الخادم البعيد من تبويب الوضع السحابي.",
                Timestamp: now
            );
        }

        var hasVerifiedUri = SafetyPolicyGuard.IsAllowedOfficialLaunchUri(game.LaunchUri);
        var hasExePath = !string.IsNullOrWhiteSpace(game.ExecutablePath);

        if ((request.PreferLauncherUri || !hasExePath) && hasVerifiedUri)
        {
            return await TryLaunchViaOfficialUriAsync(game, game.LaunchUri!, now);
        }

        var pathCheck = SafetyPolicyGuard.ValidateWindowsExecutablePath(game.ExecutablePath);
        if (!pathCheck.IsValid)
        {
            await _auditLogger.LogOperationAsync("game_launch_local", "blocked_safety", new { game.Id, game.ExecutablePath });
            return new GameLaunchResponse(
                Launched: false,
                Status: "blocked_safety",
                Mode: "local",
                Pid: null,
                MessageAr: pathCheck.ErrorAr ?? "تم حظر المسار لأسباب أمنية.",
                Timestamp: now
            );
        }

        if (!File.Exists(pathCheck.NormalizedPath))
        {
            if (hasVerifiedUri)
            {
                return await TryLaunchViaOfficialUriAsync(game, game.LaunchUri!, now);
            }

            await _auditLogger.LogOperationAsync("game_launch_local", "executable_not_found", new { game.Id, pathCheck.NormalizedPath });
            return new GameLaunchResponse(
                Launched: false,
                Status: "executable_not_found",
                Mode: "local",
                Pid: null,
                MessageAr: $"ملف التشغيل غير موجود في المسار المحدد: {pathCheck.NormalizedPath}",
                Timestamp: now
            );
        }

        try
        {
            // Direct, clean Windows process launch — NO code injection, NO DLL hooking, NO DRM/anti-cheat bypass
            var startInfo = new ProcessStartInfo
            {
                FileName = pathCheck.NormalizedPath,
                WorkingDirectory = Directory.Exists(game.InstallPath)
                    ? game.InstallPath
                    : Path.GetDirectoryName(pathCheck.NormalizedPath) ?? string.Empty,
                UseShellExecute = false
            };

            using var proc = Process.Start(startInfo);
            var pid = proc?.Id;
            await _auditLogger.LogOperationAsync("game_launch_local", "launched", new { game.Id, pid });

            return new GameLaunchResponse(
                Launched: true,
                Status: "launched",
                Mode: "local",
                Pid: pid,
                MessageAr: $"تم تشغيل {game.Title} بأمان عبر ويندوز (PID: {pid}) دون حقن برمجي أو تعديل ملفات.",
                Timestamp: now
            );
        }
        catch (Exception ex)
        {
            if (hasVerifiedUri)
            {
                return await TryLaunchViaOfficialUriAsync(game, game.LaunchUri!, now);
            }

            await _auditLogger.LogOperationAsync("game_launch_local", "failed", new { game.Id, error = ex.Message });
            return new GameLaunchResponse(
                Launched: false,
                Status: "failed",
                Mode: "local",
                Pid: null,
                MessageAr: $"تعذر تشغيل الملف التنفيذي مباشرة (قد يتطلب التشغيل عبر المشغّل الأصلي {game.Launcher}): {ex.Message}",
                Timestamp: now
            );
        }
    }

    private async Task<GameLaunchResponse> TryLaunchViaOfficialUriAsync(
        InstalledGame game,
        string launchUri,
        string timestamp)
    {
        if (!SafetyPolicyGuard.IsAllowedOfficialLaunchUri(launchUri))
        {
            return new GameLaunchResponse(
                Launched: false,
                Status: "blocked_safety",
                Mode: "local",
                Pid: null,
                MessageAr: "رابط التشغيل غير معتمد ضمن بروتوكولات المشغّلات الرسمية.",
                Timestamp: timestamp
            );
        }

        try
        {
            var startInfo = launchUri.StartsWith("shell:AppsFolder\\", StringComparison.OrdinalIgnoreCase)
                ? new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    Arguments = launchUri,
                    UseShellExecute = true
                }
                : new ProcessStartInfo
                {
                    FileName = launchUri,
                    UseShellExecute = true
                };

            using var proc = Process.Start(startInfo);
            var pid = proc?.Id;
            await _auditLogger.LogOperationAsync("game_launch_official_launcher", "launched", new { game.Id, launcher = game.Launcher, pid });

            return new GameLaunchResponse(
                Launched: true,
                Status: "launched",
                Mode: "local",
                Pid: pid,
                MessageAr: $"تم تشغيل {game.Title} عبر المشغّل الرسمي ({game.Launcher}) بأمان.",
                Timestamp: timestamp
            );
        }
        catch (Exception ex)
        {
            await _auditLogger.LogOperationAsync("game_launch_official_launcher", "failed", new { game.Id, error = ex.Message });
            return new GameLaunchResponse(
                Launched: false,
                Status: "failed",
                Mode: "local",
                Pid: null,
                MessageAr: $"تعذر فتح اللعبة عبر المشغّل الرسمي ({game.Launcher}): {ex.Message}",
                Timestamp: timestamp
            );
        }
    }

    private static (
        string Tier,
        string LabelAr,
        string ExplanationAr,
        string? EvidenceFpsRangeAr,
        bool FpsSupported
    ) EvaluateVerifiedCompatibility(
        VerifiedGameRequirementProfile req,
        HardwareProfile hardware)
    {
        var vramMb = hardware.Gpu.VramTotalMb;
        var totalRamGb = hardware.Memory.TotalGb;

        if (!vramMb.HasValue || !totalRamGb.HasValue)
        {
            return (
                "unknown",
                "غير معروف (Unknown)",
                "بيانات العتاد الفعلية (VRAM أو RAM) غير مكتملة؛ لا يمكن الجزم بالتوافق دون قراءة كاملة.",
                null,
                false
            );
        }

        if (vramMb.Value < req.MinVramMb)
        {
            return (
                "not_recommended",
                "غير موصى به (Not Recommended)",
                $"ذاكرة الرسوميات المتاحة ({vramMb.Value} MB VRAM) أقل من الحد الأدنى الرسمي للعبة ({req.MinVramMb} MB VRAM). قد لا تعمل اللعبة بسلاسة وقد تحدث أعطال؛ يُنصح بالتشغيل السحابي.",
                null,
                false
            );
        }

        if (totalRamGb.Value < req.MinRamGb)
        {
            return (
                "not_recommended",
                "غير موصى به (Not Recommended)",
                $"الذاكرة العشوائية ({totalRamGb.Value:0.0} GB) أقل من الحد الأدنى الرسمي ({req.MinRamGb:0.0} GB).",
                null,
                false
            );
        }

        // Meets recommended VRAM & RAM comfortably
        if (vramMb.Value >= req.RecVramMb && totalRamGb.Value >= req.RecRamGb && req.RecVramMb <= 1024)
        {
            return (
                "excellent",
                "ممتاز (Excellent)",
                $"جهازك يتجاوز المتطلبات الموصى بها ({req.RecRamGb:0.0} GB RAM و {req.RecVramMb} MB VRAM)، ما يتيح تشغيلاً سلساً ومستقراً.",
                "90 - 135 FPS (تقدير مبني على متطلبات الفئة الخفيفة ودقة 1080p منخفض/متوسط)",
                true
            );
        }

        // Fits within 2GB VRAM cleanly with medium/low settings
        if (vramMb.Value >= req.RecVramMb && totalRamGb.Value >= req.RecRamGb)
        {
            return (
                "good",
                "جيد (Good)",
                $"العتاد يفي بالمتطلبات الموصى بها ({req.RecRamGb:0.0} GB RAM و {req.RecVramMb} MB VRAM) مع الحاجة لضبط الخامات والظلال لتحقيق استقرار جيد.",
                "55 - 85 FPS (تقدير مبني على حدود 2GB VRAM بدقة 720p/900p)",
                true
            );
        }

        // Meets minimum only, constrained by 2GB VRAM or U-series CPU
        return (
            "limited",
            "محدود (Limited)",
            $"الجهاز يحقق الحد الأدنى ({req.MinVramMb} MB VRAM) لكنه أقل من الموصى به ({req.RecVramMb} MB VRAM)؛ يلزم خفض دقة العرض إلى 720p والخامات إلى Low/Normal.",
            "35 - 55 FPS (تقدير مبني على الحد الأدنى عند دقة 720p منخفض)",
            true
        );
    }

    private static IReadOnlyList<GraphicsSettingRecommendation> BuildGraphicsRecommendations(
        VerifiedGameRequirementProfile? req,
        int? vramMb,
        string? primaryGpu)
    {
        if (req is null)
        {
            return
            [
                new("resolution", "دقة العرض (Resolution)", "1280×720 (آمن مبدئياً)", "hardware_estimate", "تقدير مبني على العتاد", "تقدير محافظ حتى تتوفر متطلبات رسمية موثقة للعبة."),
                new("textures", "جودة الخامات (Textures)", "Low / Normal", "hardware_estimate", "تقدير مبني على العتاد", $"لتفادي امتلاء ذاكرة {(vramMb.HasValue ? $"{vramMb} MB" : "VRAM")}."),
                new("shadows", "الظلال (Shadows)", "Low", "hardware_estimate", "تقدير مبني على العتاد", "يخفف العبء على بطاقة الرسوميات."),
                new("anti_aliasing", "مضاد التعرج (Anti-Aliasing)", "FXAA أو Off", "hardware_estimate", "تقدير مبني على العتاد", "يتجنب كلفة MSAA العالية."),
                new("effects", "التأثيرات البصرية (Effects)", "Low", "hardware_estimate", "تقدير مبني على العتاد", "يحافظ على استقرار الإطارات في المشاهد المزدحمة."),
                new("view_distance", "مسافة الرؤية (View Distance)", "Low / Medium", "hardware_estimate", "تقدير مبني على العتاد", "يوازن بين وضوح اللعب واستهلاك المعالج."),
                new("vsync", "المزامنة العمودية (V-Sync)", "Off (أو On عند التمزق)", "hardware_estimate", "تقدير مبني على العتاد", "يقلل زمن تأخر الإدخال."),
                new("fps_target", "الهدف الإطاري (FPS Target)", "غير محدد (المتطلبات غير موثقة)", "unknown", "غير متوفر", "لا يمكن تحديد هدف إطاري موثق قبل معرفة متطلبات اللعبة.")
            ];
        }

        var isLight = req.RecVramMb <= 1024;
        var gpuLabel = primaryGpu ?? "بطاقة 2GB VRAM";

        return
        [
            new("resolution", "دقة العرض (Resolution)", isLight ? "1920×1080" : "1280×720 أو 1600×900", "hardware_estimate", "تقدير مبني على العتاد", $"متوازن لقدرات {gpuLabel} مع متطلبات {req.CanonicalTitle}."),
            new("textures", "جودة الخامات (Textures)", isLight ? "Medium" : "Low / Normal", "verified_profile", "موثّق وفق حد VRAM", $"الموصى به رسمياً {req.RecVramMb} MB VRAM؛ ضبط الخامات يمنع التقطيع المفاجئ."),
            new("shadows", "الظلال (Shadows)", "Low", "hardware_estimate", "تقدير مبني على العتاد", "يوفّر هامش أداء ملموس في بطاقات الفئة الاقتصادية."),
            new("anti_aliasing", "مضاد التعرج (Anti-Aliasing)", "FXAA أو Off", "hardware_estimate", "تقدير مبني على العتاد", "أقل كلفة بكثير من MSAA/TAA High على MX250."),
            new("effects", "التأثيرات البصرية (Effects)", isLight ? "Medium" : "Low", "hardware_estimate", "تقدير مبني على العتاد", "يقلل هبوط الإطارات أثناء الانفجارات والمؤثرات."),
            new("view_distance", "مسافة الرؤية (View Distance)", isLight ? "Medium" : "Low / Medium", "hardware_estimate", "تقدير مبني على العتاد", "يحمي معالج i7-10610U من الاختناق الحراري."),
            new("vsync", "المزامنة العمودية (V-Sync)", "Off", "verified_profile", "موثّق لألعاب المنافسة", "يقلل Input Lag مع إمكانية تحديد حد للإطارات."),
            new("fps_target", "الهدف الإطاري (FPS Target)", isLight ? "60 - 120 FPS (مقترح)" : "45 - 60 FPS (مقترح)", "hardware_estimate", "تقدير مبني على العتاد", "هدف عملي للحفاظ على ثبات الحرارة وتجربة لعب مستقرة دون ضمانات.")
        ];
    }

    private static string NormalizeTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title)) return string.Empty;
        return new string(title.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
    }
}
