import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ConfirmOptimizationModal } from '../components/ConfirmOptimizationModal';
import { DisconnectedPrompt } from '../components/DisconnectedPrompt';
import { useAgent } from '../context/AgentContext';

export const OptimizationPage: React.FC = () => {
  const {
    connectionState,
    config,
    games,
    selectedGameForOptimization,
    setSelectedGameForOptimization,
    optimizationAnalysis,
    optimizationPreview,
    setOptimizationPreview,
    lastBackupSnapshotId,
    isAnalyzingOptimization,
    isApplyingOptimization,
    runOptimizationAnalysis,
    requestOptimizationPreview,
    confirmAndApplyOptimization,
    restoreDefaultSettings,
  } = useAgent();

  const [selectedTweakIds, setSelectedTweakIds] = useState<string[]>([]);

  useEffect(() => {
    if (optimizationAnalysis) {
      setSelectedTweakIds(
        optimizationAnalysis.systemTweaks
          .filter((t) => t.selectedByDefault)
          .map((t) => t.id)
      );
    }
  }, [optimizationAnalysis]);

  useEffect(() => {
    if ((connectionState === 'connected' || config.demoMode) && !optimizationAnalysis) {
      void runOptimizationAnalysis(selectedGameForOptimization);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState, config.demoMode]);

  if (connectionState !== 'connected' && !config.demoMode) {
    return (
      <DisconnectedPrompt
        contextTitleAr="التحسين المحلي يتطلب اتصالاً بالوكيل المحلي"
        contextDescriptionAr="يقوم الوكيل المحلي بتحليل خطة الطاقة وتفضيلات الرسوميات في ويندوز 11 واقتراح تعديلات آمنة وقابلة للاستعادة بالكامل بعد موافقتك الصريحة."
      />
    );
  }

  const toggleTweak = (id: string) => {
    setSelectedTweakIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenPreview = async () => {
    if (selectedTweakIds.length === 0) return;
    await requestOptimizationPreview(selectedGameForOptimization, selectedTweakIds);
  };

  return (
    <div className="space-y-6">
      {/* Target Selector & Analyze Trigger */}
      <section className="rounded-xl bg-white dark:bg-[#1E3E62]/30 border border-slate-200 dark:border-[#2E5077] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            تحليل العتاد وتوليد ملف التحسين الآمن
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            اختر اللعبة المستهدفة أو طبّق تحليلاً عاماً للجهاز. لن يتم تعديل أي ملفات لعبة أصلية مطلقاً.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="الهدف من التحليل"
            value={selectedGameForOptimization ?? ''}
            onChange={(e) => {
              const nextId = e.target.value || null;
              setSelectedGameForOptimization(nextId);
              void runOptimizationAnalysis(nextId);
            }}
            className="px-3.5 py-2 rounded-lg text-sm bg-white dark:bg-[#0B192C] border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
          >
            <option value="">الإعداد العام للجهاز (Windows 11)</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void runOptimizationAnalysis(selectedGameForOptimization)}
            disabled={isAnalyzingOptimization}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-4 h-4 ${isAnalyzingOptimization ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isAnalyzingOptimization ? 'جارٍ التحليل...' : 'إعادة تحليل العتاد'}</span>
          </button>
        </div>
      </section>

      {optimizationAnalysis && (
        <>
          {/* Safety Boundary Notice */}
          <div className="rounded-xl bg-slate-100/80 dark:bg-[#1E3E62]/40 border border-slate-200 dark:border-[#2E5077] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {optimizationAnalysis.hardwareSummaryAr}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {optimizationAnalysis.protectedServicesNoticeAr}
                </div>
              </div>
            </div>

            {lastBackupSnapshotId && (
              <span className="text-xs font-mono-tabular text-sky-700 dark:text-sky-300 shrink-0" dir="ltr">
                Snapshot: {lastBackupSnapshotId}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Column 1: Reversible System Tweaks */}
            <section className="xl:col-span-7 rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-6 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    1. تحسينات النظام الآمنة (قابلة للاستعادة)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    حدد التعديلات المطلوب معاينتها وتطبيقها على مستوى نظام ويندوز فقط.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {optimizationAnalysis.systemTweaks.map((tweak) => {
                  const checked = selectedTweakIds.includes(tweak.id);
                  return (
                    <label
                      key={tweak.id}
                      className={`block rounded-lg border p-4 cursor-pointer transition-colors ${
                        checked
                          ? 'bg-sky-50/60 dark:bg-[#2E5077]/30 border-[#2E5077]'
                          : 'bg-white dark:bg-[#0B192C]/60 border-slate-200 dark:border-[#1E3E62] hover:border-slate-300 dark:hover:border-[#2E5077]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTweak(tweak.id)}
                          className="mt-1 w-4 h-4 rounded accent-[#2E5077]"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {tweak.titleAr}
                            </span>
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" aria-hidden="true" />
                              قابل للاستعادة · لا يمس ملفات اللعبة
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {tweak.descriptionAr}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                            <div className="text-sky-800 dark:text-sky-300">
                              <span className="font-semibold">الأثر المتوقع: </span>
                              <span>{tweak.expectedImpactAr}</span>
                            </div>
                            <div
                              className={
                                tweak.riskLevel === 'none'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-amber-700 dark:text-amber-300'
                              }
                            >
                              <span className="font-semibold">المخاطرة: </span>
                              <span>{tweak.riskNoteAr}</span>
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/70 dark:border-[#1E3E62]">
                            الحالي: <span className="text-slate-800 dark:text-slate-200 font-medium">{tweak.currentValueAr}</span>
                            <span className="mx-2" aria-hidden="true">←</span>
                            الموصى به: <span className="text-sky-700 dark:text-sky-300 font-medium">{tweak.recommendedValueAr}</span>
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-[#1E3E62]">
                <button
                  type="button"
                  onClick={() => void restoreDefaultSettings()}
                  disabled={isApplyingOptimization}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>استعادة الإعدادات الافتراضية (Restore)</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleOpenPreview()}
                  disabled={selectedTweakIds.length === 0 || isApplyingOptimization}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  <span>معاينة التغييرات والتطبيق (Preview & Apply) ({selectedTweakIds.length})</span>
                </button>
              </div>
            </section>

            {/* Column 2: Advisory In-Game Graphics Settings (Read-only guide) */}
            <section className="xl:col-span-5 rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-6 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    2. إعدادات داخل اللعبة الموصى بها
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  توصيات إرشادية مخصصة لبطاقة MX250 (2GB VRAM) تطبقها يدوياً من قائمة اللعبة. لا يلمس الوكيل ملفات EXE أو DLL أو CFG أو INI أو ملفات الموارد.
                </p>
              </div>

              <div className="border border-slate-200 dark:border-[#1E3E62] rounded-lg overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-[#1E3E62]/60 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">الإعداد</th>
                      <th className="py-2.5 px-3 font-semibold">التوصية والأثر والمخاطرة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#1E3E62]">
                    {optimizationAnalysis.advisoryInGameSettings.map((row) => (
                      <tr key={row.settingNameAr}>
                        <td className="py-3 px-3 align-top">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {row.settingNameAr}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                            الافتراضي: {row.currentOrDefaultAr}
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top space-y-1">
                          <div className="font-semibold text-sky-700 dark:text-sky-300">
                            {row.recommendedForHardwareAr}
                          </div>
                          <div className="text-slate-600 dark:text-slate-300 inline-flex items-start gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{row.vramImpactAr}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            المخاطرة: {row.riskNoteAr}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}

      {/* Explicit Confirmation Modal before /api/v1/optimization/apply */}
      <ConfirmOptimizationModal
        preview={optimizationPreview}
        isSubmitting={isApplyingOptimization}
        onCancel={() => setOptimizationPreview(null)}
        onConfirm={async (previewId, tweakIds) => {
          await confirmAndApplyOptimization(
            previewId,
            tweakIds,
            selectedGameForOptimization
          );
        }}
      />
    </div>
  );
};
