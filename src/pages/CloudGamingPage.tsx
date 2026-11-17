import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  ExternalLink,
  Lock,
  Monitor,
  Plus,
  Server,
  Trash2,
  Wifi,
} from 'lucide-react';
import { useAgent } from '../context/AgentContext';
import { CLOUD_PROVIDERS } from '../data/demoData';
import type { RemoteWindowsGpuProfile } from '../types/agent';

const UNAVAILABLE_CLOUD_INTEGRATIONS = [
  {
    id: 'direct_stream',
    titleAr: 'تشغيل البث السحابي مباشرة داخل المتصفح',
    requirementAr: 'يتطلب ربط حساب مزوّد فعلي (OAuth/SDK رسمي) غير متاح عبر واجهات الويب العامة.',
  },
  {
    id: 'provider_sync',
    titleAr: 'مزامنة مكتبة الألعاب واشتراك المزوّد',
    requirementAr: 'غير متصل — يتطلب مفاتيح تكامل رسمية مع GeForce NOW أو Xbox Cloud Gaming.',
  },
  {
    id: 'edge_ping',
    titleAr: 'قياس زمن الاستجابة (Ping) الفعلي لخوادم البث',
    requirementAr: 'غير متاح حالياً — يتطلب وكيل شبكة محلي أو ICMP/WebRTC Probe مفعّل للمزوّد.',
  },
  {
    id: 'remote_launch',
    titleAr: 'إطلاق عميل Moonlight / Parsec تلقائياً من المنصة',
    requirementAr: 'غير متصل — يتطلب تشغيل الوكيل المحلي على ويندوز لتمرير معاملات الاتصال بأمان.',
  },
] as const;

