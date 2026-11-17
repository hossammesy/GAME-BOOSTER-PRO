import React from 'react';
import { Activity, Info, RefreshCw, ShieldCheck, Thermometer } from 'lucide-react';
import { DisconnectedPrompt } from '../components/DisconnectedPrompt';
import { TelemetryChart } from '../components/TelemetryChart';
import { useAgent } from '../context/AgentContext';

export const PerformancePage: React.FC = () => {
  const {
    connectionState,
    config,
    settings,
    updateSettings,
    performance,
    performanceHistory,
    refreshPerformance,
  } = useAgent();

  if (connectionState !== 'connected' && !config.demoMode) {
    return (
      <DisconnectedPrompt
        contextTitleAr="مراقب الأداء الحي يتطلب الوكيل المحلي"
        contextDescriptionAr="لقراءة نسب استهلاك المعالج والذاكرة وذاكرة الرسوميات (VRAM) ودرجات الحرارة ومعدل الإطارات الحقيقية، يجب تشغيل الوكيل المحلي على ويندوز 11. لا يقوم المتصفح بتوليد قياسات حية وهمية."
      />
    );
  }

  const sample = performance?.sample;
  const sensors = performance?.sensorsAvailable;
  const isStaticDemo = Boolean(config.demoMode || sample?.isStaticDemoSnapshot);

  const cpuSeries = performanceHistory
    .map((s) => s.cpuUsagePercent)
    .filter((v): v is number => v !== null);
  const gpuSeries = performanceHistory
    .map((s) => s.gpuUsagePercent)
    .filter((v): v is number => v !== null);
  const vramSeries = performanceHistory
    .map((s) => s.vramUsedMb)
    .filter((v): v is number => v !== null);
  const ramSeries = performanceHistory
    .map((s) => s.ramUsedGb)
    .filter((v): v is number => v !== null);

  const cpuTempLabel =
    sensors?.cpuTemp && sample?.cpuTempCelsius !== null && sample?.cpuTempCelsius !== undefined
      ? `${sample.cpuTempCelsius} °C`
      : 'غير متاح';

  const gpuTempLabel =
    sensors?.gpuTemp && sample?.gpuTempCelsius !== null && sample?.gpuTempCelsius !== undefined
      ? `${sample.gpuTempCelsius} °C`
      : 'غير متاح';

  const fpsLabel =
    sensors?.fpsHook && sample?.activeGameProcess && sample.fps !== null
      ? `${sample.fps} FPS (${sample.activeGameProcess})`
      : 'غير متاح';

  return (
    <div className="space-y-6">
      {/* Polling Controls Bar */}
      <section className="rounded-xl bg-white dark:bg-[#1E3E62]/30 border border-slate-200 dark:border-[#2E5077] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {isStaticDemo
              ? 'مراقب الأداء — عينة مرجعية ثابتة (وضع العرض التجريبي)'
              : 'مراقب الأداء الحي من الوكيل المحلي'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            المصدر: {isStaticDemo ? 'بيانات تعريفية ثابتة (لا يتم توليد قراءات حية وهمية)' : `الوكيل المحلي · آخر قراءة: ${sample?.timestamp ?? '—'}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isStaticDemo ? (
            <>
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#0B192C]">
                {(
                  [
                    { ms: 2000, label: 'كل 2 ث' },
                    { ms: 5000, label: 'كل 5 ث' },
                    { ms: 0, label: 'متوقف' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.ms}
                    type="button"
                    onClick={() => updateSettings({ pollIntervalMs: opt.ms })}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      settings.pollIntervalMs === opt.ms
                        ? 'bg-white dark:bg-[#2E5077] text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void refreshPerformance()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>قراءة الآن</span>
              </button>
            </>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300 font-medium">
              <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>التحديث الحي متوقف في الوضع التجريبي</span>
            </div>
          )}
        </div>
      </section>

      {/* Thermal & FPS Sensor Strip (honest unavailable reporting) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              حرارة المعالج (CPU Temp)
            </div>
            <div className="text-lg font-bold font-mono-tabular text-slate-900 dark:text-white mt-1">
              {cpuTempLabel}
            </div>
            {cpuTempLabel === 'غير متاح' && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                يتطلب قراءة مستشعر حراري عبر الوكيل المحلي
              </div>
            )}
          </div>
          <Thermometer className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
        </div>

        <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              حرارة الرسوميات (GPU Temp)
            </div>
            <div className="text-lg font-bold font-mono-tabular text-slate-900 dark:text-white mt-1">
              {gpuTempLabel}
            </div>
            {gpuTempLabel === 'غير متاح' && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                يتطلب قراءة NVAPI من بطاقة MX250 عبر الوكيل
              </div>
            )}
          </div>
          <Thermometer className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
        </div>

        <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              معدل الإطارات (FPS)
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {fpsLabel}
            </div>
            {fpsLabel === 'غير متاح' && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                يتطلب لعبة نشطة وربط الوكيل المحلي
              </div>
            )}
          </div>
          <Activity className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
        </div>
      </section>

      {/* 4 Telemetry Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TelemetryChart
          titleAr="استهلاك المعالج (CPU)"
          subtitleAr={
            sample?.cpuClockGhz ? `التردد المرجعي: ${sample.cpuClockGhz} GHz` : undefined
          }
          currentValueLabel={
            sample?.cpuUsagePercent !== null && sample?.cpuUsagePercent !== undefined
              ? `${sample.cpuUsagePercent}`
              : '—'
          }
          unit="%"
          values={cpuSeries}
          maxValue={100}
          strokeColor="#38BDF8"
          fillColor="rgba(56, 189, 248, 0.14)"
          isAvailable={Boolean(sensors?.cpuUsage && sample?.cpuUsagePercent !== null)}
          isStaticBaseline={isStaticDemo}
        />

        <TelemetryChart
          titleAr="استهلاك بطاقة الرسوميات (MX250 GPU)"
          subtitleAr="نسبة حمل شريحة الرسوميات المخصصة"
          currentValueLabel={
            sample?.gpuUsagePercent !== null && sample?.gpuUsagePercent !== undefined
              ? `${sample.gpuUsagePercent}`
              : '—'
          }
          unit="%"
          values={gpuSeries}
          maxValue={100}
          strokeColor="#60A5FA"
          fillColor="rgba(96, 165, 250, 0.14)"
          isAvailable={Boolean(sensors?.gpuUsage && sample?.gpuUsagePercent !== null)}
          isStaticBaseline={isStaticDemo}
        />

        <TelemetryChart
          titleAr="ذاكرة الرسوميات (VRAM)"
          subtitleAr={`الحد الأقصى المتاح: ${sample?.vramTotalMb ?? 2048} MB`}
          currentValueLabel={
            sample?.vramUsedMb !== null && sample?.vramUsedMb !== undefined
              ? `${sample.vramUsedMb}`
              : '—'
          }
          unit="MB"
          values={vramSeries}
          maxValue={sample?.vramTotalMb ?? 2048}
          strokeColor="#F59E0B"
          fillColor="rgba(245, 158, 11, 0.14)"
          isAvailable={Boolean(sensors?.vramUsage && sample?.vramUsedMb !== null)}
          isStaticBaseline={isStaticDemo}
        />

        <TelemetryChart
          titleAr="الذاكرة العشوائية (RAM)"
          subtitleAr={`الإجمالي المثبت: ${sample?.ramTotalGb ?? 16} GB`}
          currentValueLabel={
            sample?.ramUsedGb !== null && sample?.ramUsedGb !== undefined
              ? `${sample.ramUsedGb}`
              : '—'
          }
          unit="GB"
          values={ramSeries}
          maxValue={sample?.ramTotalGb ?? 16}
          strokeColor="#34D399"
          fillColor="rgba(52, 211, 153, 0.14)"
          isAvailable={Boolean(sensors?.ramUsage && sample?.ramUsedGb !== null)}
          isStaticBaseline={isStaticDemo}
        />
      </section>

      {/* Top Running Processes Breakdown */}
      <section className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1E3E62] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              أبرز العمليات النشطة {isStaticDemo ? '(بيانات تجريبية)' : 'على نظام ويندوز'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تصنيف العمليات التي يمكن تعليقها مؤقتاً أثناء اللعب مقابل خدمات الأمان المحمية.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-[#1E3E62]/60 text-xs text-slate-600 dark:text-slate-300">
              <tr>
                <th className="py-2.5 px-4 font-semibold">اسم العملية</th>
                <th className="py-2.5 px-4 font-semibold">PID</th>
                <th className="py-2.5 px-4 font-semibold">CPU</th>
                <th className="py-2.5 px-4 font-semibold">RAM</th>
                <th className="py-2.5 px-4 font-semibold">سياسة التحسين</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1E3E62]">
              {(performance?.topProcesses ?? []).map((proc) => (
                <tr key={proc.pid}>
                  <td className="py-3 px-4 font-mono-tabular text-slate-900 dark:text-white" dir="ltr">
                    {proc.name}
                  </td>
                  <td className="py-3 px-4 font-mono-tabular text-slate-500 dark:text-slate-400">
                    {proc.pid}
                  </td>
                  <td className="py-3 px-4 font-mono-tabular text-slate-700 dark:text-slate-200">
                    {proc.cpuPercent}%
                  </td>
                  <td className="py-3 px-4 font-mono-tabular text-slate-700 dark:text-slate-200">
                    {proc.ramMb} MB
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {proc.category === 'security_protected' ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>خدمة أمان محمية (لا تُوقف أبداً)</span>
                      </span>
                    ) : proc.canSafelyPause ? (
                      <span className="text-sky-700 dark:text-sky-300 font-medium">
                        قابل للتعليق المؤقت قبل اللعب
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">
                        عملية نظام أساسية
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
