import type {
  AgentHealthResponse,
  CloudProviderIntegration,
  GraphicsSettingRecommendation,
  HardwareProfile,
  InstalledGame,
  OptimizationAnalysisResponse,
  OptimizationPreviewResponse,
  PerformanceSample,
  PerformanceSnapshotResponse,
  ProcessMetric,
  SmartCompatibilityTier,
  SmartGameAnalysisResponse,
} from '../types/agent';

export const DEMO_HEALTH: AgentHealthResponse = {
  status: 'ok',
  agentVersion: '1.0.0-win-x64',
  os: 'Windows 11 Pro 23H2 (x64)',
  elevation: 'standard_user',
  uptimeSeconds: 1840,
  originValidated: true,
  securityServicesProtected: true,
  timestamp: new Date().toISOString(),
};

export const DEMO_HARDWARE: HardwareProfile = {
  deviceName: 'LAPTOP-I7-MX250 (محاكاة تجريبية)',
  osName: 'Windows 11 Pro',
  osBuild: '23H2 · Build 22631',
  powerSource: 'AC',
  activePowerPlan: 'متوازن (Balanced)',
  cpu: {
    model: 'Intel Core i7-10610U',
    cores: 4,
    threads: 8,
    baseClockGhz: 1.8,
    boostClockGhz: 4.9,
  },
  memory: {
    totalGb: 16,
    availableGb: 9.2,
    speedMhz: 2666,
    channelMode: 'Dual Channel',
  },
  gpu: {
    primaryModel: 'NVIDIA GeForce MX250',
    integratedModel: 'Intel UHD Graphics',
    vramTotalMb: 2048,
    driverVersion: '551.86 WHQL',
  },
  storage: {
    type: 'NVMe SSD',
    freeSpaceGb: 148,
    totalSpaceGb: 512,
  },
  network: {
    adapterType: 'Wi-Fi 5GHz',
    estimatedBandwidthMbps: 22,
    latencyMs: 38,
  },
  gamingReadiness: {
    tier: 'esports_and_light',
    summaryAr:
      'الجهاز مناسب لألعاب الرياضات الإلكترونية والألعاب التنافسية الخفيفة بدقة 720p أو 900p بمعدل إطارات مستقر.',
    bottleneckNoteAr:
      'ذاكرة الرسوميات (2GB VRAM في بطاقة MX250) والمعالج من الفئة الموفرة للطاقة (U-Series) تمثلان الحد الأساسي للألعاب الثقيلة الحديثة.',
    vramLimitWarning: true,
  },
};

