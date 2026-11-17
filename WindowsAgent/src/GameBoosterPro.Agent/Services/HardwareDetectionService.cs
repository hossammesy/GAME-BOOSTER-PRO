using System.Management;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Security.Principal;
using GameBoosterPro.Agent.Models;
using Microsoft.Win32;

namespace GameBoosterPro.Agent.Services;

public interface IHardwareDetectionService
{
    HardwareProfile DetectHardware();
    bool IsElevatedAdministrator();
}

[SupportedOSPlatform("windows")]
public sealed class HardwareDetectionService : IHardwareDetectionService
{
    private readonly ILogger<HardwareDetectionService> _logger;

    public HardwareDetectionService(ILogger<HardwareDetectionService> logger)
    {
        _logger = logger;
    }

    public bool IsElevatedAdministrator()
    {
        try
        {
            using var identity = WindowsIdentity.GetCurrent();
            var principal = new WindowsPrincipal(identity);
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch
        {
            return false;
        }
    }

    public HardwareProfile DetectHardware()
    {
        var cpu = DetectCpu();
        var memory = DetectMemory();
        var gpu = DetectGpu();
        var storage = DetectStorage();
        var network = DetectNetwork();
        var (osName, osBuild) = DetectWindowsVersion();
        var powerSource = DetectPowerSource();
        var activePowerPlan = DetectActivePowerPlanName();
        var readiness = EvaluateGamingReadiness(cpu, memory, gpu);

        return new HardwareProfile(
            DeviceName: Environment.MachineName,
            OsName: osName,
            OsBuild: osBuild,
            PowerSource: powerSource,
            ActivePowerPlan: activePowerPlan,
            Cpu: cpu,
            Memory: memory,
            Gpu: gpu,
            Storage: storage,
            Network: network,
            GamingReadiness: readiness
        );
    }

    private CpuHardwareInfo DetectCpu()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed FROM Win32_Processor"
            );
            foreach (ManagementObject obj in searcher.Get())
            {
                var name = obj["Name"]?.ToString()?.Trim();
                int? cores = int.TryParse(obj["NumberOfCores"]?.ToString(), out var c) ? c : null;
                int? threads = int.TryParse(obj["NumberOfLogicalProcessors"]?.ToString(), out var t)
                    ? t
                    : Environment.ProcessorCount;
                double? maxClock = int.TryParse(obj["MaxClockSpeed"]?.ToString(), out var mhz)
                    ? Math.Round(mhz / 1000.0, 2)
                    : null;

                return new CpuHardwareInfo(
                    Model: string.IsNullOrWhiteSpace(name) ? null : name,
                    Cores: cores,
                    Threads: threads,
                    BaseClockGhz: maxClock,
                    BoostClockGhz: null, // WMI does not reliably expose turbo boost ceiling
                    Status: string.IsNullOrWhiteSpace(name) ? "partial" : "detected"
                );
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_Processor");
        }

