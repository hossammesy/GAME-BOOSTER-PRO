import React, { useState } from 'react';
import { AlertCircle, CheckSquare, ShieldCheck, X } from 'lucide-react';
import type { OptimizationPreviewResponse } from '../types/agent';

interface ConfirmOptimizationModalProps {
  preview: OptimizationPreviewResponse | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (previewId: string, tweakIds: string[]) => Promise<void>;
}

export const ConfirmOptimizationModal: React.FC<ConfirmOptimizationModalProps> = ({
  preview,
  isSubmitting,
  onCancel,
  onConfirm,
}) => {
  const [userChecked, setUserChecked] = useState(false);

  if (!preview) {
    return null;
  }

  const tweakIds = preview.changes.map((c) => c.tweakId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userChecked || isSubmitting) return;
    await onConfirm(preview.previewId, tweakIds);
    setUserChecked(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-opt-title"
    >
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-[#2E5077] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#1E3E62]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            <h2
              id="confirm-opt-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              تأكيد تطبيق تعديلات النظام الآمنة
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="إغلاق نافذة التأكيد"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            سيقوم الوكيل المحلي بإنشاء نقطة استعادة تلقائية برقم{' '}
            <span className="font-mono-tabular text-xs font-semibold text-slate-900 dark:text-white" dir="ltr">
              {preview.backupSnapshotId}
            </span>{' '}
            قبل تنفيذ التغييرات التالية:
          </div>

          {/* Exact Changes Table */}
          <div className="border border-slate-200 dark:border-[#1E3E62] rounded-lg overflow-hidden">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-[#1E3E62]/60 text-slate-700 dark:text-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">الإعداد</th>
                  <th className="py-2.5 px-3 font-semibold">الحالي</th>
                  <th className="py-2.5 px-3 font-semibold">بعد التطبيق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#1E3E62]">
                {preview.changes.map((chg) => (
                  <tr key={chg.tweakId} className="bg-white dark:bg-[#0B192C]">
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {chg.titleAr}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 mt-0.5" dir="ltr">
                        {chg.registryOrApiTarget}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {chg.beforeValueAr}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-sky-700 dark:text-sky-300">
                      {chg.afterValueAr}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Explicit Safety Guarantees */}
          <div className="rounded-lg bg-slate-50 dark:bg-[#1E3E62]/35 border border-slate-200 dark:border-[#2E5077] p-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <AlertCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>ضمانات الأمان المتحققة:</span>
            </div>
            <ul className="space-y-1 pr-6 list-disc">
              <li>لن يتم تعديل أو استبدال أي ملف أصلي داخل مجلدات الألعاب (EXE أو DLL أو CFG أو INI أو ملفات الموارد).</li>
              <li>خدمات الأمان في ويندوز (Windows Defender ومضاد الفيروسات والخدمات الأساسية) محمية ولن يتم إيقافها.</li>
              <li>جميع التغييرات قابلة للاستعادة الفورية عبر زر «استعادة الإعدادات الافتراضية».</li>
            </ul>
          </div>

          {/* Mandatory Explicit Consent Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-lg border border-slate-200 dark:border-[#2E5077] hover:bg-slate-50 dark:hover:bg-[#1E3E62]/30 transition-colors">
            <input
              type="checkbox"
              checked={userChecked}
              onChange={(e) => setUserChecked(e.target.checked)}
              className="mt-1 w-4 h-4 rounded accent-[#2E5077]"
            />
            <span className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
              أقرّ بمراجعة التغييرات أعلاه وأوافق صراحةً على تطبيقها على مستوى إعدادات نظام ويندوز فقط.
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!userChecked || isSubmitting || tweakIds.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckSquare className="w-4 h-4" aria-hidden="true" />
              <span>{isSubmitting ? 'جارٍ التطبيق...' : 'تأكيد وتطبيق التعديلات'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
