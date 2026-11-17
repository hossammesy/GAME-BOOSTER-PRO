import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Check,
  FileCode2,
  Folder,
  HardDrive,
  RefreshCw,
  X,
} from 'lucide-react';
import { useAgent } from '../context/AgentContext';
import type { FileSystemBrowseResponse, FileSystemEntryItem } from '../types/agent';

interface WindowsFileBrowserModalProps {
  isOpen: boolean;
  mode: 'exe' | 'folder';
  onClose: () => void;
  onSelect: (selectedPath: string, suggestedName?: string) => void;
}

export const WindowsFileBrowserModal: React.FC<WindowsFileBrowserModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSelect,
}) => {
  const { browseAgentFileSystem, connectionState, config } = useAgent();
  const [browseData, setBrowseData] = useState<FileSystemBrowseResponse | null>(null);
  const [manualPath, setManualPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorAr, setErrorAr] = useState<string | null>(null);

  const loadDirectory = useCallback(
    async (targetPath?: string) => {
      setLoading(true);
      setErrorAr(null);
      try {
        const res = await browseAgentFileSystem(targetPath);
        setBrowseData(res);
        setManualPath(res.currentPath ?? '');
      } catch (err) {
        setErrorAr(
          err instanceof Error
            ? err.message
            : 'تعذر استعراض نظام الملفات عبر الوكيل المحلي.'
        );
      } finally {
        setLoading(false);
      }
    },
    [browseAgentFileSystem]
  );

  useEffect(() => {
    if (!isOpen) return;
    setBrowseData(null);
    setErrorAr(null);
    setManualPath('');
    if (!config.demoMode && connectionState === 'connected') {
      void loadDirectory(undefined);
    }
  }, [isOpen, config.demoMode, connectionState, loadDirectory]);

  if (!isOpen) return null;

  const isRealAgentReady = !config.demoMode && connectionState === 'connected';

  const handleEntryClick = (entry: FileSystemEntryItem) => {
    if (entry.entryType === 'drive' || entry.entryType === 'directory') {
      void loadDirectory(entry.fullPath);
      return;
    }
    if (entry.entryType === 'exe' && mode === 'exe') {
      const cleanName = entry.name.replace(/\.exe$/i, '');
      onSelect(entry.fullPath, cleanName);
      onClose();
    }
  };

  const handlePathJump = (e: React.FormEvent) => {
    e.preventDefault();
    void loadDirectory(manualPath.trim() || undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="win-browser-title"
    >
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-[#2E5077] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#1E3E62]">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            <h2
              id="win-browser-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              {mode === 'exe'
                ? 'استعراض أقراص ويندوز لاختيار ملف اللعبة (.exe)'
                : 'استعراض أقراص ويندوز لاختيار مجلد ألعاب'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق متصفح الملفات"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {!isRealAgentReady ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1.5">
                <div className="font-bold">تصفح الأقراص يتطلب اتصالاً بالوكيل المحلي الحقيقي</div>
                <p className="leading-relaxed">
                  لأسباب أمنية في المتصفحات، لا يمكن عرض مجلدات جهازك في الوضع التجريبي أو أثناء عدم الاتصال. شغّل الوكيل المحلي على ويندوز 11 أو افتح تطبيق سطح المكتب GAME BOOSTER PRO لاستخدام مستعرض النظام المباشر، أو أدخل المسار يدوياً في النموذج.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Address & Navigation Bar */}
              <form onSubmit={handlePathJump} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadDirectory(browseData?.parentPath ?? undefined)}
                  disabled={loading || !browseData?.currentPath}
                  title="العودة للمجلد الأعلى"
                  className="p-2 rounded-lg border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62] disabled:opacity-40"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  dir="ltr"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  placeholder="الأقراص المحلية (مثال: D:\Games)"
                  className="flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono-tabular bg-white dark:bg-[#1E3E62]/30 border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors"
                >
                  انتقال
                </button>
                <button
                  type="button"
                  onClick={() => void loadDirectory(browseData?.currentPath ?? undefined)}
                  disabled={loading}
                  aria-label="تحديث المجلد"
                  className="p-2 rounded-lg border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62]"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </form>

              {errorAr && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 p-3 text-xs text-rose-700 dark:text-rose-300">
                  {errorAr}
                </div>
              )}

              {/* Entries List */}
              <div className="border border-slate-200 dark:border-[#1E3E62] rounded-lg divide-y divide-slate-200 dark:divide-[#1E3E62] max-h-80 overflow-y-auto bg-slate-50/50 dark:bg-[#0B192C]/60">
                {loading && !browseData ? (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    جارٍ قراءة المحتويات من الوكيل المحلي...
                  </div>
                ) : browseData && browseData.entries.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    لا توجد مجلدات فرعية أو ملفات .exe في هذا المسار.
                  </div>
                ) : (
                  browseData?.entries.map((entry) => {
                    const isExe = entry.entryType === 'exe';
                    if (mode === 'folder' && isExe) return null;
                    return (
                      <button
                        key={entry.fullPath}
                        type="button"
                        onClick={() => handleEntryClick(entry)}
                        className="w-full px-4 py-2.5 flex items-center justify-between gap-3 text-right hover:bg-sky-50/80 dark:hover:bg-[#1E3E62]/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {entry.entryType === 'drive' ? (
                            <HardDrive className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                          ) : entry.entryType === 'directory' ? (
                            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                          ) : (
                            <FileCode2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          )}
                          <span
                            className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 truncate font-mono-tabular"
                            dir="ltr"
                          >
                            {entry.name}
                          </span>
                        </div>

                        {entry.sizeBytes !== null && (
                          <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 shrink-0" dir="ltr">
                            {entry.entryType === 'drive'
                              ? `${Math.round(entry.sizeBytes / 1024 / 1024 / 1024)} GB`
                              : `${Math.max(1, Math.round(entry.sizeBytes / 1024 / 1024))} MB`}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-[#1E3E62] flex items-center justify-between gap-3 bg-slate-50 dark:bg-[#0B192C]">
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate" dir="ltr">
            {browseData?.currentPath ?? 'قائمة الأقراص'}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62]"
            >
              إلغاء
            </button>
            {mode === 'folder' && isRealAgentReady && browseData?.currentPath && (
              <button
                type="button"
                onClick={() => {
                  onSelect(browseData.currentPath!);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#2E5077] hover:bg-[#1E3E62] text-white"
              >
                <Check className="w-4 h-4" />
                <span>اعتماد هذا المجلد</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
