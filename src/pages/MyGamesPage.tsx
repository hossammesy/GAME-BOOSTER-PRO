import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Edit3,
  FileCode2,
  FolderOpen,
  FolderPlus,
  Gamepad2,
  LayoutGrid,
  List,
  Play,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { DisconnectedPrompt } from '../components/DisconnectedPrompt';
import { PrePlayOptimizeModal } from '../components/PrePlayOptimizeModal';
import { WindowsFileBrowserModal } from '../components/WindowsFileBrowserModal';
import { useAgent } from '../context/AgentContext';
import { validateGameExecutablePath } from '../services/localAgentApi';
import type {
  GameCompatibility,
  GameLauncher,
  GameSortOption,
  InstalledGame,
} from '../types/agent';

const COMPATIBILITY_LABELS: Record<GameCompatibility, { labelAr: string; colorClass: string; rank: number }> = {
  excellent: {
    labelAr: 'ممتاز (Excellent)',
    colorClass: 'text-emerald-700 dark:text-emerald-400',
    rank: 1,
  },
  optimal: {
    labelAr: 'مناسب مباشرة',
    colorClass: 'text-emerald-700 dark:text-emerald-400',
    rank: 1,
  },
  good: {
    labelAr: 'جيد (Good)',
    colorClass: 'text-sky-700 dark:text-sky-300',
    rank: 2,
  },
  limited: {
    labelAr: 'محدود (Limited)',
    colorClass: 'text-amber-700 dark:text-amber-400',
    rank: 3,
  },
  needs_tuning: {
    labelAr: 'يحتاج ضبط إعدادات',
    colorClass: 'text-amber-700 dark:text-amber-400',
    rank: 3,
  },
  not_recommended: {
    labelAr: 'غير موصى به',
    colorClass: 'text-rose-700 dark:text-rose-400',
    rank: 4,
  },
  heavy_for_vram: {
    labelAr: 'ثقيل على 2GB VRAM',
    colorClass: 'text-rose-700 dark:text-rose-400',
    rank: 4,
  },
  unknown: {
    labelAr: 'غير معروف',
    colorClass: 'text-slate-600 dark:text-slate-400',
    rank: 5,
  },
};

const isReadyGroup = (c: GameCompatibility) => c === 'excellent' || c === 'good' || c === 'optimal';
const isLimitedGroup = (c: GameCompatibility) => c === 'limited' || c === 'needs_tuning';
const isHeavyGroup = (c: GameCompatibility) => c === 'not_recommended' || c === 'heavy_for_vram';