export const DEMO_INSTALLED_GAMES: InstalledGame[] = [
  {
    id: 'valorant',
    title: 'VALORANT',
    version: '8.11.0.2584',
    coverImageUrl: null,
    executableName: 'VALORANT-Win64-Shipping.exe',
    executablePath: 'C:\\Riot Games\\VALORANT\\live\\ShooterGame\\Binaries\\Win64\\VALORANT-Win64-Shipping.exe',
    installPath: 'C:\\Riot Games\\VALORANT\\live',
    detectedGpu: 'NVIDIA GeForce MX250 (2GB)',
    launcher: 'Riot Client',
    sizeGb: 38.4,
    lastPlayed: 'أمس · 21:40',
    compatibility: 'excellent',
    estimatedFpsRange: '90 - 135 FPS (1080p منخفض/متوسط)',
    recommendedResolution: '1920×1080',
    vramRequirementMb: 1024,
    isOptimizedProfileActive: false,
    safetyNoteAr: 'تطبيق تفضيل بطاقة NVIDIA عبر إعدادات الرسوميات في ويندوز فقط دون تعديل أي ملف لعبة.',
  },
  {
    id: 'cs2',
    title: 'Counter-Strike 2',
    version: '1.40.1.2',
    coverImageUrl: null,
    executableName: 'cs2.exe',
    executablePath: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe',
    installPath: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive',
    detectedGpu: 'NVIDIA GeForce MX250 (2GB)',
    launcher: 'Steam',
    sizeGb: 41.2,
    lastPlayed: 'قبل يومين',
    compatibility: 'good',
    estimatedFpsRange: '55 - 85 FPS (720p منخفض)',
    recommendedResolution: '1280×720',
    vramRequirementMb: 1850,
    isOptimizedProfileActive: false,
    safetyNoteAr: 'يتطلب خفض دقة العرض وإغلاق التطبيقات الخلفية لتقليل استهلاك VRAM.',
  },
  {
    id: 'rocket-league',
    title: 'Rocket League',
    version: '2.39.0.0',
    coverImageUrl: null,
    executableName: 'RocketLeague.exe',
    executablePath: 'C:\\Program Files\\Epic Games\\rocketleague\\Binaries\\Win64\\RocketLeague.exe',
    installPath: 'C:\\Program Files\\Epic Games\\rocketleague',
    detectedGpu: 'NVIDIA GeForce MX250 (2GB)',
    launcher: 'Epic Games',
    sizeGb: 26.8,
    lastPlayed: 'منذ 4 أيام',
    compatibility: 'good',
    estimatedFpsRange: '65 - 95 FPS (900p أداء)',
    recommendedResolution: '1600×900',
    vramRequirementMb: 1350,
    isOptimizedProfileActive: true,
    safetyNoteAr: 'ملف الطاقة وتفضيل المعالج الرسومي مفعّلان بشكل آمن على مستوى ويندوز.',
  },
  {
    id: 'gtav',
    title: 'Grand Theft Auto V',
    version: '1.0.3179.0',
    coverImageUrl: null,
    executableName: 'GTA5.exe',
    executablePath: 'D:\\Games\\SteamLibrary\\steamapps\\common\\Grand Theft Auto V\\GTA5.exe',
    installPath: 'D:\\Games\\SteamLibrary\\steamapps\\common\\Grand Theft Auto V',
    detectedGpu: 'NVIDIA GeForce MX250 (2GB)',
    launcher: 'Steam',
    sizeGb: 112.5,
    lastPlayed: 'الأسبوع الماضي',
    compatibility: 'good',
    estimatedFpsRange: '45 - 60 FPS (720p عادي)',
    recommendedResolution: '1280×720',
    vramRequirementMb: 1950,
    isOptimizedProfileActive: false,
    safetyNoteAr: 'يجب إبقاء جودة الخامات Normal لتفادي تجاوز حد 2048 MB VRAM.',
  },
  {
    id: 'lol',
    title: 'League of Legends',
    version: '14.9.580.2108',
    coverImageUrl: null,
    executableName: 'League of Legends.exe',
    executablePath: 'C:\\Riot Games\\League of Legends\\Game\\League of Legends.exe',
    installPath: 'C:\\Riot Games\\League of Legends',
    detectedGpu: 'Intel UHD / NVIDIA MX250',
    launcher: 'Riot Client',
    sizeGb: 24.1,
    lastPlayed: 'اليوم · 16:15',
    compatibility: 'excellent',
    estimatedFpsRange: '100 - 140 FPS (1080p متوسط)',
    recommendedResolution: '1920×1080',
    vramRequirementMb: 1024,
    isOptimizedProfileActive: false,
    safetyNoteAr: 'يعمل بسلاسة تامة على MX250 مع 16GB RAM.',
  },
  {
    id: 'ets2',
    title: 'Euro Truck Simulator 2',
    version: '1.50.1.0',
    coverImageUrl: null,
    executableName: 'eurotrucks2.exe',
    executablePath: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Euro Truck Simulator 2\\bin\\win_x64\\eurotrucks2.exe',
    installPath: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Euro Truck Simulator 2',
    detectedGpu: 'NVIDIA GeForce MX250 (2GB)',
    launcher: 'Steam',
    sizeGb: 22.9,
    lastPlayed: 'منذ أسبوعين',
    compatibility: 'limited',
    estimatedFpsRange: '35 - 55 FPS (720p منخفض)',
    recommendedResolution: '1280×720',
    vramRequirementMb: 2048,
    isOptimizedProfileActive: false,
    safetyNoteAr: 'يُنصح بتقليل Scaling إلى 100% وتعطيل المرايا عالية الدقة يدوياً داخل اللعبة.',
  },
  {
    id: 'cyberpunk-2077',
    title: 'Cyberpunk 2077',
    version: '2.12.0.0',
    coverImageUrl: null,
    executableName: 'Cyberpunk2077.exe',
    executablePath: 'D:\\Games\\SteamLibrary\\steamapps\\common\\Cyberpunk 2077\\bin\\x64\\Cyberpunk2077.exe',
    installPath: 'D:\\Games\\SteamLibrary\\steamapps\\common\\Cyberpunk 2077',
    detectedGpu: 'NVIDIA GeForce MX250 (2GB)',
    launcher: 'Steam',
    sizeGb: 72.4,
    lastPlayed: 'غير مشغّلة محلياً',
    compatibility: 'not_recommended',
    estimatedFpsRange: 'غير موصى بالتشغيل المحلي (أقل من 6GB VRAM)',
    recommendedResolution: 'يُنصح بالوضع السحابي (Cloud Mode)',
    vramRequirementMb: 6144,
    isOptimizedProfileActive: false,
    isInstalled: true,
    launchUri: 'steam://rungameid/1091500',
    safetyNoteAr: 'يتطلب 6GB VRAM كحد أدنى؛ بطاقة MX250 (2GB) غير كافية ويُنصح بالتشغيل عبر مزوّد سحابي.',
  },
  {
    id: 'xbox-minecraft',
    title: 'Minecraft for Windows',
    version: '1.21.40',
    coverImageUrl: null,
    executableName: 'Minecraft.Windows.exe',
    executablePath: 'C:\\XboxGames\\Minecraft for Windows\\Content\\Minecraft.Windows.exe',
    installPath: 'C:\\XboxGames\\Minecraft for Windows\\Content',
    detectedGpu: 'NVIDIA GeForce MX250 (2GB)',
    launcher: 'Xbox App',
    sizeGb: 2.1,
    lastPlayed: 'منذ 3 أيام',
    compatibility: 'excellent',
    estimatedFpsRange: '75 - 120 FPS (1080p قياسي)',
    recommendedResolution: '1920×1080',
    vramRequirementMb: 1024,
    isOptimizedProfileActive: false,
    isInstalled: true,
    safetyNoteAr: 'مثبتة عبر تطبيق Xbox على ويندوز 11؛ تعمل بسلاسة دون تتبع الأشعة.',
  },
];

export const DEMO_PROCESSES: ProcessMetric[] = [
  {
    pid: 11420,
    name: 'chrome.exe (14 تبويباً)',
    category: 'background_safe_to_pause',
    cpuPercent: 6.4,
    ramMb: 1840,
    canSafelyPause: true,
  },
  {
    pid: 9384,
    name: 'Discord.exe',
    category: 'background_safe_to_pause',
    cpuPercent: 2.1,
    ramMb: 420,
    canSafelyPause: true,
  },
  {
    pid: 4820,
    name: 'MsMpEng.exe (Windows Defender)',
    category: 'security_protected',
    cpuPercent: 1.2,
    ramMb: 215,
    canSafelyPause: false,
  },
  {
    pid: 6720,
    name: 'OneDrive.exe',
    category: 'background_safe_to_pause',
    cpuPercent: 1.8,
    ramMb: 190,
    canSafelyPause: true,
  },
  {
    pid: 2104,
    name: 'dwm.exe (Desktop Window Manager)',
    category: 'system',
    cpuPercent: 2.8,
    ramMb: 165,
    canSafelyPause: false,
  },
];

