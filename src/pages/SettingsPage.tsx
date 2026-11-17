import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  History,
  Laptop,
  Moon,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Sun,
  Terminal,
} from 'lucide-react';
import { ConnectionStatusIndicator } from '../components/ConnectionStatusIndicator';
import { useAgent } from '../context/AgentContext';
import {
  LOCAL_AGENT_ENDPOINTS,
  validateLocalhostBaseUrl,
} from '../services/localAgentApi';
import type { AppSettingsState, NetworkTier } from '../types/agent';

export const SettingsPage: React.FC = () => {
  const {
    connectionState,
    connectionMessageAr,
    config,
    updateConfig,
    settings,
    updateSettings,
    health,
    isScanningDevice,
    connectAndFetchAll,
    enableDemoMode,
    disableDemoMode,
    showNotice,
    isDesktopApp,
    desktopAgentStatus,
    restartDesktopAgent,
    desktopPreferences,
    updateDesktopPreferences,
    sessionHistory,
  } = useAgent();

  const [baseUrlInput, setBaseUrlInput] = useState(config.baseUrl);
  const [tokenInput, setTokenInput] = useState(config.authToken);
  const [showToken, setShowToken] = useState(false);

  const urlCheck = validateLocalhostBaseUrl(baseUrlInput);

  const handleSaveAndTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlCheck.valid) {
      showNotice('error', urlCheck.reasonAr ?? 'عنوان الوكيل غير صالح.');
      return;
    }
    const nextConfig = {
      baseUrl: urlCheck.normalized,
      authToken: tokenInput,
      demoMode: false,
    };
    updateConfig(nextConfig);
    await connectAndFetchAll(nextConfig);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Section 1: Local Agent Connection & Security */}
      <section className="rounded-xl bg-white dark:bg-[#1E3E62]/30 border border-slate-200 dark:border-[#2E5077] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#1E3E62]">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              اتصال الوكيل المحلي لنظام ويندوز (Local Agent)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              يسمح فقط بالعناوين المحلية (localhost / 127.0.0.1) مع التحقق من رمز المصادقة Bearer والأصل (Origin).
            </p>
          </div>
          <ConnectionStatusIndicator
            state={connectionState}
            demoMode={config.demoMode}
          />
        </div>

        <form onSubmit={handleSaveAndTestConnection} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="agent-url"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                عنوان واجهة الوكيل المحلي (Base URL)
              </label>
              <input
                id="agent-url"
                type="url"
                dir="ltr"
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
                placeholder="http://127.0.0.1:48920"
                className="w-full px-3.5 py-2 rounded-lg text-sm font-mono-tabular bg-white dark:bg-[#0B192C] border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              />
              {!urlCheck.valid && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                  {urlCheck.reasonAr}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="agent-token"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
              >
                رمز المصادقة المحلي (Bearer Token)
              </label>
              <div className="relative">
                <input
                  id="agent-token"
                  type={showToken ? 'text' : 'password'}
                  dir="ltr"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="أدخل الرمز المولّد من تطبيق الوكيل"
                  className="w-full pl-10 pr-3.5 py-2 rounded-lg text-sm font-mono-tabular bg-white dark:bg-[#0B192C] border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((prev) => !prev)}
                  aria-label={showToken ? 'إخفاء الرمز' : 'إظهار الرمز'}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-[#0B192C] border border-slate-200 dark:border-[#1E3E62] p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div>الحالة: {connectionMessageAr}</div>
            {health && (
              <div className="font-mono-tabular text-slate-500 dark:text-slate-400" dir="ltr">
                Agent: {health.agentVersion} · OS: {health.os} · Elevation: {health.elevation}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!urlCheck.valid || isScanningDevice}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors disabled:opacity-50"
              >
                <PlugZap className="w-4 h-4" aria-hidden="true" />
                <span>{isScanningDevice ? 'جارٍ الاختبار...' : 'حفظ واختبار الاتصال الحقيقي'}</span>
              </button>

              {config.demoMode ? (
                <button
                  type="button"
                  onClick={disableDemoMode}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-[#2E5077] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors"
                >
                  <span>إيقاف الوضع التجريبي</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void enableDemoMode()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-[#2E5077] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors"
                >
                  <FlaskConical className="w-4 h-4" aria-hidden="true" />
                  <span>تفعيل وضع العرض التجريبي (Demo Mode)</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </section>

      {/* Section 2: Appearance, Language, & Network Profile */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            اللغة والمظهر
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-[#1E3E62]">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">
                  لغة الواجهة والاتجاه
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  واجهة عربية كاملة من اليمين إلى اليسار (RTL)
                </div>
              </div>
              <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                العربية (RTL)
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                سمة اللوحة (Theme)
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => updateSettings({ theme: 'dark' })}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
                    settings.theme === 'dark'
                      ? 'bg-[#1E3E62] text-white border-[#2E5077]'
                      : 'bg-white dark:bg-[#0B192C] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1E3E62]'
                  }`}
                >
                  <Moon className="w-4 h-4" aria-hidden="true" />
                  <span>كحلي داكن</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ theme: 'light' })}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
                    settings.theme === 'light'
                      ? 'bg-[#1E3E62] text-white border-[#2E5077]'
                      : 'bg-white dark:bg-[#0B192C] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1E3E62]'
                  }`}
                >
                  <Sun className="w-4 h-4" aria-hidden="true" />
                  <span>فاتح نقي</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            جودة الشبكة (لتقييم الألعاب السحابية)
          </h3>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="network-tier"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                نطاق سرعة الإنترنت الفعلية
              </label>
              <select
                id="network-tier"
                value={settings.networkTier}
                onChange={(e) =>
                  updateSettings({ networkTier: e.target.value as NetworkTier })
                }
                className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#0B192C] border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              >
                <option value="low_under_10">أقل من 10 Mbps (اتصال محدود)</option>
                <option value="medium_10_30">10 - 30 Mbps (السرعة المتوسطة القياسية)</option>
                <option value="high_over_30">أكثر من 30 Mbps (سرعة عالية)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="connection-type"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                وسيلة الاتصال بالشبكة
              </label>
              <select
                id="connection-type"
                value={settings.connectionType}
                onChange={(e) =>
                  updateSettings({
                    connectionType: e.target.value as AppSettingsState['connectionType'],
                  })
                }
                className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#0B192C] border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              >
                <option value="Wi-Fi 5GHz">Wi-Fi 5GHz</option>
                <option value="Ethernet">Ethernet (كابل مباشر)</option>
                <option value="Wi-Fi 2.4GHz">Wi-Fi 2.4GHz</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2B: Windows Desktop Lifecycle, Security & Upgrade Data Preservation */}
      <section className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#1E3E62]">
          <div className="flex items-center gap-2">
            <Laptop className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              إدارة تطبيق سطح المكتب (Windows 11 Desktop Shell)
            </h3>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isDesktopApp ? 'يعمل داخل تطبيق Electron لسطح المكتب' : 'وضع المتصفح (Web Frontend)'}
          </span>
        </div>

        {isDesktopApp ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 dark:bg-[#0B192C] border border-slate-200 dark:border-[#1E3E62] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    مشرف الوكيل المحلي المضمّن (Agent Supervisor)
                  </span>
                  <button
                    type="button"
                    onClick={() => void restartDesktopAgent()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>إعادة تشغيل الوكيل</span>
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {desktopAgentStatus?.messageAr ?? 'جارٍ التحقق من حالة مشرف الوكيل...'}
                </p>
                {desktopAgentStatus && (
                  <div className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400" dir="ltr">
                    State: {desktopAgentStatus.state} · PID: {desktopAgentStatus.pid ?? 'N/A'} · Restarts: {desktopAgentStatus.restartAttempts}
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-[#0B192C] border border-slate-200 dark:border-[#1E3E62] p-4 flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      تشغيل تلقائي مع بدء نظام Windows
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      خيار اختياري يسجّل التشغيل على مستوى المستخدم الحالي فقط (HKCU) دون صلاحيات مسؤول.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(desktopPreferences?.startWithWindows)}
                    onClick={() =>
                      void updateDesktopPreferences({
                        startWithWindows: !desktopPreferences?.startWithWindows,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      desktopPreferences?.startWithWindows
                        ? 'bg-[#2E5077]'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        desktopPreferences?.startWithWindows ? '-translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                التطبيق يعمل بصلاحيات المستخدم القياسية (<code className="font-mono-tabular">asInvoker</code>) ولا يطلب رفع الصلاحيات إلا لإجراء محدد يوافق عليه المستخدم صراحةً، مع حفظ نسخة احتياطية تلقائية للبيانات قبل أي ترقية.
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            أنت تستخدم الواجهة حالياً من خلال المتصفح. عند تشغيل الحزمة المكتبية على Windows 11 (<code className="font-mono-tabular">GAME_BOOSTER_PRO_Setup.exe</code>)، يتولى تطبيق Electron تشغيل الوكيل المحلي المضمّن، وإدارة النوافذ، وحفظ التفضيلات والنسخ الاحتياطية قبل الترقية تلقائياً.
          </p>
        )}
      </section>

      {/* Section 2C: Preserved Session History */}
      <section className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#1E3E62]">
          <div className="flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              سجل الجلسات والعمليات المحفوظ
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            يُحفظ عبر التحديثات دون حذف بيانات المستخدم
          </span>
        </div>

        {sessionHistory.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            لا توجد عمليات مسجلة حتى الآن. سيتم حفظ عمليات الفحص والتحسين والتشغيل تلقائياً هنا.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-[#1E3E62] max-h-64 overflow-y-auto">
            {sessionHistory.slice(0, 15).map((entry) => (
              <div key={entry.id} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{entry.titleAr}</div>
                  <div className="text-slate-600 dark:text-slate-300 mt-0.5">{entry.detailAr}</div>
                </div>
                <span className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400 shrink-0" dir="ltr">
                  {new Date(entry.timestamp).toLocaleString('en-GB', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Documented Local Agent API Contract */}
      <section className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              عقد واجهة برمجة الوكيل المحلي (Local Agent API Contract)
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>Origin + Bearer Token + Explicit Consent</span>
          </span>
        </div>

        <div className="border border-slate-200 dark:border-[#1E3E62] rounded-lg overflow-hidden">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-[#1E3E62]/60 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="py-2.5 px-3 font-semibold">الطريقة</th>
                <th className="py-2.5 px-3 font-semibold">المسار (Endpoint)</th>
                <th className="py-2.5 px-3 font-semibold">الوظيفة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1E3E62]">
              {LOCAL_AGENT_ENDPOINTS.map((ep) => (
                <tr key={ep.path}>
                  <td className="py-2.5 px-3 font-mono-tabular font-semibold text-sky-700 dark:text-sky-300" dir="ltr">
                    {ep.method}
                  </td>
                  <td className="py-2.5 px-3 font-mono-tabular text-slate-900 dark:text-slate-100" dir="ltr">
                    {ep.path}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                    {ep.summaryAr}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            كل طلب إلى الوكيل المحلي يرسل الترويسة <code className="font-mono-tabular">Authorization: Bearer &lt;token&gt;</code> و <code className="font-mono-tabular">X-Client-Origin</code> مع منع أي عنوان غير محلي.
          </span>
        </div>
      </section>
    </div>
  );
};
