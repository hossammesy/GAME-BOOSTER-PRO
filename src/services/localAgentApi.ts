import {
  DEMO_HARDWARE,
  DEMO_HEALTH,
  DEMO_INSTALLED_GAMES,
  buildDemoOptimizationAnalysis,
  buildDemoPerformanceSample,
  buildDemoPreview,
  buildDemoSmartGameAnalysis,
} from '../data/demoData';
import type {
  AgentConnectionConfig,
  AgentHealthResponse,
  ConnectionState,
  FileSystemBrowseResponse,
  GameLaunchRequest,
  GameLaunchResponse,
  GameScanResponse,
  HardwareProfile,
  InstalledGame,
  OptimizationAnalysisResponse,
  OptimizationApplyRequest,
  OptimizationApplyResponse,
  OptimizationPreviewResponse,
  OptimizationRestoreResponse,
  PerformanceSnapshotResponse,
  SmartGameAnalysisResponse,
} from '../types/agent';

export class LocalAgentError extends Error {
  public readonly connectionState: ConnectionState;
  public readonly statusCode?: number;

  constructor(
    message: string,
    connectionState: ConnectionState,
    statusCode?: number
  ) {
    super(message);
    this.name = 'LocalAgentError';
    this.connectionState = connectionState;
    this.statusCode = statusCode;
  }
}

export function validateLocalhostBaseUrl(rawUrl: string): {
  valid: boolean;
  normalized: string;
  reasonAr?: string;
} {
  try {
    const trimmed = rawUrl.trim().replace(/\/+$/, '');
    const parsed = new URL(trimmed);
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    const isLoopback =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    if (!isHttp) {
      return {
        valid: false,
        normalized: trimmed,
        reasonAr: 'يجب استخدام بروتوكول HTTP أو HTTPS المحلي فقط.',
      };
    }

    if (!isLoopback) {
      return {
        valid: false,
        normalized: trimmed,
        reasonAr:
          'لأسباب أمنية، يُسمح فقط بالاتصال بعنوان محلي (localhost أو 127.0.0.1).',
      };
    }

    return { valid: true, normalized: trimmed };
  } catch {
    return {
      valid: false,
      normalized: rawUrl,
      reasonAr: 'صيغة عنوان الوكيل المحلي غير صالحة (مثال: http://127.0.0.1:48920).',
    };
  }
}

const ALLOWED_TWEAK_IDS = new Set([
  'tweak_power_plan',
  'tweak_gpu_pref',
  'tweak_game_mode',
  'tweak_bg_apps',
]);