/**
 * Returns a static, deterministic baseline snapshot for Demo Mode.
 * Intentionally does NOT fabricate oscillating live measurements or fake FPS/temp readings.
 */
export function buildDemoPerformanceSample(): PerformanceSnapshotResponse {
  const sample: PerformanceSample = {
    timestamp: 'عينة مرجعية ثابتة (وضع العرض التجريبي)',
    cpuUsagePercent: 24,
    cpuClockGhz: 2.8,
    cpuTempCelsius: null,
    ramUsedGb: 6.8,
    ramTotalGb: 16,
    gpuUsagePercent: 18,
    vramUsedMb: 640,
    vramTotalMb: 2048,
    gpuTempCelsius: null,
    activeGameProcess: null,
    fps: null,
    frameTimeMs: null,
    isStaticDemoSnapshot: true,
  };

  return {
    sample,
    sensorsAvailable: {
      cpuUsage: true,
      ramUsage: true,
      gpuUsage: true,
      vramUsage: true,
      cpuTemp: false,
      gpuTemp: false,
      fpsHook: false,
    },
    topProcesses: DEMO_PROCESSES,
  };
}

export function buildDemoOptimizationAnalysis(
  game: InstalledGame | null,
  activeTweaksApplied: boolean
): OptimizationAnalysisResponse {
  const targetTitle = game ? game.title : 'الإعداد العام للجهاز';
  return {
    analyzedAt: new Date().toISOString(),
    targetGameId: game?.id ?? null,
    targetGameTitle: game?.title ?? null,
    hardwareSummaryAr: `تحليل مخصص لمعالج Intel Core i7-10610U وذاكرة 16GB وبطاقة NVIDIA GeForce MX250 (2GB VRAM) لـ "${targetTitle}".`,
    systemTweaks: [
      {
        id: 'tweak_power_plan',
        titleAr: 'تفعيل خطة الطاقة: أداء عالٍ (High Performance)',
        descriptionAr:
          'يمنع خفض تردد معالج i7-10610U أثناء اللعب عند توصيل الشاحن، دون تعديل إعدادات BIOS أو الجهد.',
        scope: 'power_plan',
        currentValueAr: activeTweaksApplied ? 'أداء عالٍ (High Performance)' : 'متوازن (Balanced)',
        recommendedValueAr: 'أداء عالٍ (High Performance)',
        expectedImpactAr: 'تحسن متوقع ~5% إلى 12% في استقرار التردد وتقليل هبوط الإطارات المفاجئ.',
        riskLevel: 'low',
        riskNoteAr: 'مخاطرة منخفضة: زيادة طفيفة في استهلاك البطارية والحرارة إذا لم يكن الشاحن موصلاً.',
        reversible: true,
        modifiesGameFiles: false,
        affectsSecurityServices: false,
        selectedByDefault: true,
      },
      {
        id: 'tweak_gpu_pref',
        titleAr: 'توجيه اللعبة لاستخدام NVIDIA MX250 عبر إعدادات ويندوز',
        descriptionAr:
          'يضبط تفضيل الرسوميات على مستوى سجل مستخدم ويندوز (UserGpuPreferences) لاختيار بطاقة NVIDIA بدلاً من Intel UHD المدمجة.',
        scope: 'windows_gpu_preference',
        currentValueAr: activeTweaksApplied ? 'أداء عالٍ (NVIDIA MX250)' : 'قرار النظام التلقائي',
        recommendedValueAr: 'أداء عالٍ (NVIDIA MX250)',
        expectedImpactAr: 'مرتفع: يضمن تشغيل اللعبة على MX250 بدلاً من Intel UHD (فرق قد يتجاوز +45% FPS).',
        riskLevel: 'none',
        riskNoteAr: 'بدون مخاطرة: إعداد رسمي من ويندوز ولا يلمس ملفات EXE أو DLL الخاصة باللعبة.',
        reversible: true,
        modifiesGameFiles: false,
        affectsSecurityServices: false,
        selectedByDefault: true,
      },
      {
        id: 'tweak_game_mode',
        titleAr: 'تفعيل وضع الألعاب في ويندوز 11 (Windows Game Mode)',
        descriptionAr:
          'يقلل نشاط تحديثات ويندوز والمهام المجدولة مؤقتاً أثناء تشغيل اللعبة.',
        scope: 'game_mode',
        currentValueAr: activeTweaksApplied ? 'مفعّل' : 'غير مفعّل',
        recommendedValueAr: 'مفعّل',
        expectedImpactAr: 'استقرار أفضل في زمن الإطار (Frame Time) وتقليل مقاطعات الخلفية.',
        riskLevel: 'none',
        riskNoteAr: 'بدون مخاطرة: ميزة مدمجة رسمياً في نظام Windows 11.',
        reversible: true,
        modifiesGameFiles: false,
        affectsSecurityServices: false,
        selectedByDefault: true,
      },
      {
        id: 'tweak_bg_apps',
        titleAr: 'إيقاف التطبيقات الخلفية غير الأساسية مؤقتاً',
        descriptionAr:
          'يحرر قرابة 2.4 GB من الذاكرة العشوائية عبر إغلاق متصفحات مفتوحة ومزامنة OneDrive غير الضرورية. لا يمس برامج الحماية.',
        scope: 'background_apps',
        currentValueAr: activeTweaksApplied ? 'موقوفة مؤقتاً' : '3 تطبيقات تستهلك 2.45 GB',
        recommendedValueAr: 'تحرير الذاكرة مؤقتاً قبل التشغيل',
        expectedImpactAr: 'تحرير ~2.4 GB RAM وتقليل استخدام المعالج في الخلفية بنسبة ~10%.',
        riskLevel: 'low',
        riskNoteAr: 'مخاطرة منخفضة: قد تُغلق تبويبات المتصفح غير المحفوظة أو تتوقف المزامنة حتى إعادة فتحها.',
        reversible: true,
        modifiesGameFiles: false,
        affectsSecurityServices: false,
        selectedByDefault: false,
      },
    ],
    advisoryInGameSettings: [
      {
        settingNameAr: 'دقة العرض (Resolution)',
        currentOrDefaultAr: '1920×1080',
        recommendedForHardwareAr: game?.recommendedResolution ?? '1280×720 أو 1600×900',
        vramImpactAr: 'يوفر 350 - 550 MB من VRAM ويرفع الإطارات بنسبة ~25%',
        riskNoteAr: 'تغيير مرئي فقط داخل إعدادات اللعبة (لا يمس ملفات INI/CFG من الوكيل).',
      },
      {
        settingNameAr: 'جودة الخامات (Texture Quality)',
        currentOrDefaultAr: 'High / مرتفع',
        recommendedForHardwareAr: 'Low أو Normal (مقيد بـ 2GB VRAM)',
        vramImpactAr: 'يمنع امتلاء 2048 MB VRAM والتقطيع المفاجئ (Stuttering)',
        riskNoteAr: 'بدون مخاطرة: تقليل بسيط في حدة الأسطح القريبة مقابل سلاسة اللعب.',
      },
      {
        settingNameAr: 'الظلال (Shadows)',
        currentOrDefaultAr: 'High / مرتفع',
        recommendedForHardwareAr: 'Low / منخفض',
        vramImpactAr: 'يرفع الإطارات بنسبة ~18%',
        riskNoteAr: 'بدون مخاطرة: يطبق يدوياً من قائمة اللعبة.',
      },
      {
        settingNameAr: 'مضاد التعرج (Anti-Aliasing)',
        currentOrDefaultAr: 'MSAA 4x / TAA High',
        recommendedForHardwareAr: 'FXAA أو Off',
        vramImpactAr: 'يخفف الحمل بشكل ملحوظ عن شريحة MX250',
        riskNoteAr: 'بدون مخاطرة: يطبق يدوياً من قائمة اللعبة.',
      },
      {
        settingNameAr: 'المزامنة العمودية (V-Sync)',
        currentOrDefaultAr: 'On / مفعّل',
        recommendedForHardwareAr: 'Off (لتقليل تأخر الاستجابة)',
        vramImpactAr: 'استجابة أسرع في الألعاب التنافسية',
        riskNoteAr: 'قد يظهر تمزق بسيط بالصورة (Screen Tearing) عند تجاوز 60 FPS.',
      },
    ],
    protectedServicesNoticeAr:
      'تم استثناء Windows Defender ومضاد الفيروسات وجدار الحماية (Firewall) وخدمات النظام الأساسية بالكامل؛ ولن يتم تعديل أي ملف EXE أو DLL أو CFG أو INI أو ملفات موارد اللعبة الأصلية.',
  };
}

