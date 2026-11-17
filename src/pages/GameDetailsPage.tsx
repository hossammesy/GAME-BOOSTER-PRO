import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Cpu,
  Eye,
  FileCode2,
  Gamepad2,
  HardDrive,
  Laptop,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Wifi,
} from 'lucide-react';
import { ConfirmOptimizationModal } from '../components/ConfirmOptimizationModal';
import { DisconnectedPrompt } from '../components/DisconnectedPrompt';
import { PrePlayOptimizeModal } from '../components/PrePlayOptimizeModal';
import { useAgent } from '../context/AgentContext';
import type { SmartCompatibilityTier } from '../types/agent';

const TIER_STYLES: Record<
  SmartCompatibilityTier,
  { textClass: string; bgClass: string; borderClass: string }
> = {
  excellent: {
    textClass: 'text-emerald-700 dark:text-emerald-300',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/35',
    borderClass: 'border-emerald-200 dark:border-emerald-800/60',
  },
  good: {
    textClass: 'text-sky-700 dark:text-sky-300',
    bgClass: 'bg-sky-50 dark:bg-sky-950/35',
    borderClass: 'border-sky-200 dark:border-sky-800/60',
  },
  limited: {
    textClass: 'text-amber-700 dark:text-amber-300',
    bgClass: 'bg-amber-50 dark:bg-amber-950/35',
    borderClass: 'border-amber-200 dark:border-amber-800/60',
  },
  not_recommended: {
    textClass: 'text-rose-700 dark:text-rose-300',
    bgClass: 'bg-rose-50 dark:bg-rose-950/35',
    borderClass: 'border-rose-200 dark:border-rose-800/60',
  },
  unknown: {
    textClass: 'text-slate-700 dark:text-slate-300',
    bgClass: 'bg-slate-100 dark:bg-[#1E3E62]/40',
    borderClass: 'border-slate-300 dark:border-[#2E5077]',
  },
};

