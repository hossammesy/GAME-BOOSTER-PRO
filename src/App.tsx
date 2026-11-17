import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Info, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WindowTitleBar } from './components/WindowTitleBar';
import { AgentProvider, useAgent } from './context/AgentContext';
import { CloudGamingPage } from './pages/CloudGamingPage';
import { DashboardPage } from './pages/DashboardPage';
import { GameDetailsPage } from './pages/GameDetailsPage';
import { MyGamesPage } from './pages/MyGamesPage';
import { OptimizationPage } from './pages/OptimizationPage';
import { PerformancePage } from './pages/PerformancePage';
import { SettingsPage } from './pages/SettingsPage';

const AppShell: React.FC = () => {
  const {
    activeSection,
    selectedGameDetailsId,
    config,
    disableDemoMode,
    notice,
    clearNotice,
    isDesktopApp,
  } = useAgent();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardPage />;
      case 'games':
        return selectedGameDetailsId ? <GameDetailsPage /> : <MyGamesPage />;
      case 'optimization':
        return <OptimizationPage />;
      case 'cloud':
        return <CloudGamingPage />;
      case 'performance':
        return <PerformancePage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div
      className={
        isDesktopApp
          ? 'h-screen flex flex-col overflow-hidden bg-[#F4F7FB] dark:bg-[#0B192C] text-slate-900 dark:text-slate-100'
          : 'min-h-screen flex flex-col bg-[#F4F7FB] dark:bg-[#0B192C] text-slate-900 dark:text-slate-100'
      }
    >
      <WindowTitleBar />

      <div className={isDesktopApp ? 'flex-1 flex min-h-0 overflow-hidden' : 'flex-1 flex min-h-0'}>
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <div className={`flex-1 flex flex-col min-w-0 ${isDesktopApp ? 'overflow-y-auto' : ''}`}>
          <TopBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

          {/* Explicit Demo Mode Banner */}
          {config.demoMode && (
            <div className="px-4 sm:px-6 lg:px-8 py-2.5 bg-sky-50 dark:bg-[#1E3E62]/70 border-b border-sky-200 dark:border-[#2E5077] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-sky-900 dark:text-sky-100 font-medium">
                <FlaskConical className="w-4 h-4 text-sky-700 dark:text-sky-300 shrink-0" aria-hidden="true" />
                <span>
                  وضع العرض التجريبي (Demo Mode) نشط: البيانات المعروضة محاكاة لجهاز Windows 11 (i7-10610U · 16GB RAM · MX250 2GB) وليست قراءة حقيقية من جهازك.
                </span>
              </div>
              <button
                type="button"
                onClick={disableDemoMode}
                className="text-xs font-semibold text-sky-800 dark:text-sky-200 underline hover:no-underline whitespace-nowrap"
              >
                إلغاء الوضع التجريبي
              </button>
            </div>
          )}

          {/* Action Feedback Banner */}
          {notice && (
            <div className="px-4 sm:px-6 lg:px-8 pt-4">
              <div
                role="status"
                className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm ${
                  notice.tone === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : notice.tone === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                    : notice.tone === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    : 'bg-sky-50 dark:bg-[#1E3E62]/50 border-sky-200 dark:border-[#2E5077] text-sky-900 dark:text-sky-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {notice.tone === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : notice.tone === 'warning' || notice.tone === 'error' ? (
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{notice.messageAr}</span>
                </div>
                <button
                  type="button"
                  onClick={clearNotice}
                  aria-label="إغلاق التنبيه"
                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
            {renderSection()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AgentProvider>
      <AppShell />
    </AgentProvider>
  );
}
