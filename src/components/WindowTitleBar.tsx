import React, { useEffect, useState } from 'react';
import { Copy, Minus, RefreshCw, Shield, Square, X } from 'lucide-react';
import { useAgent } from '../context/AgentContext';
import desktopIconUrl from '../assets/images/desktop_app_icon_1794937355958.jpg';

export const WindowTitleBar: React.FC = () => {
  const { desktopAgentStatus, restartDesktopAgent } = useAgent();
  const [isMaximized, setIsMaximized] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  const desktopBridge = typeof window !== 'undefined' ? window.gbpDesktop : undefined;

  useEffect(() => {
    if (!desktopBridge) return;
    let mounted = true;
    void desktopBridge.isMaximized().then((val) => {
      if (mounted) setIsMaximized(val);
    });
    const unsubscribe = desktopBridge.onMaximizedChange((val) => {
      setIsMaximized(val);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [desktopBridge]);

  if (!desktopBridge?.isDesktopApp) {
    return null;
  }

  const showRestartButton =
    desktopAgentStatus?.state === 'crashed' ||
    desktopAgentStatus?.state === 'stopped' ||
    desktopAgentStatus?.state === 'missing_binary';

  return (
    <div
      className="h-9 bg-[#0B192C] text-white border-b border-[#1E3E62] flex items-center justify-between px-3 select-none shrink-0 z-50"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Right side in RTL: App Icon & Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        {!iconFailed ? (
          <img
            src={desktopIconUrl}
            alt="GAME BOOSTER PRO"
            referrerPolicy="no-referrer"
            onError={() => setIconFailed(true)}
            className="w-5 h-5 rounded object-cover shrink-0"
          />
        ) : (
          <Shield className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
        )}
        <span className="text-xs font-bold tracking-wide whitespace-nowrap" dir="ltr">
          GAME BOOSTER PRO
        </span>
        <span className="text-[11px] text-slate-400 hidden sm:inline whitespace-nowrap">
          · تطبيق سطح المكتب (v{desktopBridge.appVersion})
        </span>
      </div>

      {/* Center: Agent Supervisor State + Crash Recovery Action */}
      <div
        className="hidden md:flex items-center gap-2 text-[11px] text-slate-300"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span>
          {desktopAgentStatus?.state === 'running'
            ? 'الوكيل المحلي: متصل ويعمل'
            : desktopAgentStatus?.state === 'starting' || desktopAgentStatus?.state === 'restarting'
            ? desktopAgentStatus.messageAr
            : desktopAgentStatus?.state === 'crashed'
            ? 'توقف الوكيل المحلي بشكل مفاجئ'
            : desktopAgentStatus?.state === 'missing_binary'
            ? 'ملف الوكيل غير مضمّن'
            : 'الوكيل المحلي متوقف'}
        </span>
        {showRestartButton && (
          <button
            type="button"
            onClick={() => void restartDesktopAgent()}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#2E5077] hover:bg-[#1E3E62] text-white text-[11px] font-medium transition-colors"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            <span>إعادة التشغيل</span>
          </button>
        )}
      </div>

      {/* Left side in RTL: Standard Windows Window Controls */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => void desktopBridge.minimize()}
          aria-label="تصغير النافذة"
          className="h-full w-10 inline-flex items-center justify-center text-slate-300 hover:bg-[#1E3E62] hover:text-white transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void desktopBridge.toggleMaximize()}
          aria-label={isMaximized ? 'استعادة حجم النافذة' : 'تكبير النافذة'}
          className="h-full w-10 inline-flex items-center justify-center text-slate-300 hover:bg-[#1E3E62] hover:text-white transition-colors"
        >
          {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
        </button>
        <button
          type="button"
          onClick={() => void desktopBridge.close()}
          aria-label="إغلاق التطبيق"
          className="h-full w-10 inline-flex items-center justify-center text-slate-300 hover:bg-rose-600 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