        return new CpuHardwareInfo(
            Model: null,
            Cores: null,
            Threads: Environment.ProcessorCount,
            BaseClockGhz: null,
            BoostClockGhz: null,
            Status: "unavailable"
        );
    }

    private MemoryHardwareInfo DetectMemory()
    {
        double? totalGb = null;
        double? availableGb = null;
        int? speedMhz = null;
        string? channelMode = null;

        try
        {
            var memStatus = new MEMORYSTATUSEX();
            if (GlobalMemoryStatusEx(memStatus))
            {
                totalGb = Math.Round(memStatus.ullTotalPhys / (1024.0 * 1024.0 * 1024.0), 1);
                availableGb = Math.Round(memStatus.ullAvailPhys / (1024.0 * 1024.0 * 1024.0), 1);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "GlobalMemoryStatusEx failed");
        }

        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT ConfiguredClockSpeed, Speed FROM Win32_PhysicalMemory"
            );
            var dimmCount = 0;
            foreach (ManagementObject obj in searcher.Get())
            {
                dimmCount++;
                if (speedMhz is null)
                {
                    if (int.TryParse(obj["ConfiguredClockSpeed"]?.ToString(), out var cfgSpeed) && cfgSpeed > 0)
                    {
                        speedMhz = cfgSpeed;
                    }
                    else if (int.TryParse(obj["Speed"]?.ToString(), out var spd) && spd > 0)
                    {
                        speedMhz = spd;
                    }
                }
            }

            if (dimmCount >= 2) channelMode = "Dual Channel";
            else if (dimmCount == 1) channelMode = "Single Channel";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_PhysicalMemory");
        }

        var status = totalGb.HasValue ? "detected" : "unavailable";
        return new MemoryHardwareInfo(totalGb, availableGb, speedMhz, channelMode, status);
    }

    private GpuHardwareInfo DetectGpu()
    {
        string? discreteGpu = null;
        string? integratedGpu = null;
        int? discreteVramMb = null;
        string? driverVersion = null;

        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT Name, AdapterRAM, DriverVersion, PNPDeviceID FROM Win32_VideoController"
            );
            foreach (ManagementObject obj in searcher.Get())
            {
                var name = obj["Name"]?.ToString()?.Trim();
                if (string.IsNullOrWhiteSpace(name)) continue;

                var pnp = obj["PNPDeviceID"]?.ToString() ?? string.Empty;
                var driver = obj["DriverVersion"]?.ToString()?.Trim();
                int? vramMb = null;

                // Try registry qwMemorySize first for accuracy (>4GB or exact 2GB), fallback to WMI AdapterRAM
                vramMb = TryReadExactAdapterVramMb(name) ??
                         (long.TryParse(obj["AdapterRAM"]?.ToString(), out var ramBytes) && ramBytes > 0
                             ? (int)Math.Round(ramBytes / (1024.0 * 1024.0))
                             : null);

                var isDiscrete = name.Contains("NVIDIA", StringComparison.OrdinalIgnoreCase)
                                 || name.Contains("GeForce", StringComparison.OrdinalIgnoreCase)
                                 || name.Contains("Radeon", StringComparison.OrdinalIgnoreCase)
                                 || pnp.Contains("VEN_10DE", StringComparison.OrdinalIgnoreCase);

                if (isDiscrete && discreteGpu is null)
                {
                    discreteGpu = name;
                    discreteVramMb = vramMb;
                    driverVersion = driver;
                }
                else if (integratedGpu is null)
                {
                    integratedGpu = name;
                    if (discreteGpu is null)
                    {
                        driverVersion ??= driver;
                        discreteVramMb ??= vramMb;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_VideoController");
        }

        var primary = discreteGpu ?? integratedGpu;
        var status = primary is not null ? "detected" : "unavailable";

        return new GpuHardwareInfo(
            PrimaryModel: primary,
            IntegratedModel: integratedGpu,
            VramTotalMb: discreteVramMb,
            DriverVersion: driverVersion,
            Status: status
        );
    }

    private static int? TryReadExactAdapterVramMb(string gpuName)
    {
        try
        {
            const string displayClassKey = @"SYSTEM\ControlSet001\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";
            using var baseKey = Registry.LocalMachine.OpenSubKey(displayClassKey);
            if (baseKey is null) return null;

            foreach (var subName in baseKey.GetSubKeyNames())
            {
                if (!int.TryParse(subName, out _)) continue;
                using var subKey = baseKey.OpenSubKey(subName);
                var desc = subKey?.GetValue("DriverDesc")?.ToString();
                if (!string.Equals(desc, gpuName, StringComparison.OrdinalIgnoreCase)) continue;

                var qwMem = subKey?.GetValue("HardwareInformation.qwMemorySize");
                if (qwMem is long l && l > 0)
                    return (int)Math.Round(l / (1024.0 * 1024.0));
                if (qwMem is byte[] bytes && bytes.Length == 8)
                {
                    var val = BitConverter.ToInt64(bytes, 0);
                    if (val > 0) return (int)Math.Round(val / (1024.0 * 1024.0));
                }
            }
        }
        catch
        {
            // Ignore registry permission issues and fall back to WMI
        }
        return null;
    }

    private StorageHardwareInfo DetectStorage()
    {
        var drives = new List<StorageDriveInfo>();
        double totalFree = 0;
        double totalSize = 0;

        foreach (var drive in DriveInfo.GetDrives())
        {
            if (drive.DriveType != DriveType.Fixed || !drive.IsReady) continue;

            var freeGb = Math.Round(drive.AvailableFreeSpace / (1024.0 * 1024.0 * 1024.0), 1);
            var sizeGb = Math.Round(drive.TotalSize / (1024.0 * 1024.0 * 1024.0), 1);
            totalFree += freeGb;
            totalSize += sizeGb;

            drives.Add(new StorageDriveInfo(
                Name: drive.Name,
                DriveFormat: drive.DriveFormat,
                Type: "Fixed Drive",
                FreeSpaceGb: freeGb,
                TotalSpaceGb: sizeGb
            ));
        }

        return new StorageHardwareInfo(
            Type: drives.Count > 0 ? "Fixed Local Drives" : "unavailable",
            FreeSpaceGb: Math.Round(totalFree, 1),
            TotalSpaceGb: Math.Round(totalSize, 1),
            Drives: drives
        );
    }

    private static NetworkHardwareInfo DetectNetwork()
    {
        try
        {
            var activeNic = NetworkInterface.GetAllNetworkInterfaces()
                .FirstOrDefault(n =>
                    n.OperationalStatus == OperationalStatus.Up &&
                    n.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                    n.NetworkInterfaceType != NetworkInterfaceType.Tunnel);

            if (activeNic is not null)
            {
                var adapterLabel = activeNic.NetworkInterfaceType == NetworkInterfaceType.Wireless80211
                    ? "Wi-Fi"
                    : activeNic.NetworkInterfaceType == NetworkInterfaceType.Ethernet
                    ? "Ethernet"
                    : activeNic.NetworkInterfaceType.ToString();

                return new NetworkHardwareInfo(
                    AdapterType: adapterLabel,
                    EstimatedBandwidthMbps: null, // Browser/agent should not guess ISP throughput without a real test
                    LatencyMs: null,
                    Status: "adapter_detected"
                );
            }
        }
        catch
        {
            // Ignore NIC enumeration errors
        }

        return new NetworkHardwareInfo("unavailable", null, null, "unavailable");
    }

    private static (string OsName, string OsBuild) DetectWindowsVersion()
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
            var productName = key?.GetValue("ProductName")?.ToString() ?? "Windows";
            var displayVersion = key?.GetValue("DisplayVersion")?.ToString() ?? "";
            var currentBuild = key?.GetValue("CurrentBuild")?.ToString() ?? Environment.OSVersion.Version.Build.ToString();

            if (int.TryParse(currentBuild, out var buildNum) && buildNum >= 22000 && productName.Contains("Windows 10"))
            {
                productName = productName.Replace("Windows 10", "Windows 11");
            }

            var buildLabel = string.IsNullOrWhiteSpace(displayVersion)
                ? $"Build {currentBuild}"
                : $"{displayVersion} · Build {currentBuild}";

            return (productName, buildLabel);
        }
        catch
        {
            return (Environment.OSVersion.VersionString, Environment.OSVersion.Version.Build.ToString());
        }
    }

    private static string DetectPowerSource()
    {
        try
        {
            if (GetSystemPowerStatus(out var status))
            {
                return status.ACLineStatus == 1 ? "AC" : "Battery";
            }
        }
        catch
        {
            // ignore
        }
        return "Unknown";
    }

    private static string DetectActivePowerPlanName()
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(
                @"SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes"
            );
            var activeGuid = key?.GetValue("ActivePowerScheme")?.ToString();
            if (string.IsNullOrWhiteSpace(activeGuid)) return "غير متاح";

            return activeGuid.ToLowerInvariant() switch
            {
                "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c" => "أداء عالٍ (High Performance)",
                "381b4222-f694-41f0-9685-ff5bb260df2e" => "متوازن (Balanced)",
                "a1841308-3541-4fab-bc81-f71556f20b4a" => "موفر للطاقة (Power Saver)",
                _ => $"مخصص ({activeGuid})"
            };
        }
        catch
        {
            return "غير متاح";
        }
    }

    public static GamingReadinessInfo EvaluateGamingReadiness(
        CpuHardwareInfo cpu,
        MemoryHardwareInfo memory,
        GpuHardwareInfo gpu)
    {
        var vram = gpu.VramTotalMb ?? 0;
        var ram = memory.TotalGb ?? 0;
        var isVramLimited = vram > 0 && vram <= 2048;

        if (vram == 0 && gpu.PrimaryModel is null)
        {
            return new GamingReadinessInfo(
                Tier: "cloud_recommended",
                SummaryAr: "لم يتم التعرف على بطاقة رسوميات مخصصة؛ قد تقتصر الألعاب المحلية على العناوين الخفيفة جداً.",
                BottleneckNoteAr: "تعذر التحقق من سعة VRAM عبر مستشعرات النظام.",
                VramLimitWarning: true
            );
        }

        if (isVramLimited)
        {
            return new GamingReadinessInfo(
                Tier: "esports_and_light",
                SummaryAr: $"الجهاز ({gpu.PrimaryModel} · {ram}GB RAM) مناسب للألعاب التنافسية والخفيفة بدقة 720p أو 900p دون ضمانات لمعدل الإطارات.",
                BottleneckNoteAr: $"سعة VRAM ({vram} MB) تمثل الحد الأساسي أمام الألعاب الحديثة الثقيلة.",
                VramLimitWarning: true
            );
        }

        return new GamingReadinessInfo(
            Tier: "medium_720p",
            SummaryAr: $"تم رصد {gpu.PrimaryModel} بسعة {vram} MB VRAM وذاكرة {ram} GB RAM.",
            BottleneckNoteAr: "يعتمد الأداء الفعلي على التبريد وخطط الطاقة ومتطلبات كل لعبة.",
            VramLimitWarning: false
        );
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private sealed class MEMORYSTATUSEX
    {
        public uint dwLength = (uint)Marshal.SizeOf<MEMORYSTATUSEX>();
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx([In, Out] MEMORYSTATUSEX lpBuffer);

    [StructLayout(LayoutKind.Sequential)]
    private struct SYSTEM_POWER_STATUS
    {
        public byte ACLineStatus;
        public byte BatteryFlag;
        public byte BatteryLifePercent;
        public byte SystemStatusFlag;
        public int BatteryLifeTime;
        public int BatteryFullLifeTime;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetSystemPowerStatus(out SYSTEM_POWER_STATUS lpSystemPowerStatus);
}
