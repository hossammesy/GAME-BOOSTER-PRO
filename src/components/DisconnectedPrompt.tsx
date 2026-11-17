import React from 'react';
import { FlaskConical, PlugZap, Settings2, ShieldAlert, Terminal } from 'lucide-react';
import { useAgent } from '../context/AgentContext';

interface DisconnectedPromptProps {
  contextTitleAr: string;
  contextDescriptionAr: string;
}

export const DisconnectedPrompt: React.FC<DisconnectedPromptProps> = ({
  contextTitleAr,
  contextDescriptionAr,
}) => {
  const {
    connectionState,
    connectionMessageAr,
    enableDemoMode,
    connectAndFetchAll,
    setActiveSection,
    isScanningDevice,
  } = useAgent();

  return (
    <div className="rounded-xl bg-white dark:bg-[#1E3E62]/35 border border-slate-200 dark:border-[#2E5077] p-6 sm:p-8 max-w-3xl">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-[#1E3E62] flex items-center justify-center text-[#2E5077] dark:text-sky-300 shrink-0">
          {connectionState === 'permission_required' ? (
            <ShieldAlert className="w-6 h-6" aria-hidden="true" />
          ) : (
            <PlugZap className="w-6 h-6" aria-hidden="true" />
          )}
        </div>
        <div className="space-y-4 flex-1">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {contextTitleAr}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {contextDescriptionAr}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-[#0B192C] border border-slate-200 dark:border-[#2E5077]/70 p-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1.5">
            <div className="font-semibold text-slate-900 dark:text-white">
              تفاصيل الحالة الحالية:
            </div>
            <p>{connectionMessageAr}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              لأسباب تتعلق بأمان المتصفحات، لا يمكن لتطبيق الويب فحص عمليات ويندوز أو الألعاب المثبتة أو قراءة حرارة GPU مباشرة بدون تشغيل الوكيل المحلي الموثّق على localhost.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void enableDemoMode()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors whitespace-nowrap"
            >
              <FlaskConical className="w-4 h-4" aria-hidden="true" />
              <span>تفعيل وضع العرض التجريبي (Demo Mode)</span>
            </button>

            <button
              type="button"
              onClick={() => void connectAndFetchAll()}
              disabled={isScanningDevice}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-[#2E5077] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              <Terminal className="w-4 h-4" aria-hidden="true" />
              <span>{isScanningDevice ? 'جارٍ المحاولة...' : 'إعادة محاولة الاتصال المحلي'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              <Settings2 className="w-4 h-4" aria-hidden="true" />
              <span>إعدادات الوكيل والرمز الأمني</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
