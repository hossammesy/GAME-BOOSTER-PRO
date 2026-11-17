using System.Diagnostics;
using System.Management;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using GameBoosterPro.Agent.Models;
using GameBoosterPro.Agent.Security;

namespace GameBoosterPro.Agent.Services;

public interface IPerformanceMonitorService
{
    PerformanceSnapshotResponse CaptureSnapshot(IReadOnlyList<InstalledGame> knownGames);
}

[SupportedOSPlatform("windows")]
public sealed class PerformanceMonitorService : IPerformanceMonitorService, IDisposable
{
    private readonly PerformanceCounter? _cpuCounter;
    private readonly ILogger<PerformanceMonitorService> _logger;

    public PerformanceMonitorService(ILogger<PerformanceMonitorService> logger)
    {
        _logger = logger;
        try
        {
            _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total", readOnly: true);
            _ = _cpuCounter.NextValue(); // Warm up counter
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "CPU PerformanceCounter unavailable; CPU usage will report null if unreadable.");
            _cpuCounter = null;
        }
    }

    public PerformanceSnapshotResponse CaptureSnapshot(IReadOnlyList<InstalledGame> knownGames)
    {
        double? cpuUsage = null;
        if (_cpuCounter is not null)
        {
            try
            {
                cpuUsage = Math.Round(_cpuCounter.NextValue(), 1);
            }
            catch
            {
                cpuUsage = null;
            }
        }

        var (ramUsedGb, ramTotalGb) = ReadMemoryUsage();
        var (gpuUsagePercent, vramUsedMb, vramTotalMb) = TryReadGpuCounters();

        // Standard Windows user-mode APIs do not expose reliable CPU/GPU thermal diodes or DXGI FPS hooks
        // without vendor kernel drivers (e.g., NVAPI / WinRing0) or an injected overlay.
        // Per safety & honesty policy: report unavailable metrics as null.
        double? cpuTemp = null;
        double? gpuTemp = null;
        int? fps = null;
        double? frameTimeMs = null;

        var knownGameExeNames = new HashSet<string>(
            knownGames.Select(g => Path.GetFileNameWithoutExtension(g.ExecutableName)),
            StringComparer.OrdinalIgnoreCase
        );

        var topProcesses = SampleTopProcesses(knownGameExeNames, out var activeGameProcess);

        var sample = new PerformanceSample(
            Timestamp: DateTimeOffset.Now.ToString("HH:mm:ss"),
            CpuUsagePercent: cpuUsage,
            CpuClockGhz: null,
            CpuTempCelsius: cpuTemp,
            RamUsedGb: ramUsedGb,
            RamTotalGb: ramTotalGb,
            GpuUsagePercent: gpuUsagePercent,
            VramUsedMb: vramUsedMb,
            VramTotalMb: vramTotalMb,
            GpuTempCelsius: gpuTemp,
            ActiveGameProcess: activeGameProcess,
            Fps: fps,
            FrameTimeMs: frameTimeMs
        );

        var sensors = new SensorsAvailability(
            CpuUsage: cpuUsage.HasValue,
            RamUsage: ramUsedGb.HasValue && ramTotalGb.HasValue,
            GpuUsage: gpuUsagePercent.HasValue,
            VramUsage: vramUsedMb.HasValue && vramTotalMb.HasValue,
            CpuTemp: false,
            GpuTemp: false,
            FpsHook: false
        );

        return new PerformanceSnapshotResponse(sample, sensors, topProcesses);
    }

    private static (double? UsedGb, double? TotalGb) ReadMemoryUsage()
    {
        try
        {
            var status = new MEMORYSTATUSEX();
            if (GlobalMemoryStatusEx(status))
            {
                var total = Math.Round(status.ullTotalPhys / (1024.0 * 1024.0 * 1024.0), 1);
                var avail = status.ullAvailPhys / (1024.0 * 1024.0 * 1024.0);
                var used = Math.Round(total - avail, 1);
                return (used, total);
            }
        }
        catch
        {
            // ignore
        }
        return (null, null);
    }

    private (double? GpuUsagePercent, int? VramUsedMb, int? VramTotalMb) TryReadGpuCounters()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT DedicatedUsage, DedicatedLimit FROM Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory"
            );
            foreach (ManagementObject obj in searcher.Get())
            {
                if (ulong.TryParse(obj["DedicatedUsage"]?.ToString(), out var usedBytes) &&
                    ulong.TryParse(obj["DedicatedLimit"]?.ToString(), out var limitBytes) &&
                    limitBytes > 0)
                {
                    var usedMb = (int)Math.Round(usedBytes / (1024.0 * 1024.0));
                    var totalMb = (int)Math.Round(limitBytes / (1024.0 * 1024.0));
                    return (null, usedMb, totalMb);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "GPU performance WMI counters unavailable");
        }

        return (null, null, null);
    }

    private static IReadOnlyList<ProcessMetric> SampleTopProcesses(
        HashSet<string> knownGameExeNames,
        out string? activeGameProcess)
    {
        activeGameProcess = null;
        var results = new List<ProcessMetric>();

        try
        {
            var processes = Process.GetProcesses()
                .OrderByDescending(p =>
                {
                    try { return p.WorkingSet64; }
                    catch { return 0L; }
                })
                .Take(15);

            foreach (var proc in processes)
            {
                try
                {
                    var name = proc.ProcessName;
                    var ramMb = Math.Round(proc.WorkingSet64 / (1024.0 * 1024.0), 0);
                    var isProtected = SafetyPolicyGuard.IsProtectedProcess(name);
                    var isGame = knownGameExeNames.Contains(name);

                    if (isGame && activeGameProcess is null)
                    {
                        activeGameProcess = $"{name}.exe";
                    }

                    var category = isGame
                        ? "game"
                        : isProtected
                        ? "security_protected"
                        : IsCommonBackgroundApp(name)
                        ? "background_safe_to_pause"
                        : "system";

                    results.Add(new ProcessMetric(
                        Pid: proc.Id,
                        Name: $"{name}.exe",
                        Category: category,
                        CpuPercent: 0, // Instantaneous per-process CPU % requires two samples; avoid fabricating
                        RamMb: ramMb,
                        CanSafelyPause: category == "background_safe_to_pause"
                    ));
                }
                catch
                {
                    // Access denied on protected system processes is normal on Windows
                }
                finally
                {
                    proc.Dispose();
                }
            }
        }
        catch
        {
            // ignore enumeration errors
        }

        return results;
    }

    private static bool IsCommonBackgroundApp(string procName) =>
        procName.Equals("chrome", StringComparison.OrdinalIgnoreCase)
        || procName.Equals("msedge", StringComparison.OrdinalIgnoreCase)
        || procName.Equals("firefox", StringComparison.OrdinalIgnoreCase)
        || procName.Equals("Discord", StringComparison.OrdinalIgnoreCase)
        || procName.Equals("OneDrive", StringComparison.OrdinalIgnoreCase)
        || procName.Equals("Spotify", StringComparison.OrdinalIgnoreCase);

    public void Dispose()
    {
        _cpuCounter?.Dispose();
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
}