export const CloudGamingPage: React.FC = () => {
  const {
    settings,
    remoteGpuProfiles,
    addRemoteGpuProfile,
    removeRemoteGpuProfile,
    setActiveSection,
    showNotice,
  } = useAgent();

  const [showAddForm, setShowAddForm] = useState(false);
  const [label, setLabel] = useState('');
  const [protocol, setProtocol] =
    useState<RemoteWindowsGpuProfile['protocol']>('Moonlight / Sunshine');
  const [hostAddress, setHostAddress] = useState('');
  const [port, setPort] = useState('47989');
  const [targetBitrateMbps, setTargetBitrateMbps] = useState('15');
  const [targetResolution, setTargetResolution] =
    useState<RemoteWindowsGpuProfile['targetResolution']>('1280x720@60');
  const [notes, setNotes] = useState('');

  const networkEstimate =
    settings.networkTier === 'low_under_10'
      ? {
          rangeLabel: 'أقل من 10 Mbps',
          verdictAr: 'غير كافٍ للبث السحابي المستقر؛ قد يحدث تقطيع ملحوظ حتى على 720p.',
          recommendedBitrate: '6 - 8 Mbps (720p @ 30fps كحد أقصى)',
        }
      : settings.networkTier === 'medium_10_30'
      ? {
          rangeLabel: '10 - 30 Mbps',
          verdictAr:
            'مناسب للبث السحابي بدقة 720p@60fps أو 1080p@30fps بشرط استقرار الاتصال وتجنب التحميل في الخلفية.',
          recommendedBitrate: '12 - 18 Mbps (720p@60fps مستقر)',
        }
      : {
          rangeLabel: 'أكثر من 30 Mbps',
          verdictAr:
            'ممتاز للبث السحابي بدقة 1080p@60fps أو 1440p مع زمن استجابة منخفض.',
          recommendedBitrate: '25 - 40 Mbps (1080p@60fps)',
        };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPort = Number(port);
    const parsedBitrate = Number(targetBitrateMbps);
    if (!label.trim() || !hostAddress.trim()) {
      showNotice('warning', 'يرجى إدخال اسم الملف وعنوان الخادم (IP أو Hostname).');
      return;
    }
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      showNotice('warning', 'رقم المنفذ (Port) يجب أن يكون بين 1 و 65535.');
      return;
    }
    if (!Number.isFinite(parsedBitrate) || parsedBitrate < 3 || parsedBitrate > 150) {
      showNotice('warning', 'معدل البت (Bitrate) يجب أن يكون بين 3 و 150 Mbps.');
      return;
    }

    addRemoteGpuProfile({
      label: label.trim(),
      protocol,
      hostAddress: hostAddress.trim(),
      port: parsedPort,
      targetBitrateMbps: parsedBitrate,
      targetResolution,
      notes: notes.trim() || 'ملف اتصال محفوظ للتحضير مع عميل البث المحلي.',
    });

    setLabel('');
    setHostAddress('');
    setNotes('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Honest Integration Status Banner */}
      <section className="rounded-xl bg-white dark:bg-[#1E3E62]/30 border border-slate-200 dark:border-[#2E5077] p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300 font-medium">
              <Cloud className="w-4 h-4" aria-hidden="true" />
              <span>جاهز للربط المستقبلي — لا يوجد مزوّد بث متصل حالياً</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              الألعاب السحابية وخوادم الرسوميات البعيدة
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              تساعدك هذه الصفحة على تقييم جاهزية شبكتك والوصول إلى البوابات الرسمية لمزوّدي الألعاب السحابية للألعاب التي تتجاوز قدرة MX250 2GB. تفصل الصفحة بوضوح بين الأدوات المتاحة حالياً والتكاملات غير المتاحة حتى ربط مزوّد فعلي.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border border-slate-300 dark:border-[#2E5077] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors whitespace-nowrap self-start lg:self-auto"
          >
            تعديل سرعة الشبكة في الإعدادات
          </button>
        </div>

        {/* Network Readiness Assessment Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-200 dark:border-[#1E3E62]">
          <div className="space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              ملف الشبكة المحدد
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wifi className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span>
                {networkEstimate.rangeLabel} · {settings.connectionType}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              معدل البت الموصى به للبث
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
              {networkEstimate.recommendedBitrate}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              التقييم العملي
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
              {networkEstimate.verdictAr}
            </div>
          </div>
        </div>

        {settings.connectionType === 'Wi-Fi 2.4GHz' && (
          <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 pt-1">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              تنبيه: الاتصال عبر Wi-Fi 2.4GHz يعاني عادة من تذبذب البنج (Jitter) أثناء البث السحابي؛ يُنصح بالتحويل إلى Wi-Fi 5GHz أو كابل Ethernet.
            </span>
          </div>
        )}
      </section>

      {/* Group 1: Available Services Today */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            الخدمات المتاحة حالياً (تقييم الجاهزية والروابط الرسمية)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CLOUD_PROVIDERS.map((provider) => (
            <div
              key={provider.id}
              className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {provider.name}
                  </h4>
                  <Monitor className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" />
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  الحد الأدنى: {provider.minBandwidthMbps} Mbps · الموصى به: {provider.recommendedBandwidthMbps} Mbps
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {provider.suitabilityNoteAr}
                </p>
                <div className="text-xs text-sky-700 dark:text-sky-300 pt-1">
                  {provider.integrationStatusAr}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-[#1E3E62] flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {provider.supportsBrowserOrDesktop}
                </span>
                <a
                  href={provider.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <span>الموقع الرسمي</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Group 2: Unavailable Integrations (explicitly separated) */}
      <section className="rounded-xl bg-white dark:bg-[#1E3E62]/20 border border-slate-200 dark:border-[#1E3E62] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            التكاملات غير المتاحة حالياً (تتطلب ربط مزوّد فعلي أو الوكيل المحلي)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {UNAVAILABLE_CLOUD_INTEGRATIONS.map((item) => (
            <div
              key={item.id}
              className="rounded-lg bg-slate-50 dark:bg-[#0B192C] border border-slate-200 dark:border-[#1E3E62] p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {item.titleAr}
                </span>
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                  غير متاح حالياً
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {item.requirementAr}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Optional Remote Windows GPU Servers (Moonlight / Sunshine / Parsec) */}
      <section className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                إدارة ملفات خوادم ويندوز GPU البعيدة (حفظ محلي)
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              حفظ بيانات خوادم Sunshine/Moonlight أو Parsec متاح محلياً الآن؛ أما التشغيل المباشر للعميل فيتم بعد ربط الوكيل المحلي.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{showAddForm ? 'إخفاء النموذج' : 'إضافة خادم بعيد'}</span>
          </button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleSaveProfile}
            className="rounded-lg bg-slate-50 dark:bg-[#0B192C] border border-slate-200 dark:border-[#2E5077] p-4 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                اسم الملف التعريفي
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="مثال: خادم RTX المنزلي"
                className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#1E3E62]/40 border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                البروتوكول
              </label>
              <select
                value={protocol}
                onChange={(e) =>
                  setProtocol(e.target.value as RemoteWindowsGpuProfile['protocol'])
                }
                className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#1E3E62]/40 border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              >
                <option value="Moonlight / Sunshine">Moonlight / Sunshine</option>
                <option value="Parsec">Parsec</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                عنوان الخادم (IP أو نطاق)
              </label>
              <input
                type="text"
                dir="ltr"
                value={hostAddress}
                onChange={(e) => setHostAddress(e.target.value)}
                placeholder="192.168.1.50"
                className="w-full px-3 py-2 rounded-lg text-sm font-mono-tabular bg-white dark:bg-[#1E3E62]/40 border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                المنفذ (Port)
              </label>
              <input
                type="number"
                dir="ltr"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm font-mono-tabular bg-white dark:bg-[#1E3E62]/40 border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                معدل البت (Mbps)
              </label>
              <input
                type="number"
                dir="ltr"
                value={targetBitrateMbps}
                onChange={(e) => setTargetBitrateMbps(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm font-mono-tabular bg-white dark:bg-[#1E3E62]/40 border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                الدقة المستهدفة
              </label>
              <select
                dir="ltr"
                value={targetResolution}
                onChange={(e) =>
                  setTargetResolution(
                    e.target.value as RemoteWindowsGpuProfile['targetResolution']
                  )
                }
                className="w-full px-3 py-2 rounded-lg text-sm font-mono-tabular bg-white dark:bg-[#1E3E62]/40 border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              >
                <option value="1280x720@60">1280x720@60</option>
                <option value="1920x1080@30">1920x1080@30</option>
                <option value="1920x1080@60">1920x1080@60</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                ملاحظات (اختياري)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: يتطلب تفعيل Wake-on-LAN"
                className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#1E3E62]/40 border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors"
              >
                حفظ ملف الخادم
              </button>
            </div>
          </form>
        )}

        {remoteGpuProfiles.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            لا توجد ملفات خوادم بعيدة محفوظة حالياً.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-[#1E3E62]">
            {remoteGpuProfiles.map((profile) => (
              <div
                key={profile.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums flex flex-wrap items-center gap-2">
                    <span>{profile.protocol}</span>
                    <span aria-hidden="true">·</span>
                    <span dir="ltr" className="font-mono-tabular">
                      {profile.hostAddress}:{profile.port}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span dir="ltr" className="font-mono-tabular">
                      {profile.targetResolution} · {profile.targetBitrateMbps} Mbps
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {profile.notes}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    محفوظ محلياً · بانتظار الوكيل
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRemoteGpuProfile(profile.id)}
                    aria-label={`حذف ${profile.label}`}
                    className="p-2 rounded-lg text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