export function buildDemoPreview(
  analysis: OptimizationAnalysisResponse,
  selectedIds: string[]
): OptimizationPreviewResponse {
  const chosen = analysis.systemTweaks.filter((t) => selectedIds.includes(t.id));
  return {
    previewId: `prev_${Date.now()}`,
    generatedAt: new Date().toISOString(),
    backupSnapshotId: `snap_win11_${new Date().toISOString().slice(0, 10)}`,
    changes: chosen.map((t) => ({
      tweakId: t.id,
      titleAr: t.titleAr,
      beforeValueAr: t.currentValueAr,
      afterValueAr: t.recommendedValueAr,
      registryOrApiTarget:
        t.scope === 'power_plan'
          ? 'PowerCfg / SetActiveScheme (GUID_HIGH_PERF)'
          : t.scope === 'windows_gpu_preference'
          ? 'HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences'
          : t.scope === 'game_mode'
          ? 'HKCU\\Software\\Microsoft\\GameBar\\AutoGameModeEnabled'
          : 'User Session Graceful Process Suspension',
      isReversible: true,
    })),
    safetyChecks: {
      originalGameFilesUntouched: true,
      windowsSecurityUntouched: true,
      userConfirmationRequired: true,
    },
  };
}

export const CLOUD_PROVIDERS: CloudProviderIntegration[] = [
  {
    id: 'geforce_now',
    name: 'NVIDIA GeForce NOW',
    officialUrl: 'https://www.nvidia.com/en-us/geforce-now/',
    minBandwidthMbps: 15,
    recommendedBandwidthMbps: 25,
    supportsBrowserOrDesktop: 'تطبيق Windows الرسمي أو المتصفح',
    integrationStatusAr: 'جاهز للربط الخارجي (يتطلب حساب GeForce NOW)',
    suitabilityNoteAr:
      'مناسب تماماً للاتصالات بين 15-30 Mbps بدقة 720p@60fps أو 1080p@60fps إذا كان البنج أقل من 50ms.',
  },
  {
    id: 'xbox_cloud',
    name: 'Xbox Cloud Gaming (Beta)',
    officialUrl: 'https://www.xbox.com/play',
    minBandwidthMbps: 10,
    recommendedBandwidthMbps: 20,
    supportsBrowserOrDesktop: 'المتصفح أو تطبيق Xbox على ويندوز 11',
    integrationStatusAr: 'جاهز للربط الخارجي (يتطلب اشتراك Game Pass Ultimate)',
    suitabilityNoteAr:
      'يعمل ابتداءً من 10 Mbps، ويدعم يد التحكم المتصلة بالحاسوب عبر المتصفح.',
  },
  {
    id: 'boosteroid',
    name: 'Boosteroid Cloud Gaming',
    officialUrl: 'https://boosteroid.com/',
    minBandwidthMbps: 15,
    recommendedBandwidthMbps: 25,
    supportsBrowserOrDesktop: 'تطبيق سطح المكتب أو المتصفح',
    integrationStatusAr: 'جاهز للربط الخارجي (يتطلب حساب Boosteroid)',
    suitabilityNoteAr:
      'بديل مناسب للألعاب التي تتجاوز قدرات MX250 مع سرعة 15 Mbps فأكثر.',
  },
];

