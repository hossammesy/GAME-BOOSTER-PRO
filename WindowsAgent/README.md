# GAME BOOSTER PRO — Windows 11 Local Agent (.NET 8)

وكيل محلي آمن مكتوب بلغة **C#** على **.NET 8 (`net8.0-windows10.0.19041.0`)** يعمل على **Windows 11** ويتواصل حصراً عبر `http://127.0.0.1:48920` مع واجهة React + TypeScript.

---

## 1. المتطلبات والتثبيت (Setup & Build)

- **نظام التشغيل**: Windows 11 (x64)
- **الحزمة البرمجية**: [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

```powershell
cd WindowsAgent
dotnet restore
dotnet build GameBoosterPro.sln -c Release
```

### تشغيل الاختبارات الآلية (xUnit)
```powershell
cd WindowsAgent
dotnet test GameBoosterPro.sln --verbosity normal
```

### تشغيل الوكيل المحلي
```powershell
cd WindowsAgent\src\GameBoosterPro.Agent
dotnet run
```
عند التشغيل الأول، يُنشئ الوكيل رمز مصادقة عشوائياً ويحفظه في:
```text
%LocalAppData%\GameBoosterPro\agent-token.txt
```
كما تُحفظ سجلات العمليات والنسخ الاحتياطية في:
- السجلات: `%LocalAppData%\GameBoosterPro\logs\agent-audit.jsonl`
- النسخ الاحتياطية: `%LocalAppData%\GameBoosterPro\backups\snap_*.json`
- الألعاب المسجلة يدوياً: `%LocalAppData%\GameBoosterPro\manual_games.json`

---

## 2. ربط الواجهة الأمامية (Frontend Integration)

1. شغّل الوكيل المحلي على Windows 11 عبر `dotnet run`.
2. إذا كانت الواجهة تعمل على رابط استضافة سحابي (مثل معاينة AI Studio أو Vite على منفذ آخر)، أضف رابط الواجهة إلى `AllowedOrigins` في `src/GameBoosterPro.Agent/appsettings.json` وأعد تشغيل الوكيل:
   ```json
   "AllowedOrigins": [
     "http://localhost:3000",
     "http://127.0.0.1:3000",
     "https://your-frontend-origin.example"
   ]
   ```
3. افتح صفحة **الإعدادات** في واجهة **GAME BOOSTER PRO**:
   - تأكد أن **Base URL** هو `http://127.0.0.1:48920`.
   - الصق الرمز من `%LocalAppData%\GameBoosterPro\agent-token.txt` داخل حقل **Bearer Token**.
   - اضغط **حفظ واختبار الاتصال الحقيقي**.
4. تظهر حالة الاتصال بوضوح: **متصل** (`Connected`)، **غير متصل** (`Disconnected`)، أو **يتطلب صلاحية ومصادقة** (`401/403 Unauthorized`).

---

## 3. توثيق واجهة برمجة التطبيقات (Localhost JSON API)

جميع الطلبات تتطلب الترويسة `Authorization: Bearer <token>` وتتحقق من `Origin` / `X-Client-Origin` وعنوان Loopback (`127.0.0.1` / `localhost`) بحد أقصى للحجم `64 KB`:

| الطريقة | المسار | الوصف |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | حالة الوكيل، نظام التشغيل، مستوى الصلاحية، وحماية خدمات الأمان |
| `GET` | `/api/v1/hardware` | قراءة حقيقية عبر WMI/Registry/Kernel32 لـ CPU وRAM وGPU والتخزين والشبكة (`null` عند عدم التوفر) |
| `GET` | `/api/v1/games` | جلب الألعاب المكتشفة أو المسجلة يدوياً |
| `POST` | `/api/v1/games/scan` | فحص Steam (`libraryfolders.vdf` + `appmanifest_*.acf`) وEpic (`.item`) وRegistry والمجلدات الشائعة واختصارات `.lnk` دون مسح القرص بالكامل مع استخراج إصدار الملف (`FileVersionInfo`) |
| `POST` | `/api/v1/games/manual` | تسجيل لعبة مثبتة يدوياً مع التحقق الأمني من مسار `.exe` |
| `DELETE` | `/api/v1/games/manual/{id}` | حذف لعبة مسجلة يدوياً |
| `GET` | `/api/v1/games/{id}/analyze` | محرك التحليل الذكي: تقييم التوافق (5 مستويات أو Unknown)، فحص العتاد الفعلي، التمييز بين التوصيات الموثّقة والتقديرية لإعدادات الرسوميات الـ 8، وتقييم الوضع السحابي |
| `POST` | `/api/v1/games/{id}/launch` | التشغيل الآمن المباشر عبر Windows بدون حقن برمجي أو تجاوز DRM/Anti-Cheat |
| `GET` | `/api/v1/performance` | قراءة عدادات الأداء المتاحة والعمليات النشطة (`null` للمقاييس غير المتوفرة مثل الحرارة أو FPS) |
| `POST` | `/api/v1/optimization/analyze` | تحليل العتاد وتقديم توصيات تتضمن الفائدة المتوقعة والمخاطرة وإمكانية الاستعادة |
| `POST` | `/api/v1/optimization/preview` | توليد معاينة التغييرات (`previewId` + `backupSnapshotId`) قبل أي تعديل |
| `POST` | `/api/v1/optimization/apply` | تطبيق التعديلات المسموحة فقط بعد `explicitUserConfirmation: true` وحفظ نسخة احتياطية |
| `POST` | `/api/v1/optimization/restore` | استعادة الإعدادات السابقة من آخر نسخة احتياطية |

---

## 4. ضمانات الأمان (Security Invariants)
- **عدم تعديل ملفات الألعاب**: يمنع الوكيل تعديل أي ملف بامتداد `.exe`, `.dll`, `.cfg`, `.ini`, `.pak`, `.vpk`, `.rpf` أو أي ملفات موارد.
- **حماية الأمان**: خدمات `Windows Defender` (`MsMpEng`, `WinDefend`) وجدار الحماية وخدمات النظام الأساسية محمية ولا تُوقف أبداً.
- **عدم تنفيذ أوامر عشوائية**: يقبل الوكيل فقط معرّفات التحسين الأربعة المعتمدة (`tweak_power_plan`, `tweak_gpu_pref`, `tweak_game_mode`, `tweak_bg_apps`).
- **وضع المعاينة فقط**: يمكن ضبط `"AllowSystemChanges": false` في `appsettings.json` لتعطيل `/apply` والإبقاء على التحليل والمعاينة فقط.