export function validateGameExecutablePath(rawPath: string): {
  valid: boolean;
  normalized: string;
  executableName: string;
  installPath: string;
  reasonAr?: string;
} {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return {
      valid: false,
      normalized: '',
      executableName: '',
      installPath: '',
      reasonAr: 'يرجى إدخال المسار الكامل للملف التنفيذي (.exe).',
    };
  }
  if (/[;&|`$<>]/.test(trimmed)) {
    return {
      valid: false,
      normalized: '',
      executableName: '',
      installPath: '',
      reasonAr: 'المسار يحتوي على رموز غير مسموح بها أمنياً.',
    };
  }
  const windowsExePattern = /^[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]+\.exe$/i;
  if (!windowsExePattern.test(trimmed)) {
    return {
      valid: false,
      normalized: trimmed,
      executableName: '',
      installPath: '',
      reasonAr: 'يجب أن يكون مسار ويندوز صحيحاً وينتهي بـ .exe (مثال: C:\\Games\\Game\\game.exe).',
    };
  }
  const lastSlash = trimmed.lastIndexOf('\\');
  return {
    valid: true,
    normalized: trimmed,
    executableName: trimmed.slice(lastSlash + 1),
    installPath: trimmed.slice(0, lastSlash),
  };
}

export const LOCAL_AGENT_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/health', summaryAr: 'التحقق من حالة الوكيل المحلي والصلاحيات' },
  { method: 'GET', path: '/api/v1/hardware', summaryAr: 'قراءة مواصفات المعالج والذاكرة وبطاقة الرسوميات' },
  { method: 'GET', path: '/api/v1/games', summaryAr: 'جلب قائمة الألعاب المثبتة المكتشفة مسبقاً' },
  { method: 'POST', path: '/api/v1/games/scan', summaryAr: 'فحص Steam وEpic وXbox والاختصارات والمجلدات المخصصة' },
  { method: 'GET', path: '/api/v1/games/folders', summaryAr: 'إدارة مجلدات الألعاب المخصصة المحفوظة محلياً' },
  { method: 'PUT', path: '/api/v1/games/manual/{id}', summaryAr: 'تعديل بيانات لعبة مسجلة يدوياً في قاعدة SQLite المحلية' },
  { method: 'POST', path: '/api/v1/games/{id}/favorite', summaryAr: 'حفظ حالة المفضلة للعبة محلياً بدون سحابة' },
  { method: 'GET', path: '/api/v1/filesystem/browse', summaryAr: 'تصفح مجلدات ويندوز واختيار ملف .exe يدوياً بأمان' },
  { method: 'GET', path: '/api/v1/games/{id}/analyze', summaryAr: 'التحليل الذكي للعبة مقارنةً بالعتاد وإصدار توصيات الرسوميات الـ 8' },
  { method: 'POST', path: '/api/v1/games/{id}/launch', summaryAr: 'التشغيل الآمن للعبة عبر EXE أو المشغّل الرسمي بدون حقن' },
  { method: 'GET', path: '/api/v1/performance', summaryAr: 'قراءة استهلاك CPU/RAM/GPU/VRAM والحرارة ومعدل الإطارات' },
  { method: 'POST', path: '/api/v1/optimization/analyze', summaryAr: 'تحليل العتاد واقتراح تحسينات آمنة وإعدادات داخل اللعبة' },
  { method: 'POST', path: '/api/v1/optimization/preview', summaryAr: 'معاينة التغييرات الدقيقة قبل تطبيقها وإنشاء نقطة استعادة' },
  { method: 'POST', path: '/api/v1/optimization/apply', summaryAr: 'تطبيق التحسينات بعد تأكيد المستخدم الصريح فقط' },
  { method: 'POST', path: '/api/v1/optimization/restore', summaryAr: 'استعادة إعدادات النظام الافتراضية من آخر نسخة احتياطية' },
  { method: 'GET', path: '/api/v1/settings', summaryAr: 'جلب إعدادات التطبيق المحفوظة في قاعدة SQLite المحلية' },
  { method: 'PUT', path: '/api/v1/settings', summaryAr: 'حفظ إعدادات التطبيق محلياً في قاعدة SQLite بدون حساب سحابي' },
] as const;

export class LocalAgentClient {
  private config: AgentConnectionConfig;
  private demoTweaksApplied = false;
  private demoLastSnapshotId: string | null = null;
  private demoGames: InstalledGame[] = [...DEMO_INSTALLED_GAMES];

  constructor(config: AgentConnectionConfig) {
    this.config = config;
  }

  public updateConfig(config: AgentConnectionConfig): void {
    this.config = config;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const check = validateLocalhostBaseUrl(this.config.baseUrl);
    if (!check.valid) {
      throw new LocalAgentError(
        check.reasonAr ?? 'عنوان الوكيل غير صالح',
        'error'
      );
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4500);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Client-Origin': window.location.origin,
      };
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }
      if (this.config.authToken.trim()) {
        headers['Authorization'] = `Bearer ${this.config.authToken.trim()}`;
      }

      const response = await fetch(`${check.normalized}${endpoint}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new LocalAgentError(
          'رفض الوكيل المحلي الطلب: رمز المصادقة مفقود أو غير صالح، أو يتطلب صلاحية موافقة على الأصل (Origin).',
          'permission_required',
          response.status
        );
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new LocalAgentError(
          text || `استجاب الوكيل المحلي برمز خطأ (${response.status}).`,
          'error',
          response.status
        );
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof LocalAgentError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new LocalAgentError(
          'انتهت مهلة الاتصال بالوكيل المحلي (Timeout). تأكد من تشغيل خدمة GAME BOOSTER PRO Agent على ويندوز.',
          'disconnected'
        );
      }
      throw new LocalAgentError(
        'تعذر الوصول إلى الوكيل المحلي على localhost. تأكد من تشغيله على المنفذ المحدد أو فعّل وضع العرض التجريبي.',
        'disconnected'
      );
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  public async getHealth(): Promise<AgentHealthResponse> {
    if (this.config.demoMode) {
      return { ...DEMO_HEALTH, timestamp: new Date().toISOString() };
    }
    return this.request<AgentHealthResponse>('GET', '/api/v1/health');
  }

  public async getHardware(): Promise<HardwareProfile> {
    if (this.config.demoMode) {
      return {
        ...DEMO_HARDWARE,
        activePowerPlan: this.demoTweaksApplied
          ? 'أداء عالٍ (High Performance)'
          : 'متوازن (Balanced)',
      };
    }
    return this.request<HardwareProfile>('GET', '/api/v1/hardware');
  }

  public async getGames(): Promise<InstalledGame[]> {
    if (this.config.demoMode) {
      return this.demoGames.map((g) => ({ ...g }));
    }
    return this.request<InstalledGame[]>('GET', '/api/v1/games');
  }

  public async registerManualGameOnAgent(payload: {
    title: string;
    executablePath: string;
    launcher: string;
    detectedGpu?: string;
    sizeGb?: number;
    vramRequirementMb?: number;
  }): Promise<InstalledGame> {
    return this.request<InstalledGame>('POST', '/api/v1/games/manual', payload);
  }

  public async updateManualGameOnAgent(
    gameId: string,
    payload: {
      title: string;
      executablePath: string;
      launcher: string;
      detectedGpu?: string;
      sizeGb?: number;
      vramRequirementMb?: number;
    }
  ): Promise<InstalledGame> {
    return this.request<InstalledGame>(
      'PUT',
      `/api/v1/games/manual/${encodeURIComponent(gameId)}`,
      payload
    );
  }

  public async deleteManualGameOnAgent(gameId: string): Promise<void> {
    const check = validateLocalhostBaseUrl(this.config.baseUrl);
    if (!check.valid) return;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Client-Origin': window.location.origin,
    };
    if (this.config.authToken.trim()) {
      headers['Authorization'] = `Bearer ${this.config.authToken.trim()}`;
    }
    await fetch(`${check.normalized}/api/v1/games/manual/${encodeURIComponent(gameId)}`, {
      method: 'DELETE',
      headers,
    });
  }

  public async getSettingsFromAgent(): Promise<Record<string, string>> {
    if (this.config.demoMode) return {};
    return this.request<Record<string, string>>('GET', '/api/v1/settings');
  }

  public async saveSettingsToAgent(
    settings: Record<string, string>
  ): Promise<Record<string, string>> {
    if (this.config.demoMode) return settings;
    return this.request<Record<string, string>>('PUT', '/api/v1/settings', settings);
  }

  public async scanGames(customFolders?: string[]): Promise<GameScanResponse> {
    if (this.config.demoMode) {
      return {
        scannedAt: new Date().toISOString(),
        scannedLocations: [
          'C:\\Program Files (x86)\\Steam\\steamapps',
          'C:\\Program Files\\Epic Games',
          'C:\\XboxGames',
          'C:\\Riot Games',
          'D:\\Games\\SteamLibrary',
          ...(customFolders ?? []),
        ],
        gamesFound: this.demoGames.length,
        games: this.demoGames.map((g) => ({ ...g })),
      };
    }
    return this.request<GameScanResponse>(
      'POST',
      '/api/v1/games/scan',
      customFolders && customFolders.length > 0 ? { customFolders } : undefined
    );
  }

  public async getCustomFolders(): Promise<string[]> {
    if (this.config.demoMode) return [];
    return this.request<string[]>('GET', '/api/v1/games/folders');
  }

  public async addCustomFolder(folderPath: string): Promise<string[]> {
    return this.request<string[]>('POST', '/api/v1/games/folders', { folderPath });
  }

  public async removeCustomFolder(folderPath: string): Promise<string[]> {
    return this.request<string[]>('POST', '/api/v1/games/folders/remove', { folderPath });
  }

  public async toggleFavoriteOnAgent(gameId: string, isFavorite: boolean): Promise<void> {
    if (this.config.demoMode) return;
    await this.request('POST', `/api/v1/games/${encodeURIComponent(gameId)}/favorite`, {
      isFavorite,
    });
  }

  public async browseFileSystem(path?: string): Promise<FileSystemBrowseResponse> {
    if (this.config.demoMode) {
      throw new LocalAgentError(
        'تصفح أقراص ويندوز الحقيقية غير متاح في الوضع التجريبي؛ يرجى ربط الوكيل المحلي أو تشغيل تطبيق سطح المكتب.',
        'disconnected'
      );
    }
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    return this.request<FileSystemBrowseResponse>('GET', `/api/v1/filesystem/browse${query}`);
  }

  public async getPerformance(): Promise<PerformanceSnapshotResponse> {
    if (this.config.demoMode) {
      return buildDemoPerformanceSample();
    }
    return this.request<PerformanceSnapshotResponse>('GET', '/api/v1/performance');
  }

  public async analyzeOptimization(
    targetGameId: string | null
  ): Promise<OptimizationAnalysisResponse> {
    if (this.config.demoMode) {
      const targetGame =
        this.demoGames.find((g) => g.id === targetGameId) ?? null;
      return buildDemoOptimizationAnalysis(targetGame, this.demoTweaksApplied);
    }
    return this.request<OptimizationAnalysisResponse>(
      'POST',
      '/api/v1/optimization/analyze',
      { targetGameId }
    );
  }

  public async previewOptimization(
    targetGameId: string | null,
    tweakIds: string[]
  ): Promise<OptimizationPreviewResponse> {
    if (this.config.demoMode) {
      const targetGame =
        this.demoGames.find((g) => g.id === targetGameId) ?? null;
      const analysis = buildDemoOptimizationAnalysis(
        targetGame,
        this.demoTweaksApplied
      );
      return buildDemoPreview(analysis, tweakIds);
    }
    return this.request<OptimizationPreviewResponse>(
      'POST',
      '/api/v1/optimization/preview',
      { targetGameId, tweakIds }
    );
  }

  public async applyOptimization(
    payload: OptimizationApplyRequest
  ): Promise<OptimizationApplyResponse> {
    if (!payload.explicitUserConfirmation) {
      throw new LocalAgentError(
        'مطلوب موافقة صريحة من المستخدم قبل تطبيق أي تعديل على النظام.',
        'permission_required'
      );
    }

    const hasDisallowedTweak = payload.tweakIds.some(
      (id) => !ALLOWED_TWEAK_IDS.has(id)
    );
    if (hasDisallowedTweak) {
      throw new LocalAgentError(
        'تم رفض الطلب: يحتوي على معرف تعديل غير مصرح به ضمن السياسة الآمنة.',
        'permission_required'
      );
    }

    if (this.config.demoMode) {
      this.demoTweaksApplied = true;
      this.demoLastSnapshotId = `snap_win11_${Date.now()}`;
      if (payload.targetGameId) {
        this.demoGames = this.demoGames.map((g) =>
          g.id === payload.targetGameId
            ? { ...g, isOptimizedProfileActive: true }
            : g
        );
      }
      return {
        appliedAt: new Date().toISOString(),
        backupSnapshotId: this.demoLastSnapshotId,
        appliedCount: payload.tweakIds.length,
        status: 'applied',
        messageAr:
          'تم تطبيق تحسينات النظام الآمنة (في وضع العرض التجريبي) مع إنشاء نسخة احتياطية للاستعادة دون لمس ملفات EXE/DLL/CFG/INI أو خدمات الأمان.',
      };
    }

    return this.request<OptimizationApplyResponse>(
      'POST',
      '/api/v1/optimization/apply',
      payload
    );
  }

  public async restoreOptimization(): Promise<OptimizationRestoreResponse> {
    if (this.config.demoMode) {
      this.demoTweaksApplied = false;
      const snap = this.demoLastSnapshotId ?? 'snap_win11_default';
      this.demoLastSnapshotId = null;
      this.demoGames = this.demoGames.map((g) => ({
        ...g,
        isOptimizedProfileActive: g.id === 'rocket-league',
      }));
      return {
        restoredAt: new Date().toISOString(),
        restoredFromSnapshotId: snap,
        status: 'restored',
        messageAr:
          'تمت استعادة خطة الطاقة وتفضيلات النظام الافتراضية بنجاح (وضع العرض التجريبي).',
      };
    }

    return this.request<OptimizationRestoreResponse>(
      'POST',
      '/api/v1/optimization/restore'
    );
  }

  public async analyzeGameSmart(
    gameId: string,
    gameFallback?: InstalledGame | null,
    hardwareFallback?: HardwareProfile | null,
    perfFallback?: PerformanceSnapshotResponse | null
  ): Promise<SmartGameAnalysisResponse> {
    if (this.config.demoMode) {
      const target =
        this.demoGames.find((g) => g.id === gameId) ?? gameFallback;
      if (!target) {
        throw new LocalAgentError('اللعبة المطلوبة غير موجودة.', 'error', 404);
      }
      return buildDemoSmartGameAnalysis(
        target,
        hardwareFallback ?? DEMO_HARDWARE,
        perfFallback ?? buildDemoPerformanceSample()
      );
    }

    return this.request<SmartGameAnalysisResponse>(
      'GET',
      `/api/v1/games/${encodeURIComponent(gameId)}/analyze`
    );
  }

  public async launchGameSafely(
    gameId: string,
    payload: GameLaunchRequest,
    gameFallback?: InstalledGame | null
  ): Promise<GameLaunchResponse> {
    const now = new Date().toISOString();
    if (this.config.demoMode) {
      if (payload.mode === 'cloud') {
        return {
          launched: false,
          status: 'agent_required',
          mode: 'cloud',
          pid: null,
          messageAr:
            'لا يوجد مزوّد بث سحابي متصل بالمنصة حالياً؛ استخدم رابط المزوّد الرسمي أو عميل الخادم البعيد من قسم الوضع السحابي.',
          timestamp: now,
        };
      }
      const title =
        this.demoGames.find((g) => g.id === gameId)?.title ??
        gameFallback?.title ??
        'اللعبة';
      return {
        launched: false,
        status: 'agent_required',
        mode: 'local',
        pid: null,
        messageAr: `وضع العرض التجريبي لا يستطيع تشغيل ملفات Windows (.exe). لتشغيل "${title}" فعلياً، صل الوكيل المحلي على نظام ويندوز 11.`,
        timestamp: now,
      };
    }

    return this.request<GameLaunchResponse>(
      'POST',
      `/api/v1/games/${encodeURIComponent(gameId)}/launch`,
      payload
    );
  }
}
