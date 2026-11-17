; GAME BOOSTER PRO — Custom NSIS Installer & Upgrade Protection Hooks
; Security & Data Preservation Policy:
; 1. Installs per-user (asInvoker) without forcing admin elevation.
; 2. Backs up %LocalAppData%\GameBoosterPro before upgrade overwrites binaries.
; 3. Preserves game library (manual_games.json), settings, session history, and backups across upgrades.

!macro customInit
  ; Ensure no leftover GameBoosterPro.Agent.exe locks files during upgrade/reinstall
  nsExec::ExecToLog 'taskkill /IM "GameBoosterPro.Agent.exe" /F /T'
  Pop $0
!macroend

!macro customInstall
  ; Create pre-upgrade backup snapshot if user data already exists in %LocalAppData%\GameBoosterPro
  IfFileExists "$LOCALAPPDATA\GameBoosterPro\*.*" 0 +9
    CreateDirectory "$LOCALAPPDATA\GameBoosterPro\backups\installer_upgrade_backup"
    IfFileExists "$LOCALAPPDATA\GameBoosterPro\gamebooster.db" 0 +2
      CopyFiles /SILENT "$LOCALAPPDATA\GameBoosterPro\gamebooster.db" "$LOCALAPPDATA\GameBoosterPro\backups\installer_upgrade_backup\gamebooster.db"
    IfFileExists "$LOCALAPPDATA\GameBoosterPro\manual_games.json" 0 +2
      CopyFiles /SILENT "$LOCALAPPDATA\GameBoosterPro\manual_games.json" "$LOCALAPPDATA\GameBoosterPro\backups\installer_upgrade_backup\manual_games.json"
    IfFileExists "$LOCALAPPDATA\GameBoosterPro\desktop-preferences.json" 0 +2
      CopyFiles /SILENT "$LOCALAPPDATA\GameBoosterPro\desktop-preferences.json" "$LOCALAPPDATA\GameBoosterPro\backups\installer_upgrade_backup\desktop-preferences.json"
    IfFileExists "$LOCALAPPDATA\GameBoosterPro\session-history.json" 0 +2
      CopyFiles /SILENT "$LOCALAPPDATA\GameBoosterPro\session-history.json" "$LOCALAPPDATA\GameBoosterPro\backups\installer_upgrade_backup\session-history.json"

  ; Record install path in HKCU (per-user, no UAC needed)
  WriteRegStr HKCU "Software\GameBoosterPro" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\GameBoosterPro" "DataDir" "$LOCALAPPDATA\GameBoosterPro"
!macroend

!macro customUnInstall
  ; Gracefully stop any running agent before removing program binaries
  nsExec::ExecToLog 'taskkill /IM "GameBoosterPro.Agent.exe" /F /T'
  Pop $0

  ; Remove optional Windows startup Run entry if user enabled it inside app settings
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "GameBoosterProDesktop"
  DeleteRegKey HKCU "Software\GameBoosterPro"

  ; IMPORTANT: Preserve user data (%LocalAppData%\GameBoosterPro) unless user explicitly confirms deletion
  MessageBox MB_YESNO|MB_ICONQUESTION "هل تريد الاحتفاظ بمكتبة ألعابك وإعداداتك وسجل الجلسات والنسخ الاحتياطية في %LocalAppData%\GameBoosterPro؟$\r$\n$\r$\nاختر (نعم / Yes) للاحتفاظ ببياناتك، أو (لا / No) لحذف جميع البيانات المحلية نهائياً." IDYES keepUserData
  RMDir /r "$LOCALAPPDATA\GameBoosterPro"
  keepUserData:
!macroend
