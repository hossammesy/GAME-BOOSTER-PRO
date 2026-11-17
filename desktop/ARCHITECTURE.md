# GAME BOOSTER PRO — Windows Desktop Architecture & Release Guide (Phase 7)

## 1. Framework Evaluation: Electron vs Tauri

| Criterion | Electron (Chosen) | Tauri v2 |
| :--- | :--- | :--- |
| **Stack & Toolchain Fit** | **100% TypeScript / Node.js** — shares toolchain directly with existing React + Vite frontend (`package.json`, `tsconfig`). | Requires **Rust + Cargo** toolchain and C++/MSVC build tools in addition to Node.js and .NET 8. |
| **Windows 11 RTL & Font Consistency** | Bundles deterministic Chromium build — identical rendering of `IBM Plex Sans Arabic`, Tailwind CSS v4, and tabular metrics across all Windows 11 machines. | Uses OS Microsoft Edge WebView2; rendering can vary slightly if WebView2 Runtime is missing or outdated. |
| **Frameless Splash & RTL Titlebar** | Built-in multi-window API (`splash.html` -> `mainWindow`) with native `minimize` / `maximize` / `close` IPC and `-webkit-app-region: drag`. | Supported via custom titlebar plugins, requires Rust command boilerplate for bounds persistence & splash sync. |
| **Local Agent Sidecar Supervision** | Native Node `child_process.spawn` + `AbortController` health polling + exponential backoff crash recovery + clean shutdown in `before-quit`. | Requires `tauri-plugin-shell` sidecar capability configuration + Rust process lifecycle management. |
| **NSIS Windows x64 Installer** | Mature `electron-builder` NSIS x64 target with `oneClick: false`, `perMachine: false` (`asInvoker`), custom `installer.nsh` pre-upgrade backups & data-preserving uninstall. | Built-in NSIS/WiX bundler, also good, though custom NSIS pre-upgrade data checks require manual template overrides. |
| **Installer Size Tradeoff** | Larger (~95 MB Electron + ~45 MB self-contained .NET 8 Agent). | Smaller frontend shell (~15 MB + .NET 8 Agent). |

**Decision**: **Electron** is chosen for **GAME BOOSTER PRO** because the existing repository already uses TypeScript/Node.js + `.NET 8`, has no Rust codebase, requires deterministic Arabic RTL rendering and a custom frameless splash/titlebar, and benefits directly from `electron-builder` NSIS per-user installation (`asInvoker`) plus Node.js process supervision for `GameBoosterPro.Agent.exe`.

---

## 2. Security & Privilege Model
- **Zero Default Admin Privileges**: `requestedExecutionLevel: asInvoker` in `electron-builder.yml` and `perMachine: false` (installs into `%LocalAppData%\Programs\GAME BOOSTER PRO`).
- **Scoped Elevation Consent**: When an action needs elevation, the desktop bridge prompts the user with `security:request-elevation-consent` explaining the exact change without running the whole app elevated.
- **Token Protection**: `%LocalAppData%\GameBoosterPro\agent-token.txt` is read in Electron's main process and delivered to the sandboxed renderer (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`) over `contextBridge` only. Tokens are masked in `desktop-supervisor.log`.
- **Navigation & Binary Guardrails**: Arbitrary `window.open` popups and external navigations are blocked. Only `GameBoosterPro.Agent.exe` from packaged resources is launched; no unknown remote files are downloaded or executed.

---

## 3. Data Preservation & Upgrade Safety
All persistent user files live under `%LocalAppData%\GameBoosterPro\`:
- `manual_games.json` — User-registered games
- `desktop-preferences.json` — Window bounds, theme, optional Windows startup setting
- `session-history.json` — Preserved session log (scans, analyses, optimizations, launches)
- `backups\` — System restore snapshots & automatic `upgrade_*` snapshots
- `agent-token.txt` — Loopback API authentication token

Both `installer.nsh` (`customInstall`) and `dataPreservation.ts` (`prepareUpgradeBackupIfNeeded`) back up user data before version upgrades and **never delete user data** during updates. Uninstallation explicitly asks the user whether to retain or remove `%LocalAppData%\GameBoosterPro`, defaulting to keeping user data.

---

## 4. Release Build & Installer Output Location (Windows 11)
Run on Windows 11 x64 with **Node.js 20+** and **.NET 8 SDK**:
```powershell
powershell -ExecutionPolicy Bypass -File .\desktop\scripts\prepare-windows-release.ps1
```
**Output Installer Path**:
```text
desktop/release/GAME_BOOSTER_PRO_Setup.exe
```

## 5. Windows 11 Test Matrix
Run `.\desktop\scripts\verify-windows11-release.ps1` after building on Windows 11 to verify:
1. Fresh per-user installation without UAC admin elevation (`GAME_BOOSTER_PRO_Setup.exe`).
2. Desktop & Start Menu shortcuts + optional Windows startup (`HKCU\...\Run`).
3. Splash screen transition, custom RTL Minimize/Maximize/Close controls.
4. Automatic `GameBoosterPro.Agent.exe` startup, `/api/v1/health` verification, hardware detection, and game scanning.
5. Crash recovery: force-killing `GameBoosterPro.Agent.exe` triggers automatic backoff restart and status recovery.
6. Upgrade without data loss: pre-upgrade backup created and `manual_games.json` / settings / session history preserved.
7. Clean uninstall: stops agent safely, removes shortcuts/binaries, and preserves `%LocalAppData%\GameBoosterPro` unless user opts to delete it.
