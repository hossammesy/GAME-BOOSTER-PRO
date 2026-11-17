import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Eye,
  MonitorCheck,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useAgent } from '../context/AgentContext';
import type { InstalledGame, OptimizationPreviewResponse } from '../types/agent';

interface PrePlayOptimizeModalProps {
  game: InstalledGame | null;
  onClose: () => void;
}

export const PrePlayOptimizeModal: React.FC<PrePlayOptimizeModalProps> = ({
  game,
  onClose,
}) => {
  const {
    connectionState,
    config,
    hardware,
    performance,
    smartGameAnalysis,
    isAnalyzingGameDetails,
    analyzeGameDetails,
    refreshPerformance,
    optimizationAnalysis,
    runOptimizationAnalysis,
    requestOptimizationPreview,
    confirmAndApplyOptimization,
    restoreDefaultSettings,
    selectedBackgroundPids,
    toggleBackgroundPid,
    launchGame,
    isApplyingOptimization,
    isLaunchingGame,
  } = useAgent();

  const [selectedTweaks, setSelectedTweaks] = useState<string[]>([]);
  const [localPreview, setLocalPreview] = useState<OptimizationPreviewResponse | null>(null);
  const [userApproved, setUserApproved] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const lastAutoScannedIdRef = React.useRef<string | null>(null);

  const runFullPrePlayScan = useCallback(async () => {
    if (!game) return;
    setIsScanning(true);
    setLocalPreview(null);
    setUserApproved(false);
    try {
      await Promise.all([
        analyzeGameDetails(game.id),
        refreshPerformance(),
        runOptimizationAnalysis(game.id),
      ]);
    } finally {
      setIsScanning(false);
    }
  }, [analyzeGameDetails, game, refreshPerformance, runOptimizationAnalysis]);

  useEffect(() => {
    if (!game) {
      lastAutoScannedIdRef.current = null;
      return;
    }
    if (
      (connectionState === 'connected' || config.demoMode) &&
      lastAutoScannedIdRef.current !== game.id
    ) {
      lastAutoScannedIdRef.current = game.id;
      void runFullPrePlayScan();
    }
  }, [game, connectionState, config.demoMode, runFullPrePlayScan]);

  useEffect(() => {
    if (optimizationAnalysis) {
      setSelectedTweaks(
        optimizationAnalysis.systemTweaks
          .filter((t) => t.selectedByDefault)
          .map((t) => t.id)
      );
    }
  }, [optimizationAnalysis]);

  if (!game) return null;

  const isAvailable = connectionState === 'connected' || config.demoMode;
  const safeBackgroundApps =
    performance?.topProcesses.filter((p) => p.canSafelyPause) ?? [];

  const toggleTweak = (id: string) => {
    setLocalPreview(null);
    setUserApproved(false);
    setSelectedTweaks((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGeneratePreview = async () => {
    const tweaksToPreview = [...selectedTweaks];
    if (selectedBackgroundPids.length > 0 && !tweaksToPreview.includes('tweak_bg_apps')) {
      tweaksToPreview.push('tweak_bg_apps');
    }
    if (tweaksToPreview.length === 0) return;
    const prev = await requestOptimizationPreview(game.id, tweaksToPreview);
    if (prev) {
      setLocalPreview(prev);
      setUserApproved(false);
    }
  };

  const handleConfirmApplyAndPlay = async () => {
    if (!localPreview || !userApproved) return;
    const tweakIds = localPreview.changes.map((c) => c.tweakId);
    const applied = await confirmAndApplyOptimization(
      localPreview.previewId,
      tweakIds,
      game.id
    );
    if (applied) {
      setLocalPreview(null);
      setUserApproved(false);
      await launchGame(game.id, 'local');
      onClose();
    }
  };

  const handlePlayWithoutChanges = async () => {
    await launchGame(game.id, 'local');
    onClose();
  };

  const recResolution =
    smartGameAnalysis?.graphicsRecommendations.find(
      (r) => r.settingKey === 'resolution'
    )?.recommendedValueAr ?? game.recommendedResolution;

  const recTextures =
    smartGameAnalysis?.graphicsRecommendations.find(
      (r) => r.settingKey === 'textures'
    )?.recommendedValueAr ?? 'Low / Normal';

  const recShadows =
    smartGameAnalysis?.graphicsRecommendations.find(
      (r) => r.settingKey === 'shadows'
    )?.recommendedValueAr ?? 'Low';

  const cpuUsage = performance?.sample.cpuUsagePercent;
  const ramUsed = performance?.sample.ramUsedGb;
  const ramTotal = hardware?.memory.totalGb ?? performance?.sample.ramTotalGb;
  const availableRamGb =
    hardware?.memory.availableGb ??
    (ramTotal != null && ramUsed != null
      ? Number(Math.max(0, ramTotal - ramUsed).toFixed(1))
      : null);
  const gpuUsage = performance?.sample.gpuUsagePercent;
  const vramUsed = performance?.sample.vramUsedMb;
  const vramTotal = hardware?.gpu.vramTotalMb ?? performance?.sample.vramTotalMb;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preplay-modal-title"
    >
      <div className="w-full max-w-4xl rounded-xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-[#2E5077] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#1E3E62] bg-slate-50 dark:bg-[#1E3E62]/25">
          <div className="flex items-center gap-3 min-w-0">
            <SlidersHorizontal className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <div className="min-w-0">
              <h2
                id="preplay-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white truncate"
              >
                فحص وتحسين قبل التشغيل — {game.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate" dir="ltr">
                {game.executablePath || game.installPath}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAvailable && (
              <button
                type="button"
                onClick={() => void runFullPrePlayScan()}
                disabled={isScanning || isAnalyzingGameDetails}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62]"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`}
                />
                <span>إعادة الفحص</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة فحص ما قبل التشغيل"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {!isAvailable ? (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-5 flex items-start gap-3 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <div className="font-bold">يلزم الاتصال بالوكيل المحلي لإجراء الفحص الحقيقي</div>
                <p className="text-xs leading-relaxed">
                  فحص CPU وRAM وGPU الفعلي وتطبيق تعديلات ويندوز الآمنة يتم عبر الوكيل المحلي على ويندوز 11 فقط. يمكنك الاتصال بالوكيل المحلي أو تفعيل الوضع التجريبي للمعاينة.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 1. Real Hardware & Memory Telemetry */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>1. قراءة العتاد والذاكرة المتاحة حالياً</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 dark:bg-[#1E3E62]/30 border border-slate-200 dark:border-[#2E5077]/70 p-3">
                    <div className="text-slate-500 dark:text-slate-400">المعالج (CPU)</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-1 truncate" dir="ltr">
                      {hardware?.cpu.model ?? 'غير متاح'}
                    </div>
                    <div className="text-[11px] text-sky-700 dark:text-sky-300 mt-0.5 tabular-nums">
                      الحمل: {cpuUsage != null ? `${cpuUsage}%` : 'غير متاح'}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 dark:bg-[#1E3E62]/30 border border-slate-200 dark:border-[#2E5077]/70 p-3">
                    <div className="text-slate-500 dark:text-slate-400">الذاكرة المتاحة (RAM)</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-1 tabular-nums" dir="ltr">
                      {availableRamGb != null && ramTotal != null
                        ? `${availableRamGb} GB / ${ramTotal} GB`
                        : 'غير متاح'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      المستخدم: {ramUsed != null ? `${ramUsed} GB` : 'غير متاح'}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 dark:bg-[#1E3E62]/30 border border-slate-200 dark:border-[#2E5077]/70 p-3">
                    <div className="text-slate-500 dark:text-slate-400">بطاقة الرسوميات (GPU)</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-1 truncate" dir="ltr">
                      {hardware?.gpu.primaryModel ?? game.detectedGpu}
                    </div>
                    <div className="text-[11px] text-sky-700 dark:text-sky-300 mt-0.5 tabular-nums">
                      الحمل: {gpuUsage != null ? `${gpuUsage}%` : 'غير متاح'}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 dark:bg-[#1E3E62]/30 border border-slate-200 dark:border-[#2E5077]/70 p-3">
                    <div className="text-slate-500 dark:text-slate-400">ذاكرة الرسوميات (VRAM)</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-1 tabular-nums" dir="ltr">
                      {vramTotal != null ? `${vramTotal} MB` : 'غير متاح'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      المستخدم: {vramUsed != null ? `${vramUsed} MB` : 'غير متاح'}
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Compatibility & Recommended Resolution / Quality */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg bg-slate-50 dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#2E5077] p-4 space-y-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>2. تقييم التوافق ومتطلبات اللعبة</span>
                    <span className="text-sky-700 dark:text-sky-300">
                      {smartGameAnalysis?.compatibilityLabelAr ?? 'جارٍ التقييم...'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {smartGameAnalysis?.compatibilityExplanationAr ??
                      'يتم فحص مواصفات الجهاز ومطابقتها مع قاعدة المتطلبات الموثقة.'}
                  </p>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-[#1E3E62]">
                    {smartGameAnalysis?.fpsRangeSupported &&
                    smartGameAnalysis.evidenceBasedFpsRangeAr
                      ? `تقدير مبني على المتطلبات: ${smartGameAnalysis.evidenceBasedFpsRangeAr}`
                      : 'نطاق الإطارات غير مضمون ولا يُخمّن عند غياب بيانات رسمية.'}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#2E5077] p-4 space-y-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MonitorCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span>3. توصية الدقة وجودة الرسوميات</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div className="rounded bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-[#1E3E62] p-2">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">الدقة</div>
                      <div className="font-bold text-sky-700 dark:text-sky-300 mt-0.5 tabular-nums">
                        {recResolution}
                      </div>
                    </div>
                    <div className="rounded bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-[#1E3E62] p-2">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">الخامات</div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {recTextures}
                      </div>
                    </div>
                    <div className="rounded bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-[#1E3E62] p-2">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">الظلال</div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {recShadows}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    إرشادات تُطبّق من داخل إعدادات اللعبة؛ لا نعدّل ملفات EXE/CFG/INI نهائياً.
                  </p>
                </div>
              </section>

              {/* 3. Safe Tweaks & Optional Background Apps */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>4. تحسينات ويندوز الآمنة (قابلة للاستعادة)</span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {optimizationAnalysis?.systemTweaks.map((tw) => {
                      const checked = selectedTweaks.includes(tw.id);
                      return (
                        <label
                          key={tw.id}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer ${
                            checked
                              ? 'bg-sky-50/70 dark:bg-[#2E5077]/35 border-[#2E5077]'
                              : 'bg-white dark:bg-[#0B192C]/60 border-slate-200 dark:border-[#1E3E62]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTweak(tw.id)}
                            className="mt-0.5 w-4 h-4 rounded accent-[#2E5077]"
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {tw.titleAr}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {tw.recommendedValueAr}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    5. برامج الخلفية الاختيارية (يُستثنى النظام و Defender)
                  </div>
                  {safeBackgroundApps.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 dark:border-[#1E3E62] p-3 text-xs text-slate-500 dark:text-slate-400">
                      لا توجد تطبيقات خلفية اختيارية تستهلك موارد كبيرة حالياً.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {safeBackgroundApps.map((proc) => {
                        const checked = selectedBackgroundPids.includes(proc.pid);
                        return (
                          <label
                            key={proc.pid}
                            className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border text-xs cursor-pointer ${
                              checked
                                ? 'bg-sky-50/70 dark:bg-[#2E5077]/35 border-[#2E5077]'
                                : 'bg-white dark:bg-[#0B192C]/60 border-slate-200 dark:border-[#1E3E62]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleBackgroundPid(proc.pid)}
                                className="w-4 h-4 rounded accent-[#2E5077]"
                              />
                              <span
                                className="font-mono-tabular text-slate-900 dark:text-white truncate"
                                dir="ltr"
                              >
                                {proc.name}
                              </span>
                            </div>
                            <span className="font-mono-tabular text-slate-500 dark:text-slate-400 shrink-0" dir="ltr">
                              {proc.ramMb} MB
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    لا يتم تعطيل Windows Defender أو أي مضاد فيروسات أو عمليات النظام مطلقاً.
                  </p>
                </div>
              </section>

              {/* 4. Preview Changes & Explicit User Approval */}
              {localPreview && (
                <section className="rounded-xl border border-sky-300 dark:border-[#2E5077] bg-sky-50/50 dark:bg-[#1E3E62]/25 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span>معاينة التغييرات قبل التطبيق</span>
                    <span className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-300" dir="ltr">
                      Snapshot: {localPreview.backupSnapshotId}
                    </span>
                  </div>
                  <div className="border border-slate-200 dark:border-[#1E3E62] rounded-lg overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 dark:bg-[#1E3E62]/70 text-slate-700 dark:text-slate-200">
                        <tr>
                          <th className="py-2 px-3">التعديل</th>
                          <th className="py-2 px-3">قبل</th>
                          <th className="py-2 px-3">بعد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-[#1E3E62] bg-white dark:bg-[#0B192C]">
                        {localPreview.changes.map((chg) => (
                          <tr key={chg.tweakId}>
                            <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                              {chg.titleAr}
                            </td>
                            <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                              {chg.beforeValueAr}
                            </td>
                            <td className="py-2 px-3 font-semibold text-sky-700 dark:text-sky-300">
                              {chg.afterValueAr}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={userApproved}
                      onChange={(e) => setUserApproved(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-[#2E5077]"
                    />
                    <span>
                      أقرّ بمراجعة التغييرات أعلاه وأوافق على تطبيقها مؤقتاً مع حفظ نقطة استعادة، دون المساس بملفات اللعبة أو Windows Defender.
                    </span>
                  </label>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-[#1E3E62] bg-slate-50 dark:bg-[#0B192C] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isAvailable && (
              <button
                type="button"
                onClick={() => void restoreDefaultSettings()}
                disabled={isApplyingOptimization}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62] disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة الافتراضي</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isAvailable && !localPreview && (
              <button
                type="button"
                onClick={() => void handleGeneratePreview()}
                disabled={selectedTweaks.length === 0 && selectedBackgroundPids.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold border border-[#2E5077] text-[#2E5077] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-[#1E3E62] disabled:opacity-40"
              >
                <Eye className="w-4 h-4" />
                <span>معاينة التغييرات</span>
              </button>
            )}

            {isAvailable && localPreview && (
              <button
                type="button"
                onClick={() => void handleConfirmApplyAndPlay()}
                disabled={!userApproved || isApplyingOptimization || isLaunchingGame}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isApplyingOptimization
                    ? 'جارٍ التحسين...'
                    : 'تأكيد التحسين والتشغيل'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handlePlayWithoutChanges()}
              disabled={isLaunchingGame}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold bg-[#2E5077] hover:bg-[#1E3E62] text-white disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>{isLaunchingGame ? 'جارٍ التشغيل...' : 'تشغيل اللعبة الآن'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
