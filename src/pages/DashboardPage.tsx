import React from 'react';
import {
  Activity,
  AlertTriangle,
  Cloud,
  Cpu,
  Gamepad2,
  HardDrive,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
} from 'lucide-react';
import { DisconnectedPrompt } from '../components/DisconnectedPrompt';
import { useAgent } from '../context/AgentContext';

export const DashboardPage: React.FC = () => {
  const {
    connectionState,
    config,
    hardware,
    games,
    performance,
    isScanningDevice,
    scanDevice,
    setActiveSection,
    runOptimizationAnalysis,
    openGameDetails,
  } = useAgent();

  if (connectionState !== 'connected' && !config.demoMode) {
    return (
      <div className="space-y-6">
        <DisconnectedPrompt
          contextTitleAr="بانتظار الاتصال بالوكيل المحلي لنظام ويندوز"
          contextDescriptionAr="لعرض حالة المعالج وذاكرة الرسوميات (VRAM) وفحص الألعاب المثبتة فعلياً على حاسوبك، شغّل الوكيل المحلي GAME BOOSTER PRO على جهاز ويندوز 11 أو فعّل وضع العرض التجريبي لاستكشاف المنصة."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl">
          <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <ShieldCheck className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" />
              <span>تواصل محلي آمن</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              تتصل الواجهة فقط عبر عنوان localhost أو 127.0.0.1 مع رمز مصادقة Bearer وتحقق من الأصل (Origin).
            </p>
          </div>

          <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <SlidersHorizontal className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" />
              <span>حماية ملفات الألعاب</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              لا يتم تعديل أي ملف لعبة أصلي أو إيقاف خدمات الحماية؛ التعديلات تقتصر على إعدادات ويندوز القابلة للاستعادة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveSection('cloud')}
            className="text-right rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] hover:border-[#2E5077] p-5 space-y-2 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Cloud className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" />
              <span>تقييم الألعاب السحابية</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              تعرّف على جاهزية اتصالك للألعاب السحابية أو خوادم ويندوز البعيدة بدون حاجة للوكيل المحلي.
            </p>
          </button>
        </div>
      </div>
    );
  }

  const readinessTierLabel =
    hardware?.gamingReadiness.tier === 'esports_and_light'
      ? 'جاهز للألعاب التنافسية والخفيفة (720p / 900p)'
      : hardware?.gamingReadiness.tier === 'medium_720p'
      ? 'جاهز للألعاب المتوسطة بدقة 720p'
      : 'يُنصح بالألعاب السحابية للألعاب الثقيلة';

  const latestSample = performance?.sample;
  const optimalGamesCount = games.filter(
    (g) =>
      g.compatibility === 'excellent' ||
      g.compatibility === 'good' ||
      g.compatibility === 'optimal'
  ).length;
  const needsTuningCount = games.filter(
    (g) =>
      g.compatibility === 'limited' ||
      g.compatibility === 'needs_tuning' ||
      g.compatibility === 'heavy_for_vram'
  ).length;

  const storageUsedGb = hardware
    ? Math.max(0, hardware.storage.totalSpaceGb - hardware.storage.freeSpaceGb)
    : 0;
  const storageUsedPercent =
    hardware && hardware.storage.totalSpaceGb > 0
      ? Math.round((storageUsedGb / hardware.storage.totalSpaceGb) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Primary Readiness Overview */}
      <section className="rounded-xl bg-white dark:bg-[#1E3E62]/30 border border-slate-200 dark:border-[#2E5077] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
              {config.demoMode && (
                <>
                  <span className="font-semibold text-sky-700 dark:text-sky-300">
                    بيانات تجريبية (Demo Mode)
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span>{hardware?.osName ?? 'Windows 11'}</span>
              <span aria-hidden="true">·</span>
              <span dir="ltr" className="font-mono-tabular">
                {hardware?.deviceName ?? 'PC'}
              </span>
              <span aria-hidden="true">·</span>
              <span>خطة الطاقة: {hardware?.activePowerPlan ?? 'متوازن'}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {readinessTierLabel}
            </h2>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {hardware?.gamingReadiness.summaryAr}
            </p>

            {hardware?.gamingReadiness.vramLimitWarning && (
              <div className="flex items-start gap-2.5 pt-2 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{hardware.gamingReadiness.bottleneckNoteAr}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void scanDevice()}
              disabled={isScanningDevice}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {isScanningDevice ? (
                <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <ScanSearch className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{isScanningDevice ? 'جارٍ الفحص...' : 'فحص الجهاز'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void runOptimizationAnalysis(null);
                setActiveSection('optimization');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-[#2E5077] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors whitespace-nowrap"
            >
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              <span>تحليل التحسين</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4-Column Hardware & Storage Specification Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>المعالج (CPU)</span>
            <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white truncate" dir="ltr">
            {hardware?.cpu.model ?? 'غير متاح'}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            {hardware?.cpu.cores ?? '—'} أنوية / {hardware?.cpu.threads ?? '—'} خيوط
            {hardware?.cpu.boostClockGhz
              ? ` · حتى ${hardware.cpu.boostClockGhz} GHz`
              : hardware?.cpu.baseClockGhz
              ? ` · ${hardware.cpu.baseClockGhz} GHz`
              : ''}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            الاستهلاك: {latestSample?.cpuUsagePercent !== null && latestSample?.cpuUsagePercent !== undefined ? `${latestSample.cpuUsagePercent}%` : 'غير متاح'}
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>الذاكرة العشوائية (RAM)</span>
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
            {hardware?.memory.totalGb !== null && hardware?.memory.totalGb !== undefined
              ? `${hardware.memory.totalGb} GB RAM`
              : 'غير متاح'}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            {hardware?.memory.speedMhz ? `${hardware.memory.speedMhz} MHz` : 'السرعة غير متاحة'} · {hardware?.memory.channelMode ?? 'غير متاح'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {hardware?.memory.availableGb !== null && hardware?.memory.availableGb !== undefined
              ? `المتاح: ${hardware.memory.availableGb} GB`
              : latestSample?.ramUsedGb !== null && latestSample?.ramUsedGb !== undefined
              ? `المستخدم: ${latestSample.ramUsedGb} GB`
              : 'المتاح: غير متاح'}
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>بطاقة الرسوميات (GPU)</span>
            <Gamepad2 className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white truncate" dir="ltr">
            {hardware?.gpu.primaryModel ?? 'غير متاح'}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            {hardware?.gpu.vramTotalMb ? `${hardware.gpu.vramTotalMb} MB VRAM` : 'VRAM غير متاح'} · تعريف {hardware?.gpu.driverVersion ?? 'غير متاح'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate" dir="ltr">
            iGPU: {hardware?.gpu.integratedModel ?? 'غير متاح'}
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>التخزين المتاح والشبكة</span>
            <HardDrive className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
            {hardware?.storage.freeSpaceGb ?? 0} GB متاح
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            من أصل {hardware?.storage.totalSpaceGb ?? 0} GB ({hardware?.storage.type ?? 'SSD'}) · مستخدم {storageUsedPercent}%
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              {hardware?.network.adapterType ?? 'غير متاح'}
              {hardware?.network.estimatedBandwidthMbps !== null && hardware?.network.estimatedBandwidthMbps !== undefined
                ? ` · ${hardware.network.estimatedBandwidthMbps} Mbps`
                : ''}
            </span>
          </div>
        </div>
      </section>

      {/* Two-Column Action Summary: Installed Games & Quick Guidance */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                ملخص الألعاب المثبتة على جهازك
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('games')}
              className="text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline whitespace-nowrap"
            >
              عرض كل الألعاب ({games.length})
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-[#1E3E62]">
            {games.slice(0, 4).map((game) => (
              <div
                key={game.id}
                className="py-3 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {game.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {game.launcher} · {game.recommendedResolution} · {game.estimatedFpsRange}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openGameDetails(game.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors whitespace-nowrap shrink-0"
                >
                  تحليل وتفاصيل
                </button>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
            {optimalGamesCount} ألعاب مناسبة أو جيدة · {needsTuningCount} ألعاب محدودة وتحتاج ضبط إعدادات 2GB VRAM
          </div>
        </div>

        <div className="lg:col-span-5 rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              توصيات الجلسة لجهاز i7-10610U + MX250
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <span className="font-mono-tabular text-sky-600 dark:text-sky-400 font-semibold">01.</span>
                <span>وصّل الشاحن قبل اللعب لتفادي تقليص تردد معالج i7-10610U وبطاقة MX250.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono-tabular text-sky-600 dark:text-sky-400 font-semibold">02.</span>
                <span>أبقِ جودة الخامات على Normal أو Low حتى لا يتجاوز الاستهلاك 2048 MB VRAM.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono-tabular text-sky-600 dark:text-sky-400 font-semibold">03.</span>
                <span>للألعاب الحديثة الثقيلة (AAA)، استخدم الألعاب السحابية بسرعة 10-30 Mbps بدلاً من الضغط على البطاقة.</span>
              </li>
            </ul>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-[#1E3E62]">
            <button
              type="button"
              onClick={() => setActiveSection('performance')}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#1E3E62] hover:bg-[#2E5077] text-white transition-colors text-center"
            >
              فتح مراقب الأداء
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('cloud')}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors text-center"
            >
              الألعاب السحابية
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