export const GameDetailsPage: React.FC = () => {
  const {
    connectionState,
    config,
    games,
    performance,
    remoteGpuProfiles,
    selectedGameDetailsId,
    closeGameDetails,
    smartGameAnalysis,
    isAnalyzingGameDetails,
    analyzeGameDetails,
    launchStatus,
    isLaunchingGame,
    launchGame,
    selectedBackgroundPids,
    toggleBackgroundPid,
    optimizationPreview,
    setOptimizationPreview,
    isApplyingOptimization,
    requestOptimizationPreview,
    confirmAndApplyOptimization,
    restoreDefaultSettings,
    refreshPerformance,
    setActiveSection,
    toggleFavorite,
  } = useAgent();

  const [selectedMode, setSelectedMode] = useState<'local' | 'cloud'>('local');
  const [imageFailed, setImageFailed] = useState(false);
  const [showPrePlayModal, setShowPrePlayModal] = useState(false);

  const selectedGame = games.find((g) => g.id === selectedGameDetailsId) ?? null;

  useEffect(() => {
    setImageFailed(false);
    if (smartGameAnalysis?.cloudAssessment.recommendedInCloud) {
      setSelectedMode('cloud');
    } else if (smartGameAnalysis) {
      setSelectedMode('local');
    }
  }, [smartGameAnalysis]);

  if (connectionState !== 'connected' && !config.demoMode) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={closeGameDetails}
          className="inline-flex items-center gap-2 text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى ألعابي</span>
        </button>
        <DisconnectedPrompt
          contextTitleAr="التحليل الذكي للعبة يتطلب اتصالاً بالوكيل المحلي"
          contextDescriptionAr="لتقييم العتاد الفعلي ومقارنته بمتطلبات اللعبة وتشغيلها بأمان، اتصل بالوكيل المحلي على ويندوز 11 أو فعّل وضع العرض التجريبي."
        />
      </div>
    );
  }

  if (!selectedGameDetailsId || !selectedGame) {
    return (
      <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-8 text-center space-y-3">
        <Gamepad2 className="w-8 h-8 text-slate-400 mx-auto" />
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          لم يتم تحديد لعبة للعرض
        </div>
        <button
          type="button"
          onClick={closeGameDetails}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى قائمة الألعاب</span>
        </button>
      </div>
    );
  }

  const tierStyle = smartGameAnalysis
    ? TIER_STYLES[smartGameAnalysis.compatibility]
    : TIER_STYLES.unknown;

  const safeBackgroundProcesses =
    performance?.topProcesses.filter((p) => p.canSafelyPause) ?? [];

  const handlePreLaunchScan = async () => {
    await Promise.all([
      analyzeGameDetails(selectedGame.id),
      refreshPerformance(),
    ]);
  };

  const handlePreviewSafeTweaks = async () => {
    const tweaks = ['tweak_power_plan', 'tweak_gpu_pref', 'tweak_game_mode'];
    if (selectedBackgroundPids.length > 0) {
      tweaks.push('tweak_bg_apps');
    }
    await requestOptimizationPreview(selectedGame.id, tweaks);
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={closeGameDetails}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors"
        >
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
          <span>العودة إلى ألعابي</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void handlePreLaunchScan()}
            disabled={isAnalyzingGameDetails}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium border border-slate-300 dark:border-[#2E5077] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors disabled:opacity-60"
          >
            <RefreshCw
              className={`w-4 h-4 ${isAnalyzingGameDetails ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>فحص ما قبل التشغيل</span>
          </button>

          <button
            type="button"
            onClick={() => void restoreDefaultSettings()}
            disabled={isApplyingOptimization}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>استعادة الافتراضي</span>
          </button>
        </div>
      </div>

      {/* Game Hero Identification & Launcher Bar */}
      <section className="rounded-xl bg-white dark:bg-[#1E3E62]/30 border border-slate-200 dark:border-[#2E5077] p-6">
        <div className="flex flex-col lg:flex-row gap-6 justify-between">
          <div className="flex flex-col sm:flex-row gap-5 min-w-0">
            {/* Cover Image or Styled Fallback Frame (Zero Broken Image Policy) */}
            <div className="w-full sm:w-40 h-48 sm:h-44 shrink-0 rounded-xl overflow-hidden border border-slate-200 dark:border-[#2E5077] bg-gradient-to-br from-[#0B192C] via-[#1E3E62] to-[#2E5077] flex flex-col items-center justify-center p-4 text-center text-white">
              {smartGameAnalysis?.coverImageUrl && !imageFailed ? (
                <img
                  src={smartGameAnalysis.coverImageUrl}
                  alt={selectedGame.title}
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="space-y-2">
                  <Gamepad2 className="w-9 h-9 text-sky-300 mx-auto" aria-hidden="true" />
                  <div className="text-xs font-bold leading-snug line-clamp-2">
                    {selectedGame.title}
                  </div>
                  <div className="text-[10px] text-sky-200/80 font-mono-tabular">
                    {selectedGame.launcher}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                <span>المشغّل: {selectedGame.launcher}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular" dir="ltr">
                  الإصدار: {smartGameAnalysis?.version ?? selectedGame.version ?? 'غير معروف'}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    selectedGame.isInstalled !== false
                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-rose-600 dark:text-rose-400 font-semibold'
                  }
                >
                  {selectedGame.isInstalled !== false ? 'مثبت وجاهز' : 'الملف غير موجود'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  آخر تشغيل: {selectedGame.lastPlayed ?? 'غير مسجل'}
                </span>
                {config.demoMode && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-sky-700 dark:text-sky-300">
                      وضع العرض التجريبي
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {selectedGame.title}
                </h2>
                <button
                  type="button"
                  onClick={() => toggleFavorite(selectedGame.id)}
                  aria-label={selectedGame.isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2E5077] hover:bg-slate-100 dark:hover:bg-[#1E3E62]"
                >
                  <Star
                    className={`w-4 h-4 ${
                      selectedGame.isFavorite
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-400'
                    }`}
                  />
                </button>
              </div>

              <div
                className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 break-all flex items-start gap-1.5"
                dir="ltr"
              >
                <FileCode2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                <span>{selectedGame.executablePath}</span>
              </div>

              {smartGameAnalysis && (
                <div
                  className={`rounded-lg border px-4 py-3 space-y-1 ${tierStyle.bgClass} ${tierStyle.borderClass}`}
                >
                  <div className={`text-sm font-bold ${tierStyle.textClass}`}>
                    حالة التوافق: {smartGameAnalysis.compatibilityLabelAr}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    {smartGameAnalysis.compatibilityExplanationAr}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Launcher & Mode Selection Card */}
          <div className="lg:w-80 shrink-0 rounded-xl bg-slate-50 dark:bg-[#0B192C]/80 border border-slate-200 dark:border-[#2E5077] p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                وضع التشغيل المختار
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMode('local')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                    selectedMode === 'local'
                      ? 'bg-[#2E5077] text-white border-[#2E5077]'
                      : 'bg-white dark:bg-[#1E3E62]/30 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#2E5077]'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>محلي (Local)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMode('cloud')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                    selectedMode === 'cloud'
                      ? 'bg-[#2E5077] text-white border-[#2E5077]'
                      : 'bg-white dark:bg-[#1E3E62]/30 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#2E5077]'
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>سحابي (Cloud)</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void launchGame(selectedGame.id, selectedMode)}
                disabled={isLaunchingGame}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors disabled:opacity-60"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                <span>
                  {isLaunchingGame
                    ? 'جارٍ التحضير...'
                    : selectedMode === 'local'
                    ? 'تشغيل اللعبة (Start Game)'
                    : 'التحقق من البث السحابي'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowPrePlayModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-[#2E5077] text-[#2E5077] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-[#1E3E62] transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>فحص وتحسين قبل التشغيل</span>
              </button>

              <button
                type="button"
                onClick={() => void handlePreviewSafeTweaks()}
                disabled={isApplyingOptimization}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-[#2E5077] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors"
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>معاينة وتطبيق تحسينات ما قبل اللعب</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-[#1E3E62] pt-2.5">
              تشغيل نظيف ومباشر عبر ويندوز فقط — بدون حقن برمجي (No Injection) وبدون تجاوز DRM أو Anti-Cheat.
            </div>
          </div>
        </div>

        {launchStatus && (
          <div
            role="status"
            className={`mt-4 rounded-lg border px-4 py-3 text-xs sm:text-sm flex items-start gap-2.5 ${
              launchStatus.launched
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-sky-50 dark:bg-[#0B192C] border-sky-200 dark:border-[#2E5077] text-slate-800 dark:text-slate-200'
            }`}
          >
            {launchStatus.launched ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            )}
            <div className="space-y-0.5">
              <div className="font-semibold">
                حالة التشغيل ({launchStatus.mode === 'local' ? 'محلي' : 'سحابي'} · {launchStatus.status})
              </div>
              <div>{launchStatus.messageAr}</div>
            </div>
          </div>
        )}
      </section>

      {isAnalyzingGameDetails && !smartGameAnalysis && (
        <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-8 text-center text-sm text-slate-600 dark:text-slate-300">
          جارٍ تحليل مواصفات الجهاز ومطابقة متطلبات اللعبة...
        </div>
      )}

      {smartGameAnalysis && (
        <>
          {/* Evidence-Based FPS Range & Mode Details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Hardware Check vs Official Requirements */}
            <section className="lg:col-span-6 rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    تحليل العتاد مقابل المتطلبات الرسمية
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {smartGameAnalysis.requirements.status === 'verified_metadata'
                    ? 'بيانات موثّقة'
                    : 'غير متوفر / غير مخمّن'}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-[#0B192C]/70 border border-slate-200 dark:border-[#1E3E62] p-3.5 text-xs space-y-1">
                <div className="text-slate-500 dark:text-slate-400">
                  نطاق الأداء التقديري (عند توفر الأدلة فقط):
                </div>
                <div className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {smartGameAnalysis.fpsRangeSupported && smartGameAnalysis.evidenceBasedFpsRangeAr
                    ? smartGameAnalysis.evidenceBasedFpsRangeAr
                    : 'غير متوفر — لا توجد بيانات موثقة كافية لتحديد نطاق إطارات دقيق'}
                </div>
              </div>

              <dl className="divide-y divide-slate-200 dark:divide-[#1E3E62] text-xs">
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400 shrink-0">المعالج (CPU)</dt>
                  <dd className="text-left font-medium text-slate-900 dark:text-slate-100" dir="ltr">
                    {smartGameAnalysis.hardwareChecks.cpuStatusAr}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400 shrink-0">الرسوميات و VRAM</dt>
                  <dd className="text-left font-medium text-slate-900 dark:text-slate-100" dir="ltr">
                    {smartGameAnalysis.hardwareChecks.gpuAndVramStatusAr}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400 shrink-0">الذاكرة (RAM)</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                    {smartGameAnalysis.hardwareChecks.ramStatusAr}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400 shrink-0">التخزين والتعريف</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                    {smartGameAnalysis.hardwareChecks.storageStatusAr} · {smartGameAnalysis.hardwareChecks.driverStatusAr}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400 shrink-0">الحمل الحالي للنظام</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                    {smartGameAnalysis.hardwareChecks.systemLoadNoteAr}
                  </dd>
                </div>
              </dl>

              <div className="border-t border-slate-200 dark:border-[#1E3E62] pt-3 space-y-2 text-xs">
                <div className="font-semibold text-slate-900 dark:text-white">
                  المصدر: {smartGameAnalysis.requirements.sourceLabelAr}
                </div>
                {smartGameAnalysis.requirements.status === 'verified_metadata' ? (
                  <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 tabular-nums">
                    <div>أدنى CPU: {smartGameAnalysis.requirements.minCpuAr}</div>
                    <div>موصى CPU: {smartGameAnalysis.requirements.recCpuAr}</div>
                    <div>أدنى RAM: {smartGameAnalysis.requirements.minRamGb} GB</div>
                    <div>موصى RAM: {smartGameAnalysis.requirements.recRamGb} GB</div>
                    <div>أدنى VRAM: {smartGameAnalysis.requirements.minVramMb} MB</div>
                    <div>موصى VRAM: {smartGameAnalysis.requirements.recVramMb} MB</div>
                    <div>التخزين المطلوب: {smartGameAnalysis.requirements.minStorageGb} GB</div>
                    <div>الواجهة: {smartGameAnalysis.requirements.directXVersion}</div>
                  </div>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400">
                    متطلبات CPU / RAM / VRAM / DirectX لهذه اللعبة غير متوفرة في القاعدة الموثّقة ولم يتم اختلاقها.
                  </p>
                )}
              </div>
            </section>

            {/* Two Modes Details: Local Optimization OR Cloud Mode */}
            <section className="lg:col-span-6 rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-6 space-y-4">
              {selectedMode === 'local' ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        الوضع المحلي: تحسين ويندوز والتطبيقات الاختيارية
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {smartGameAnalysis.safeOptimizationSummaryAr}
                  </p>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      اختر التطبيقات غير الأساسية المراد إيقافها مؤقتاً (اختيارك الشخصي):
                    </div>
                    {safeBackgroundProcesses.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 dark:border-[#1E3E62] p-3 text-xs text-slate-500 dark:text-slate-400">
                        لا توجد تطبيقات خلفية اختيارية مرصودة حالياً.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {safeBackgroundProcesses.map((proc) => {
                          const checked = selectedBackgroundPids.includes(proc.pid);
                          return (
                            <label
                              key={proc.pid}
                              className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer text-xs ${
                                checked
                                  ? 'bg-sky-50/70 dark:bg-[#2E5077]/35 border-[#2E5077]'
                                  : 'bg-white dark:bg-[#0B192C]/60 border-slate-200 dark:border-[#1E3E62]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleBackgroundPid(proc.pid)}
                                  className="w-4 h-4 rounded accent-[#2E5077]"
                                />
                                <span className="font-mono-tabular font-medium text-slate-900 dark:text-white truncate" dir="ltr">
                                  {proc.name}
                                </span>
                              </div>
                              <span className="font-mono-tabular text-slate-500 dark:text-slate-400 shrink-0" dir="ltr">
                                {proc.ramMb} MB · {proc.cpuPercent}% CPU
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      تُستثنى خدمات النظام وبرامج الحماية (Windows Defender / مضاد الفيروسات) تلقائياً ولا يمكن تحديدها أو إيقافها.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        الوضع السحابي وخادم GPU البعيد (Cloud Mode)
                      </h3>
                    </div>
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      {smartGameAnalysis.cloudAssessment.isCloudHardwareConnected
                        ? 'متصل'
                        : 'غير متصل بمزوّد'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-3.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    ملاحظة شفافة: لا يدّعي التطبيق توفر عتاد سحابي متصل حالياً حتى تقوم بربط حسابك في مزوّد بث خارجي أو تهيئة خادم Windows GPU خاص بك.
                  </div>

                  <dl className="divide-y divide-slate-200 dark:divide-[#1E3E62] text-xs">
                    <div className="py-2.5 flex items-start justify-between gap-4">
                      <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
                        <Wifi className="w-3.5 h-3.5" />
                        <span>متطلبات الإنترنت</span>
                      </dt>
                      <dd className="font-medium text-slate-900 dark:text-white text-left">
                        {smartGameAnalysis.cloudAssessment.internetRequirementAr}
                      </dd>
                    </div>
                    <div className="py-2.5 flex items-start justify-between gap-4">
                      <dt className="text-slate-500 dark:text-slate-400 shrink-0">زمن الاستجابة (Latency)</dt>
                      <dd className="font-medium text-slate-900 dark:text-white text-left">
                        {smartGameAnalysis.cloudAssessment.latencyRequirementAr}
                      </dd>
                    </div>
                    <div className="py-2.5 flex items-start justify-between gap-4">
                      <dt className="text-slate-500 dark:text-slate-400 shrink-0">التكلفة والاشتراك</dt>
                      <dd className="font-medium text-slate-900 dark:text-white text-left">
                        {smartGameAnalysis.cloudAssessment.costNoteAr}
                      </dd>
                    </div>
                    <div className="py-2.5 flex items-start justify-between gap-4">
                      <dt className="text-slate-500 dark:text-slate-400 shrink-0">تغطية المزوّدين</dt>
                      <dd className="font-medium text-slate-900 dark:text-white text-left">
                        {smartGameAnalysis.cloudAssessment.providerSupportNoteAr}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-[#1E3E62] text-xs">
                    <span className="text-slate-600 dark:text-slate-300">
                      ملفات الخوادم البعيدة المهيأة: {remoteGpuProfiles.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSection('cloud')}
                      className="text-sky-700 dark:text-sky-300 font-semibold hover:underline"
                    >
                      إدارة المزوّدين والخوادم البعيدة
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>

          {/* 8 Graphics Recommendations Table */}
          <section className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1E3E62] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    توصيات إعدادات الرسوميات (8 إعدادات)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    نفرّق بوضوح بين الإعداد الموثّق وفق متطلبات اللعبة والإعداد المقدّر من العتاد، لتطبيقه من داخل قائمة اللعبة دون المساس بملفات التكوين.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <HardDrive className="w-4 h-4" />
                <span>لا تعديل على ملفات INI / CFG / EXE</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-[#1E3E62]/60 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-[#1E3E62]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">الإعداد</th>
                    <th className="py-3 px-4 font-semibold">القيمة الموصى بها</th>
                    <th className="py-3 px-4 font-semibold">مصدر التوصية</th>
                    <th className="py-3 px-4 font-semibold">السبب الفني</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1E3E62]">
                  {smartGameAnalysis.graphicsRecommendations.map((rec) => (
                    <tr key={rec.settingKey} className="hover:bg-slate-50/70 dark:hover:bg-[#1E3E62]/20">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {rec.settingNameAr}
                      </td>
                      <td className="py-3 px-4 font-bold text-sky-700 dark:text-sky-300 tabular-nums whitespace-nowrap">
                        {rec.recommendedValueAr}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            rec.basis === 'verified_profile'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : rec.basis === 'hardware_estimate'
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {rec.basisLabelAr}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {rec.reasonAr}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Explicit Confirmation Modal before /api/v1/optimization/apply */}
      <ConfirmOptimizationModal
        preview={optimizationPreview}
        isSubmitting={isApplyingOptimization}
        onCancel={() => setOptimizationPreview(null)}
        onConfirm={async (previewId, tweakIds) => {
          await confirmAndApplyOptimization(previewId, tweakIds, selectedGame.id);
        }}
      />

      <PrePlayOptimizeModal
        game={showPrePlayModal ? selectedGame : null}
        onClose={() => setShowPrePlayModal(false)}
      />
    </div>
  );
};
