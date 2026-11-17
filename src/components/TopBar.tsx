import React from 'react';
import { Menu, RefreshCw, ScanSearch } from 'lucide-react';
import { useAgent } from '../context/AgentContext';
import type { NavSection } from '../types/agent';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';

interface TopBarProps {
  onOpenMobileMenu: () => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  dashboard: 'لوحة التحكم وجاهزية الجهاز',
  games: 'ألعابي المثبتة على الجهاز',
  optimization: 'التحسين المحلي وإعدادات الأمان',
  cloud: 'الألعاب السحابية والخوادم البعيدة',
  performance: 'مراقب الأداء الحي',
  settings: 'الإعدادات واتصال الوكيل المحلي',
};

export const TopBar: React.FC<TopBarProps> = ({ onOpenMobileMenu }) => {
  const {
    activeSection,
    connectionState,
    config,
    isScanningDevice,
    scanDevice,
    setActiveSection,
  } = useAgent();

  return (
    <header className="sticky top-0 z-30 h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-sm border-b border-slate-200 dark:border-[#1E3E62]">
      {/* Zone 1: Page Title & Mobile Drawer Trigger */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="فتح قائمة التنقل"
          className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E3E62]"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
          {SECTION_TITLES[activeSection]}
        </h1>
      </div>

      {/* Zone 2: Connection Status */}
      <div className="hidden md:flex items-center shrink-0">
        <ConnectionStatusIndicator
          state={connectionState}
          demoMode={config.demoMode}
        />
      </div>

      {/* Zone 3: Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        {connectionState === 'connected' || config.demoMode ? (
          <button
            type="button"
            onClick={() => void scanDevice()}
            disabled={isScanningDevice}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {isScanningDevice ? (
              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <ScanSearch className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{isScanningDevice ? 'جارٍ الفحص...' : 'فحص الجهاز الآن'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors whitespace-nowrap shrink-0"
          >
            <span>إعداد اتصال الوكيل</span>
          </button>
        )}
      </div>
    </header>
  );
};
