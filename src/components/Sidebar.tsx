import React from 'react';
import {
  Activity,
  Cloud,
  Cpu,
  Gamepad2,
  LayoutDashboard,
  Settings,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useAgent } from '../context/AgentContext';
import type { NavSection } from '../types/agent';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  labelAr: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', labelAr: 'لوحة التحكم', icon: LayoutDashboard },
  { id: 'games', labelAr: 'ألعابي', icon: Gamepad2 },
  { id: 'optimization', labelAr: 'التحسين المحلي', icon: SlidersHorizontal },
  { id: 'cloud', labelAr: 'الألعاب السحابية', icon: Cloud },
  { id: 'performance', labelAr: 'مراقب الأداء', icon: Activity },
  { id: 'settings', labelAr: 'الإعدادات', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const {
    activeSection,
    setActiveSection,
    connectionState,
    config,
    enableDemoMode,
    disableDemoMode,
  } = useAgent();

  const handleSelect = (id: NavSection) => {
    setActiveSection(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0B192C] border-l border-slate-200 dark:border-[#1E3E62] text-slate-900 dark:text-slate-100">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 dark:border-[#1E3E62]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#1E3E62] flex items-center justify-center text-white shrink-0">
            <Cpu className="w-5 h-5" aria-hidden="true" />
          </div>
          <span className="text-base font-bold tracking-tight whitespace-nowrap truncate" dir="ltr">
            GAME BOOSTER PRO
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="إغلاق القائمة"
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="التنقل الرئيسي">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                isActive
                  ? 'bg-[#1E3E62] text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E3E62]/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap truncate">{item.labelAr}</span>
            </button>
          );
        })}
      </nav>

      {/* Agent Connection Summary Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-[#1E3E62] space-y-3">
        <div className="space-y-1.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            حالة الوكيل المحلي (Windows)
          </div>
          <ConnectionStatusIndicator
            state={connectionState}
            demoMode={config.demoMode}
            compact
          />
        </div>

        <div className="flex items-center gap-2">
          {config.demoMode ? (
            <button
              type="button"
              onClick={disableDemoMode}
              className="w-full px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors whitespace-nowrap"
            >
              إيقاف العرض التجريبي
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void enableDemoMode()}
              className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-[#2E5077] text-white hover:bg-[#1E3E62] transition-colors whitespace-nowrap"
            >
              تشغيل العرض التجريبي
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