interface VerifiedGameRequirementProfile {
  canonicalTitle: string;
  sourceLabelAr: string;
  minCpuAr: string;
  recCpuAr: string;
  minRamGb: number;
  recRamGb: number;
  minVramMb: number;
  recVramMb: number;
  minStorageGb: number;
  directXVersion: string;
  cloudRecommendedFor2GbVram: boolean;
  providerSupportNoteAr: string;
}

const VERIFIED_GAME_CATALOG: Record<string, VerifiedGameRequirementProfile> = {
  valorant: {
    canonicalTitle: 'VALORANT',
    sourceLabelAr: 'بيانات متطلبات Riot Games الرسمية',
    minCpuAr: 'Intel Core i3-4150',
    recCpuAr: 'Intel Core i5-9400F',
    minRamGb: 4,
    recRamGb: 4,
    minVramMb: 1024,
    recVramMb: 1024,
    minStorageGb: 35,
    directXVersion: 'DirectX 11',
    cloudRecommendedFor2GbVram: false,
    providerSupportNoteAr: 'متوفرة محلياً بسلاسة؛ لا تتطلب ألعاباً سحابية على MX250.',
  },
  leagueoflegends: {
    canonicalTitle: 'League of Legends',
    sourceLabelAr: 'بيانات متطلبات Riot Games الرسمية',
    minCpuAr: 'Intel Core i3-530',
    recCpuAr: 'Intel Core i5-3300',
    minRamGb: 2,
    recRamGb: 4,
    minVramMb: 512,
    recVramMb: 1024,
    minStorageGb: 16,
    directXVersion: 'DirectX 11',
    cloudRecommendedFor2GbVram: false,
    providerSupportNoteAr: 'متوفرة على GeForce NOW لكنها تعمل محلياً بكفاءة أعلى.',
  },
  rocketleague: {
    canonicalTitle: 'Rocket League',
    sourceLabelAr: 'بيانات متطلبات Epic Games / Psyonix الرسمية',
    minCpuAr: 'Dual Core 2.5 GHz',
    recCpuAr: 'Quad Core 3.0+ GHz',
    minRamGb: 4,
    recRamGb: 8,
    minVramMb: 1024,
    recVramMb: 2048,
    minStorageGb: 20,
    directXVersion: 'DirectX 11',
    cloudRecommendedFor2GbVram: false,
    providerSupportNoteAr: 'مدعومة على GeForce NOW وتعمل محلياً بشكل جيد على 900p/720p.',
  },
  counterstrike2: {
    canonicalTitle: 'Counter-Strike 2',
    sourceLabelAr: 'بيانات متطلبات Valve / Steam الرسمية',
    minCpuAr: '4-Thread CPU (Core i5 750+)',
    recCpuAr: '4+ Core CPU',
    minRamGb: 8,
    recRamGb: 8,
    minVramMb: 1024,
    recVramMb: 2048,
    minStorageGb: 85,
    directXVersion: 'DirectX 11',
    cloudRecommendedFor2GbVram: false,
    providerSupportNoteAr: 'مدعومة على GeForce NOW؛ وتعمل محلياً بدقة 720p منخفضة عند تبريد جيد.',
  },
  grandtheftautov: {
    canonicalTitle: 'Grand Theft Auto V',
    sourceLabelAr: 'بيانات متطلبات Rockstar Games الرسمية',
    minCpuAr: 'Intel Core 2 Quad Q6600',
    recCpuAr: 'Intel Core i5-3470',
    minRamGb: 4,
    recRamGb: 8,
    minVramMb: 1024,
    recVramMb: 2048,
    minStorageGb: 110,
    directXVersion: 'DirectX 11',
    cloudRecommendedFor2GbVram: false,
    providerSupportNoteAr: 'بعض إصداراتها متاحة عبر خوادم Windows البعيدة؛ محلياً تعمل بحد 2GB VRAM عند إبقاء الخامات Normal.',
  },
  eurotrucksimulator2: {
    canonicalTitle: 'Euro Truck Simulator 2',
    sourceLabelAr: 'بيانات متطلبات SCS Software الرسمية',
    minCpuAr: 'Intel Core i5-6400',
    recCpuAr: 'Intel Core i5-9600',
    minRamGb: 8,
    recRamGb: 12,
    minVramMb: 2048,
    recVramMb: 4096,
    minStorageGb: 25,
    directXVersion: 'DirectX 11',
    cloudRecommendedFor2GbVram: true,
    providerSupportNoteAr: 'مدعومة على GeForce NOW؛ محلياً تقترب من حد 2GB VRAM في المدن المزدحمة.',
  },
  cyberpunk2077: {
    canonicalTitle: 'Cyberpunk 2077',
    sourceLabelAr: 'بيانات متطلبات CD PROJEKT RED الرسمية',
    minCpuAr: 'Intel Core i7-6700',
    recCpuAr: 'Intel Core i7-12700',
    minRamGb: 12,
    recRamGb: 16,
    minVramMb: 6144,
    recVramMb: 8192,
    minStorageGb: 70,
    directXVersion: 'DirectX 12',
    cloudRecommendedFor2GbVram: true,
    providerSupportNoteAr: 'تتطلب بطاقة 6GB VRAM كحد أدنى؛ يُنصح بتشغيلها عبر GeForce NOW أو خادم GPU بعيد.',
  },
  reddeadredemption2: {
    canonicalTitle: 'Red Dead Redemption 2',
    sourceLabelAr: 'بيانات متطلبات Rockstar Games الرسمية',
    minCpuAr: 'Intel Core i5-2500K',
    recCpuAr: 'Intel Core i7-4770K',
    minRamGb: 8,
    recRamGb: 12,
    minVramMb: 2048,
    recVramMb: 6144,
    minStorageGb: 150,
    directXVersion: 'DirectX 12 / Vulkan',
    cloudRecommendedFor2GbVram: true,
    providerSupportNoteAr: 'تتطلب موارد رسومية تتجاوز قدرة MX250 لتشغيل مريح؛ يُنصح بالسحابي أو خادم بعيد.',
  },
};