const GameCoverArtwork: React.FC<{ game: InstalledGame }> = ({ game }) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (game.coverImageUrl && !imgFailed) {
    return (
      <img
        src={game.coverImageUrl}
        alt={game.title}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-cover"
      />
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-[#0B192C] via-[#1E3E62] to-[#2E5077] flex flex-col items-center justify-center p-4 text-center text-white">
      <Gamepad2 className="w-8 h-8 text-sky-300 mb-2" aria-hidden="true" />
      <div className="text-xs font-bold leading-snug line-clamp-2">{game.title}</div>
      <div className="text-[10px] text-sky-200/80 font-mono-tabular mt-1">{game.launcher}</div>
    </div>
  );
};

export const MyGamesPage: React.FC = () => {
  const {
    connectionState,
    config,
    hardware,
    games,
    lastScannedAt,
    lastScanLocations,
    isScanningGames,
    scanInstalledGames,
    registerManualGame,
    updateManualGame,
    removeManualGame,
    toggleFavorite,
    customFolders,
    addCustomGameFolder,
    removeCustomGameFolder,
    launchGame,
    launchingGameId,
    launchStatus,
    openGameDetails,
  } = useAgent();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<
    'all' | 'favorites' | 'ready' | 'limited' | 'heavy' | 'unknown'
  >('all');
  const [sortOption, setSortOption] = useState<GameSortOption>('favorites_first');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Manual Game Add / Edit Form State
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualExePath, setManualExePath] = useState('');
  const [manualLauncher, setManualLauncher] = useState<GameLauncher>('Standalone');
  const [manualGpu, setManualGpu] = useState(
    hardware?.gpu.primaryModel ?? 'NVIDIA GeForce MX250 (2GB)'
  );
  const [manualSizeGb, setManualSizeGb] = useState('');
  const [manualVramMb, setManualVramMb] = useState('');

  // Custom Folders Panel
  const [showFoldersPanel, setShowFoldersPanel] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState('');

  // Windows File Browser Modal
  const [browserModalMode, setBrowserModalMode] = useState<'exe' | 'folder' | null>(null);

  // Pre-Play Scan & Optimize Modal
  const [prePlayGame, setPrePlayGame] = useState<InstalledGame | null>(null);

  const exeValidation = useMemo(
    () => (manualExePath ? validateGameExecutablePath(manualExePath) : null),
    [manualExePath]
  );

  const filteredAndSortedGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = games.filter((game) => {
      const matchesTab =
        filterTab === 'all' ||
        (filterTab === 'favorites' && Boolean(game.isFavorite)) ||
        (filterTab === 'ready' && isReadyGroup(game.compatibility)) ||
        (filterTab === 'limited' && isLimitedGroup(game.compatibility)) ||
        (filterTab === 'heavy' && isHeavyGroup(game.compatibility)) ||
        (filterTab === 'unknown' && game.compatibility === 'unknown');

      const matchesSearch =
        !q ||
        game.title.toLowerCase().includes(q) ||
        game.launcher.toLowerCase().includes(q) ||
        game.executablePath.toLowerCase().includes(q) ||
        game.installPath.toLowerCase().includes(q) ||
        game.detectedGpu.toLowerCase().includes(q);

      return matchesTab && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      if (sortOption === 'favorites_first') {
        const favDiff = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
        if (favDiff !== 0) return favDiff;
        return a.title.localeCompare(b.title);
      }
      if (sortOption === 'title_asc') {
        return a.title.localeCompare(b.title);
      }
      if (sortOption === 'launcher') {
        const lDiff = a.launcher.localeCompare(b.launcher);
        return lDiff !== 0 ? lDiff : a.title.localeCompare(b.title);
      }
      if (sortOption === 'compatibility') {
        const rankDiff =
          COMPATIBILITY_LABELS[a.compatibility].rank -
          COMPATIBILITY_LABELS[b.compatibility].rank;
        return rankDiff !== 0 ? rankDiff : a.title.localeCompare(b.title);
      }
      if (sortOption === 'last_played') {
        const lpA = a.lastPlayed ? 1 : 0;
        const lpB = b.lastPlayed ? 1 : 0;
        if (lpA !== lpB) return lpB - lpA;
        return (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? '');
      }
      if (sortOption === 'size_desc') {
        return (b.sizeGb || 0) - (a.sizeGb || 0);
      }
      return 0;
    });
  }, [games, filterTab, searchQuery, sortOption]);

  const resetManualForm = () => {
    setEditingGameId(null);
    setManualTitle('');
    setManualExePath('');
    setManualLauncher('Standalone');
    setManualSizeGb('');
    setManualVramMb('');
  };

  const openAddManualForm = () => {
    resetManualForm();
    setShowManualForm(true);
  };

  const startEditingGame = (game: InstalledGame) => {
    setEditingGameId(game.id);
    setManualTitle(game.title);
    setManualExePath(game.executablePath);
    setManualLauncher(game.launcher);
    setManualGpu(game.detectedGpu || hardware?.gpu.primaryModel || 'NVIDIA GeForce MX250 (2GB)');
    setManualSizeGb(game.sizeGb > 0 ? String(game.sizeGb) : '');
    setManualVramMb(game.vramRequirementMb > 0 ? String(game.vramRequirementMb) : '');
    setShowManualForm(true);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedVram = manualVramMb.trim() ? Number(manualVramMb) : undefined;
    const parsedSize = manualSizeGb.trim() ? Number(manualSizeGb) : undefined;
    const payload = {
      title: manualTitle,
      executablePath: manualExePath,
      launcher: manualLauncher,
      detectedGpu: manualGpu,
      sizeGb: parsedSize,
      vramRequirementMb: parsedVram,
    };

    const ok = editingGameId
      ? updateManualGame(editingGameId, payload)
      : registerManualGame(payload);

    if (ok) {
      resetManualForm();
      setShowManualForm(false);
    }
  };

  const handleBrowseExe = async () => {
    const desktopBrowse = window.gbpDesktop?.browseGameExecutable;
    if (window.gbpDesktop?.isDesktopApp && desktopBrowse) {
      const selected = await desktopBrowse();
      if (selected) {
        setManualExePath(selected);
        if (!manualTitle.trim()) {
          const filename = selected.split('\\').pop() ?? '';
          setManualTitle(filename.replace(/\.exe$/i, ''));
        }
      }
      return;
    }
    setBrowserModalMode('exe');
  };

  const handleBrowseFolder = async () => {
    const desktopBrowse = window.gbpDesktop?.browseGameFolder;
    if (window.gbpDesktop?.isDesktopApp && desktopBrowse) {
      const selected = await desktopBrowse();
      if (selected) {
        const added = await addCustomGameFolder(selected);
        if (added) setNewFolderInput('');
      }
      return;
    }
    setBrowserModalMode('folder');
  };

  const handleAddFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderInput.trim()) return;
    const ok = await addCustomGameFolder(newFolderInput);
    if (ok) {
      setNewFolderInput('');
    }
  };

  const isAgentAvailable = connectionState === 'connected' || config.demoMode;
  const favoriteCount = games.filter((g) => g.isFavorite).length;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="rounded-xl bg-white dark:bg-[#1E3E62]/30 border border-slate-200 dark:border-[#2E5077] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              مكتبة الألعاب المثبتة ومشغّل الألعاب المحلي
            </h2>
            {config.demoMode && (
              <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                · بيانات تجريبية
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            رصد تلقائي لألعاب Steam وEpic Games وXbox واختصارات سطح المكتب وقائمة ابدأ ومجلداتك المخصصة. تُحفظ المكتبة والمفضلات محلياً في قاعدة SQLite دون اتصال سحابي ودون مساس بملفات اللعبة.
          </p>
          {lastScannedAt && (
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              آخر فحص عبر الوكيل: {new Date(lastScannedAt).toLocaleTimeString('ar-EG')} · المسارات المفحوصة: {lastScanLocations.length}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowFoldersPanel((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium border border-slate-300 dark:border-[#2E5077] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4" aria-hidden="true" />
            <span>مجلدات الفحص ({customFolders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (showManualForm) {
                resetManualForm();
                setShowManualForm(false);
              } else {
                openAddManualForm();
              }
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium border border-slate-300 dark:border-[#2E5077] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1E3E62] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{showManualForm ? 'إغلاق النموذج' : 'إضافة لعبة يدوياً'}</span>
          </button>

          <button
            type="button"
            onClick={() => void scanInstalledGames()}
            disabled={isScanningGames}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-4 h-4 ${isScanningGames ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isScanningGames ? 'جارٍ مسح الأقراص...' : 'فحص الألعاب (Scan)'}</span>
          </button>
        </div>
      </div>

      {/* Honest Launch Outcome Feedback Banner */}
      {launchStatus && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-xs sm:text-sm flex items-start gap-2.5 ${
            launchStatus.launched
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200'
          }`}
        >
          {launchStatus.launched ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <div className="font-bold">حالة التشغيل ({launchStatus.status})</div>
            <div>{launchStatus.messageAr}</div>
          </div>
        </div>
      )}

      {/* Custom Game Folders Manager */}
      {showFoldersPanel && (
        <section className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#2E5077] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                مجلدات الألعاب المخصصة للفحص
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                أضف أي مجلد تحتوي فيه ألعابك (مثل <span dir="ltr" className="font-mono-tabular">D:\Games</span>) لتفادي المسح الكامل البطيء للقرص.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFoldersPanel(false)}
              aria-label="إغلاق لوحة المجلدات"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddFolderSubmit} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              dir="ltr"
              value={newFolderInput}
              onChange={(e) => setNewFolderInput(e.target.value)}
              placeholder="D:\MyGames"
              className="flex-1 min-w-[220px] px-3 py-2 rounded-lg text-xs sm:text-sm font-mono-tabular bg-white dark:bg-[#0B192C] border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => void handleBrowseFolder()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62]"
            >
              <FolderOpen className="w-4 h-4" />
              <span>استعراض مجلد</span>
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-bold bg-[#2E5077] hover:bg-[#1E3E62] text-white"
            >
              إضافة المجلد
            </button>
          </form>

          {customFolders.length > 0 && (
            <ul className="divide-y divide-slate-200 dark:divide-[#1E3E62] border border-slate-200 dark:border-[#1E3E62] rounded-lg bg-slate-50/70 dark:bg-[#0B192C]/60">
              {customFolders.map((folder) => (
                <li
                  key={folder}
                  className="px-3.5 py-2 flex items-center justify-between gap-3 text-xs"
                >
                  <span className="font-mono-tabular text-slate-800 dark:text-slate-200 truncate" dir="ltr">
                    {folder}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeCustomGameFolder(folder)}
                    aria-label={`إزالة المجلد ${folder}`}
                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Manual Game Add / Edit Form */}
      {showManualForm && (
        <form
          onSubmit={handleManualSubmit}
          className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#2E5077] p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingGameId ? 'تعديل بيانات لعبة مسجلة يدوياً' : 'تسجيل لعبة مثبتة يدوياً (.exe)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                اختر ملف التشغيل الحقيقي (.exe) على جهاز ويندوز بالاستعراض المباشر أو إدخال المسار لحفظ اللعبة في قاعدة SQLite المحلية.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetManualForm();
                setShowManualForm(false);
              }}
              aria-label="إغلاق النموذج"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                اسم اللعبة
              </label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="مثال: Forza Horizon 4"
                className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#0B192C] border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                مسار الملف التنفيذي (Executable Path)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={manualExePath}
                  onChange={(e) => setManualExePath(e.target.value)}
                  placeholder="C:\Games\MyGame\Game.exe"
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-mono-tabular bg-white dark:bg-[#0B192C] border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => void handleBrowseExe()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-[#2E5077] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E3E62] shrink-0"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>استعراض EXE</span>
                </button>
              </div>
              {exeValidation && !exeValidation.valid && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                  {exeValidation.reasonAr}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                المشغّل (Launcher)
              </label>
              <select
                value={manualLauncher}
                onChange={(e) => setManualLauncher(e.target.value as GameLauncher)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#0B192C] border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              >
                <option value="Standalone">Standalone (مستقل)</option>
                <option value="Steam">Steam</option>
                <option value="Epic Games">Epic Games</option>
                <option value="Xbox App">Xbox App</option>
                <option value="Riot Client">Riot Client</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                البطاقة المستهدفة (Detected GPU)
              </label>
              <select
                dir="ltr"
                value={manualGpu}
                onChange={(e) => setManualGpu(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#0B192C] border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              >
                <option value="NVIDIA GeForce MX250 (2GB)">NVIDIA GeForce MX250 (2GB)</option>
                <option value="Intel UHD Graphics">Intel UHD Graphics</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                حجم اللعبة (GB) — اختياري
              </label>
              <input
                type="number"
                dir="ltr"
                step="0.1"
                min={0.1}
                placeholder="مثال: 18.5"
                value={manualSizeGb}
                onChange={(e) => setManualSizeGb(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm font-mono-tabular bg-white dark:bg-[#0B192C] border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                VRAM الموثّق (MB) — اختياري
              </label>
              <input
                type="number"
                dir="ltr"
                min={256}
                max={16384}
                placeholder="اتركه فارغاً إن كان غير معروف"
                value={manualVramMb}
                onChange={(e) => setManualVramMb(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm font-mono-tabular bg-white dark:bg-[#0B192C] border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg text-sm font-bold bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors"
              >
                {editingGameId ? 'حفظ التعديلات' : 'حفظ اللعبة في القائمة'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Honest Disconnected Warning if neither Local Agent nor Demo Mode is active */}
      {!isAgentAvailable && (
        <DisconnectedPrompt
          contextTitleAr="الفحص والتشغيل المباشر للألعاب يتطلب الوكيل المحلي"
          contextDescriptionAr="لا يمكن للمتصفح قراءة مجلدات الألعاب على أقراص ويندوز أو تشغيل ملفات .exe مباشرة. يمكنك تسجيل ألعابك يدوياً أعلاه، أو تشغيل الوكيل المحلي، أو تفعيل وضع العرض التجريبي للمعاينة."
        />
      )}

      {/* Filter, Search, Sort & View Controls */}
      {(isAgentAvailable || games.length > 0) && (
        <>
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#1E3E62]/40">
              {(
                [
                  { id: 'all', label: `الكل (${games.length})` },
                  { id: 'favorites', label: `المفضلة (${favoriteCount})` },
                  {
                    id: 'ready',
                    label: `ممتاز / جيد (${games.filter((g) => isReadyGroup(g.compatibility)).length})`,
                  },
                  {
                    id: 'limited',
                    label: `محدود (${games.filter((g) => isLimitedGroup(g.compatibility)).length})`,
                  },
                  {
                    id: 'heavy',
                    label: `غير موصى به (${games.filter((g) => isHeavyGroup(g.compatibility)).length})`,
                  },
                  {
                    id: 'unknown',
                    label: `غير معروف (${games.filter((g) => g.compatibility === 'unknown').length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    filterTab === tab.id
                      ? 'bg-white dark:bg-[#2E5077] text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px] sm:w-64">
                <Search
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو المسار أو المشغّل..."
                  className="w-full pr-9 pl-3 py-2 rounded-lg text-xs sm:text-sm bg-white dark:bg-[#1E3E62]/30 border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as GameSortOption)}
                  aria-label="ترتيب الألعاب"
                  className="px-3 py-2 rounded-lg text-xs sm:text-sm bg-white dark:bg-[#1E3E62]/30 border border-slate-300 dark:border-[#2E5077] text-slate-900 dark:text-white"
                >
                  <option value="favorites_first">المفضلة أولاً</option>
                  <option value="title_asc">الاسم (أ - ي)</option>
                  <option value="launcher">المشغّل (Launcher)</option>
                  <option value="compatibility">الأكثر توافقاً</option>
                  <option value="last_played">آخر تشغيل</option>
                  <option value="size_desc">الأكبر حجماً</option>
                </select>
              </div>

              <div className="inline-flex items-center p-1 rounded-lg bg-slate-200/70 dark:bg-[#1E3E62]/40">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  aria-label="عرض كبطاقات"
                  className={`p-1.5 rounded-md ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-[#2E5077] text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-300'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  aria-label="عرض كجدول"
                  className={`p-1.5 rounded-md ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-[#2E5077] text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-300'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {filteredAndSortedGames.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] p-10 text-center space-y-3">
              <Gamepad2 className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                لا توجد ألعاب مطابقة لخيارات البحث الحالية
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                جرّب مسح نص البحث أو أضف لعبة يدوياً أو اضغط «فحص الألعاب» لتحديث القائمة.
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredAndSortedGames.map((game) => {
                const comp = COMPATIBILITY_LABELS[game.compatibility];
                const isLaunchingThis = launchingGameId === game.id;
                const installed = game.isInstalled !== false;

                return (
                  <article
                    key={game.id}
                    className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] overflow-hidden flex flex-col justify-between hover:border-[#2E5077] transition-colors"
                  >
                    <div>
                      {/* Cover + Top Controls */}
                      <div className="relative h-40 overflow-hidden border-b border-slate-200 dark:border-[#1E3E62]">
                        <GameCoverArtwork game={game} />

                        <button
                          type="button"
                          onClick={() => toggleFavorite(game.id)}
                          aria-label={game.isFavorite ? `إزالة ${game.title} من المفضلة` : `إضافة ${game.title} للمفضلة`}
                          className="absolute top-2.5 left-2.5 p-2 rounded-lg bg-[#0B192C]/80 hover:bg-[#0B192C] text-white transition-colors"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              game.isFavorite
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>

                        <div className="absolute bottom-2.5 right-2.5 left-2.5 flex items-center justify-between gap-2 text-[11px] font-medium">
                          <span className="px-2 py-0.5 rounded bg-[#0B192C]/85 text-white font-mono-tabular">
                            {game.launcher}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded bg-[#0B192C]/85 ${
                              installed ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            {installed ? 'مثبت وجاهز' : 'الملف غير موجود'}
                          </span>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                            {game.title}
                          </h3>
                          <span className={`text-xs font-semibold shrink-0 ${comp.colorClass}`}>
                            {comp.labelAr}
                          </span>
                        </div>

                        <div
                          className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5"
                          dir="ltr"
                          title={game.executablePath || game.installPath}
                        >
                          <FileCode2 className="w-3.5 h-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                          <span className="truncate">
                            {game.executablePath || game.installPath}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-[#1E3E62]">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              آخر تشغيل: {game.lastPlayed ? game.lastPlayed : 'غير مسجل'}
                            </span>
                          </span>
                          <span className="font-mono-tabular" dir="ltr">
                            {game.sizeGb > 0 ? `${game.sizeGb} GB` : 'الحجم غير محدد'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void launchGame(game.id, 'local')}
                          disabled={isLaunchingThis}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#2E5077] hover:bg-[#1E3E62] text-white transition-colors disabled:opacity-60"
                        >
                          <Play className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isLaunchingThis ? 'جارٍ التشغيل...' : 'تشغيل'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPrePlayGame(game)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[#2E5077] text-[#2E5077] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-[#1E3E62] transition-colors"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>فحص وتحسين قبل التشغيل</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openGameDetails(game.id)}
                          className="text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline"
                        >
                          التفاصيل والتوصيات الذكية
                        </button>

                        {game.isManualEntry && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditingGame(game)}
                              aria-label={`تعديل ${game.title}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-300 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeManualGame(game.id)}
                              aria-label={`حذف ${game.title}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl bg-white dark:bg-[#1E3E62]/25 border border-slate-200 dark:border-[#1E3E62] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-[#1E3E62]/60 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-[#1E3E62]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">المفضلة</th>
                      <th className="py-3 px-4 font-semibold">اللعبة ومسار التشغيل</th>
                      <th className="py-3 px-4 font-semibold">المشغّل والحالة</th>
                      <th className="py-3 px-4 font-semibold">التوافق وآخر تشغيل</th>
                      <th className="py-3 px-4 font-semibold">التشغيل والتحسين</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#1E3E62]">
                    {filteredAndSortedGames.map((game) => {
                      const comp = COMPATIBILITY_LABELS[game.compatibility];
                      const isLaunchingThis = launchingGameId === game.id;
                      const installed = game.isInstalled !== false;

                      return (
                        <tr
                          key={game.id}
                          className="hover:bg-slate-50 dark:hover:bg-[#1E3E62]/25"
                        >
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => toggleFavorite(game.id)}
                              aria-label={`مفضلة ${game.title}`}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#1E3E62]"
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  game.isFavorite
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-400'
                                }`}
                              />
                            </button>
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                              <span>{game.title}</span>
                              {game.isManualEntry && (
                                <span className="text-[11px] font-normal text-sky-700 dark:text-sky-300">
                                  · يدوية
                                </span>
                              )}
                            </div>
                            <div
                              className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 mt-0.5 truncate"
                              dir="ltr"
                              title={game.executablePath || game.installPath}
                            >
                              {game.executablePath || game.installPath}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {game.launcher}
                            </div>
                            <div
                              className={`mt-0.5 ${
                                installed
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {installed ? 'مثبت وجاهز' : 'الملف غير موجود'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <span className={`font-semibold ${comp.colorClass}`}>
                              {comp.labelAr}
                            </span>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              آخر تشغيل: {game.lastPlayed ? game.lastPlayed : 'غير مسجل'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void launchGame(game.id, 'local')}
                                disabled={isLaunchingThis}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2E5077] hover:bg-[#1E3E62] text-white disabled:opacity-60 whitespace-nowrap"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>{isLaunchingThis ? 'جارٍ...' : 'تشغيل'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPrePlayGame(game)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#2E5077] text-[#2E5077] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-[#1E3E62] whitespace-nowrap"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>فحص وتحسين</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openGameDetails(game.id)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline whitespace-nowrap"
                              >
                                تفاصيل
                              </button>
                              {game.isManualEntry && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEditingGame(game)}
                                    aria-label={`تعديل ${game.title}`}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-300"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeManualGame(game.id)}
                                    aria-label={`حذف ${game.title}`}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Windows File / Folder Browser Modal */}
      <WindowsFileBrowserModal
        isOpen={browserModalMode !== null}
        mode={browserModalMode ?? 'exe'}
        onClose={() => setBrowserModalMode(null)}
        onSelect={(selectedPath, suggestedName) => {
          if (browserModalMode === 'exe') {
            setManualExePath(selectedPath);
            if (!manualTitle.trim() && suggestedName) {
              setManualTitle(suggestedName);
            }
          } else if (browserModalMode === 'folder') {
            void addCustomGameFolder(selectedPath);
          }
        }}
      />

      {/* Pre-Play Scan & Optimize Modal */}
      <PrePlayOptimizeModal
        game={prePlayGame}
        onClose={() => setPrePlayGame(null)}
      />
    </div>
  );
};