function normalizeGameTitle(title: string): string {
  return title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function buildDemoGraphicsRecommendations(
  req: VerifiedGameRequirementProfile | null,
  vramMb: number | null,
  primaryGpu: string | null
): GraphicsSettingRecommendation[] {
  if (!req) {
    return [
      {
        settingKey: 'resolution',
        settingNameAr: 'دقة العرض (Resolution)',
        recommendedValueAr: '1280×720 (آمن مبدئياً)',
        basis: 'hardware_estimate',
        basisLabelAr: 'تقدير مبني على العتاد',
        reasonAr: 'تقدير محافظ حتى تتوفر متطلبات رسمية موثقة للعبة.',
      },
      {
        settingKey: 'textures',
        settingNameAr: 'جودة الخامات (Textures)',
        recommendedValueAr: 'Low / Normal',
        basis: 'hardware_estimate',
        basisLabelAr: 'تقدير مبني على العتاد',
        reasonAr: `لتفادي امتلاء ذاكرة ${vramMb !== null ? `${vramMb} MB` : 'VRAM'}.`,
      },
      {
        settingKey: 'shadows',
        settingNameAr: 'الظلال (Shadows)',
        recommendedValueAr: 'Low',
        basis: 'hardware_estimate',
        basisLabelAr: 'تقدير مبني على العتاد',
        reasonAr: 'يخفف العبء على بطاقة الرسوميات.',
      },
      {
        settingKey: 'anti_aliasing',
        settingNameAr: 'مضاد التعرج (Anti-Aliasing)',
        recommendedValueAr: 'FXAA أو Off',
        basis: 'hardware_estimate',
        basisLabelAr: 'تقدير مبني على العتاد',
        reasonAr: 'يتجنب كلفة MSAA العالية.',
      },
      {
        settingKey: 'effects',
        settingNameAr: 'التأثيرات البصرية (Effects)',
        recommendedValueAr: 'Low',
        basis: 'hardware_estimate',
        basisLabelAr: 'تقدير مبني على العتاد',
        reasonAr: 'يحافظ على استقرار الإطارات في المشاهد المزدحمة.',
      },
      {
        settingKey: 'view_distance',
        settingNameAr: 'مسافة الرؤية (View Distance)',
        recommendedValueAr: 'Low / Medium',
        basis: 'hardware_estimate',
        basisLabelAr: 'تقدير مبني على العتاد',
        reasonAr: 'يوازن بين وضوح اللعب واستهلاك المعالج.',
      },
      {
        settingKey: 'vsync',
        settingNameAr: 'المزامنة العمودية (V-Sync)',
        recommendedValueAr: 'Off (أو On عند التمزق)',
        basis: 'hardware_estimate',
        basisLabelAr: 'تقدير مبني على العتاد',
        reasonAr: 'يقلل زمن تأخر الإدخال.',
      },
      {
        settingKey: 'fps_target',
        settingNameAr: 'الهدف الإطاري (FPS Target)',
        recommendedValueAr: 'غير محدد (المتطلبات غير موثقة)',
        basis: 'unknown',
        basisLabelAr: 'غير متوفر',
        reasonAr: 'لا يمكن تحديد هدف إطاري موثق قبل معرفة متطلبات اللعبة.',
      },
    ];
  }

  const isLight = req.recVramMb <= 1024;
  const gpuLabel = primaryGpu ?? 'بطاقة 2GB VRAM';

  return [
    {
      settingKey: 'resolution',
      settingNameAr: 'دقة العرض (Resolution)',
      recommendedValueAr: isLight ? '1920×1080' : '1280×720 أو 1600×900',
      basis: 'hardware_estimate',
      basisLabelAr: 'تقدير مبني على العتاد',
      reasonAr: `متوازن لقدرات ${gpuLabel} مع متطلبات ${req.canonicalTitle}.`,
    },
    {
      settingKey: 'textures',
      settingNameAr: 'جودة الخامات (Textures)',
      recommendedValueAr: isLight ? 'Medium' : 'Low / Normal',
      basis: 'verified_profile',
      basisLabelAr: 'موثّق وفق حد VRAM',
      reasonAr: `الموصى به رسمياً ${req.recVramMb} MB VRAM؛ ضبط الخامات يمنع التقطيع المفاجئ.`,
    },
    {
      settingKey: 'shadows',
      settingNameAr: 'الظلال (Shadows)',
      recommendedValueAr: 'Low',
      basis: 'hardware_estimate',
      basisLabelAr: 'تقدير مبني على العتاد',
      reasonAr: 'يوفّر هامش أداء ملموس في بطاقات الفئة الاقتصادية.',
    },
    {
      settingKey: 'anti_aliasing',
      settingNameAr: 'مضاد التعرج (Anti-Aliasing)',
      recommendedValueAr: 'FXAA أو Off',
      basis: 'hardware_estimate',
      basisLabelAr: 'تقدير مبني على العتاد',
      reasonAr: 'أقل كلفة بكثير من MSAA/TAA High على MX250.',
    },
    {
      settingKey: 'effects',
      settingNameAr: 'التأثيرات البصرية (Effects)',
      recommendedValueAr: isLight ? 'Medium' : 'Low',
      basis: 'hardware_estimate',
      basisLabelAr: 'تقدير مبني على العتاد',
      reasonAr: 'يقلل هبوط الإطارات أثناء الانفجارات والمؤثرات.',
    },
    {
      settingKey: 'view_distance',
      settingNameAr: 'مسافة الرؤية (View Distance)',
      recommendedValueAr: isLight ? 'Medium' : 'Low / Medium',
      basis: 'hardware_estimate',
      basisLabelAr: 'تقدير مبني على العتاد',
      reasonAr: 'يحمي معالج i7-10610U من الاختناق الحراري.',
    },
    {
      settingKey: 'vsync',
      settingNameAr: 'المزامنة العمودية (V-Sync)',
      recommendedValueAr: 'Off',
      basis: 'verified_profile',
      basisLabelAr: 'موثّق لألعاب المنافسة',
      reasonAr: 'يقلل Input Lag مع إمكانية تحديد حد للإطارات.',
    },
    {
      settingKey: 'fps_target',
      settingNameAr: 'الهدف الإطاري (FPS Target)',
      recommendedValueAr: isLight ? '60 - 120 FPS (مقترح)' : '45 - 60 FPS (مقترح)',
      basis: 'hardware_estimate',
      basisLabelAr: 'تقدير مبني على العتاد',
      reasonAr: 'هدف عملي للحفاظ على ثبات الحرارة وتجربة لعب مستقرة دون ضمانات.',
    },
  ];
}

export function buildDemoSmartGameAnalysis(
  game: InstalledGame,
  hardware: HardwareProfile = DEMO_HARDWARE,
  performance: PerformanceSnapshotResponse | null = buildDemoPerformanceSample()
): SmartGameAnalysisResponse {
  const verifiedProfile = VERIFIED_GAME_CATALOG[normalizeGameTitle(game.title)] ?? null;
  const vramMb = hardware.gpu.vramTotalMb;
  const totalRamGb = hardware.memory.totalGb;
  const availRamGb = hardware.memory.availableGb;
  const cpuUsage = performance?.sample.cpuUsagePercent ?? null;
  const ramUsedGb = performance?.sample.ramUsedGb ?? null;

  const hardwareChecks = {
    cpuStatusAr: hardware.cpu.model
      ? `${hardware.cpu.model} (${hardware.cpu.cores ?? 0} أنوية / ${hardware.cpu.threads ?? 0} خيوط)`
      : 'غير متاح من مستشعر النظام',
    ramStatusAr:
      totalRamGb !== null
        ? `الإجمالي ${totalRamGb.toFixed(1)} GB · المتاح الآن ${availRamGb !== null && availRamGb !== undefined ? `${availRamGb.toFixed(1)} GB` : 'غير محدد'}`
        : 'غير متاح',
    gpuAndVramStatusAr: hardware.gpu.primaryModel
      ? `${hardware.gpu.primaryModel} (${vramMb !== null ? `${vramMb} MB VRAM` : 'VRAM غير متاح'}) · المدمج: ${hardware.gpu.integratedModel ?? 'غير متاح'}`
      : 'بطاقة الرسوميات غير متاحة',
    storageStatusAr: `${hardware.storage.freeSpaceGb.toFixed(1)} GB متاحة من أصل ${hardware.storage.totalSpaceGb.toFixed(1)} GB`,
    driverStatusAr: hardware.gpu.driverVersion
      ? `إصدار التعريف: ${hardware.gpu.driverVersion}`
      : 'إصدار التعريف غير متاح',
    systemLoadNoteAr:
      cpuUsage !== null || ramUsedGb !== null
        ? `الحمل الحالي: CPU ${cpuUsage !== null ? `${Math.round(cpuUsage)}%` : 'غير متاح'} · RAM المستخدم ${ramUsedGb !== null ? `${ramUsedGb.toFixed(1)} GB` : 'غير متاح'}`
        : 'حمل النظام الحي غير متاح حالياً',
  };

  if (!verifiedProfile) {
    return {
      gameId: game.id,
      gameTitle: game.title,
      version: game.version ?? null,
      executablePath: game.executablePath,
      launcher: game.launcher,
      coverImageUrl: game.coverImageUrl ?? null,
      analyzedAt: new Date().toISOString(),
      compatibility: 'unknown',
      compatibilityLabelAr: 'غير معروف (Unknown)',
      compatibilityExplanationAr:
        'تعذر العثور على متطلبات رسمية موثقة لهذه اللعبة؛ لذا لم يتم تخمين التوافق أو تقدير معدل الإطارات.',
      hardwareChecks,
      requirements: {
        status: 'unknown',
        sourceLabelAr: 'لا توجد بيانات متطلبات موثقة لهذه اللعبة في القاعدة المحلية (لم يتم التخمين)',
        minCpuAr: null,
        recCpuAr: null,
        minRamGb: null,
        recRamGb: null,
        minVramMb: null,
        recVramMb: null,
        minStorageGb: null,
        directXVersion: null,
      },
      evidenceBasedFpsRangeAr: null,
      fpsRangeSupported: false,
      graphicsRecommendations: buildDemoGraphicsRecommendations(null, vramMb, hardware.gpu.primaryModel),
      cloudAssessment: {
        recommendedInCloud: false,
        internetRequirementAr: '15 - 25 Mbps للبث السحابي بدقة 720p/1080p',
        latencyRequirementAr: 'أقل من 50 ms (غير مقاس حالياً)',
        costNoteAr: 'يتطلب اشتراكاً لدى مزوّد سحابي متوافق أو خادم Windows GPU خاصاً بك.',
        providerSupportNoteAr: 'تحقق يدوياً من توفر اللعبة في كتالوج المزوّد السحابي.',
        isCloudHardwareConnected: false,
      },
      safeOptimizationSummaryAr:
        'يمكن تطبيق خطة الطاقة وتفضيل البطاقة المخصصة عبر Windows Settings فقط بعد معاينتك وموافقتك.',
    };
  }

  let compatibility: SmartCompatibilityTier = 'unknown';
  let compatibilityLabelAr = 'غير معروف (Unknown)';
  let compatibilityExplanationAr = '';
  let evidenceBasedFpsRangeAr: string | null = null;
  let fpsRangeSupported = false;

  if (vramMb === null || totalRamGb === null) {
    compatibility = 'unknown';
    compatibilityLabelAr = 'غير معروف (Unknown)';
    compatibilityExplanationAr =
      'بيانات العتاد الفعلية (VRAM أو RAM) غير مكتملة؛ لا يمكن الجزم بالتوافق دون قراءة كاملة.';
  } else if (vramMb < verifiedProfile.minVramMb) {
    compatibility = 'not_recommended';
    compatibilityLabelAr = 'غير موصى به (Not Recommended)';
    compatibilityExplanationAr = `ذاكرة الرسوميات المتاحة (${vramMb} MB VRAM) أقل من الحد الأدنى الرسمي للعبة (${verifiedProfile.minVramMb} MB VRAM). قد لا تعمل اللعبة بسلاسة وقد تحدث أعطال؛ يُنصح بالتشغيل السحابي.`;
  } else if (totalRamGb < verifiedProfile.minRamGb) {
    compatibility = 'not_recommended';
    compatibilityLabelAr = 'غير موصى به (Not Recommended)';
    compatibilityExplanationAr = `الذاكرة العشوائية (${totalRamGb.toFixed(1)} GB) أقل من الحد الأدنى الرسمي (${verifiedProfile.minRamGb.toFixed(1)} GB).`;
  } else if (
    vramMb >= verifiedProfile.recVramMb &&
    totalRamGb >= verifiedProfile.recRamGb &&
    verifiedProfile.recVramMb <= 1024
  ) {
    compatibility = 'excellent';
    compatibilityLabelAr = 'ممتاز (Excellent)';
    compatibilityExplanationAr = `جهازك يتجاوز المتطلبات الموصى بها (${verifiedProfile.recRamGb.toFixed(1)} GB RAM و ${verifiedProfile.recVramMb} MB VRAM)، ما يتيح تشغيلاً سلساً ومستقراً.`;
    evidenceBasedFpsRangeAr = '90 - 135 FPS (تقدير مبني على متطلبات الفئة الخفيفة ودقة 1080p منخفض/متوسط)';
    fpsRangeSupported = true;
  } else if (vramMb >= verifiedProfile.recVramMb && totalRamGb >= verifiedProfile.recRamGb) {
    compatibility = 'good';
    compatibilityLabelAr = 'جيد (Good)';
    compatibilityExplanationAr = `العتاد يفي بالمتطلبات الموصى بها (${verifiedProfile.recRamGb.toFixed(1)} GB RAM و ${verifiedProfile.recVramMb} MB VRAM) مع الحاجة لضبط الخامات والظلال لتحقيق استقرار جيد.`;
    evidenceBasedFpsRangeAr = '55 - 85 FPS (تقدير مبني على حدود 2GB VRAM بدقة 720p/900p)';
    fpsRangeSupported = true;
  } else {
    compatibility = 'limited';
    compatibilityLabelAr = 'محدود (Limited)';
    compatibilityExplanationAr = `الجهاز يحقق الحد الأدنى (${verifiedProfile.minVramMb} MB VRAM) لكنه أقل من الموصى به (${verifiedProfile.recVramMb} MB VRAM)؛ يلزم خفض دقة العرض إلى 720p والخامات إلى Low/Normal.`;
    evidenceBasedFpsRangeAr = '35 - 55 FPS (تقدير مبني على الحد الأدنى عند دقة 720p منخفض)';
    fpsRangeSupported = true;
  }

  return {
    gameId: game.id,
    gameTitle: game.title,
    version: game.version ?? null,
    executablePath: game.executablePath,
    launcher: game.launcher,
    coverImageUrl: game.coverImageUrl ?? null,
    analyzedAt: new Date().toISOString(),
    compatibility,
    compatibilityLabelAr,
    compatibilityExplanationAr,
    hardwareChecks,
    requirements: {
      status: 'verified_metadata',
      sourceLabelAr: verifiedProfile.sourceLabelAr,
      minCpuAr: verifiedProfile.minCpuAr,
      recCpuAr: verifiedProfile.recCpuAr,
      minRamGb: verifiedProfile.minRamGb,
      recRamGb: verifiedProfile.recRamGb,
      minVramMb: verifiedProfile.minVramMb,
      recVramMb: verifiedProfile.recVramMb,
      minStorageGb: verifiedProfile.minStorageGb,
      directXVersion: verifiedProfile.directXVersion,
    },
    evidenceBasedFpsRangeAr,
    fpsRangeSupported,
    graphicsRecommendations: buildDemoGraphicsRecommendations(
      verifiedProfile,
      vramMb,
      hardware.gpu.primaryModel
    ),
    cloudAssessment: {
      recommendedInCloud: verifiedProfile.cloudRecommendedFor2GbVram || compatibility === 'not_recommended',
      internetRequirementAr: '15 - 25 Mbps (أو 10+ Mbps للحد الأدنى 720p)',
      latencyRequirementAr: 'يفضل أقل من 45 - 60 ms عبر Wi-Fi 5GHz أو Ethernet',
      costNoteAr: 'يتطلب حساباً واشتراكاً ساريين في GeForce NOW / Xbox Cloud / Boosteroid أو خادم GPU خاصاً.',
      providerSupportNoteAr: verifiedProfile.providerSupportNoteAr,
      isCloudHardwareConnected: false,
    },
    safeOptimizationSummaryAr:
      'يُوصى باختيار بطاقة NVIDIA في إعدادات ويندوز وتفعيل Game Mode وإغلاق البرامج غير الضرورية التي تختارها بنفسك دون المساس بملفات اللعبة أو برامج الحماية.',
  };
}
