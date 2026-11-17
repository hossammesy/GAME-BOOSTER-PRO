using System.Text.Json;
using GameBoosterPro.Agent.Configuration;
using Microsoft.Extensions.Options;

namespace GameBoosterPro.Agent.Services;

public interface IAuditLogger
{
    Task LogOperationAsync(string operation, string outcome, object? details = null);
}

public sealed class AuditLogger : IAuditLogger
{
    private readonly string _logFilePath;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public AuditLogger(IOptions<AgentOptions> options)
    {
        var logsDir = Path.Combine(options.Value.DataDirectory, "logs");
        Directory.CreateDirectory(logsDir);
        _logFilePath = Path.Combine(logsDir, "agent-audit.jsonl");
    }

    public async Task LogOperationAsync(string operation, string outcome, object? details = null)
    {
        var entry = new
        {
            timestamp = DateTimeOffset.UtcNow.ToString("O"),
            operation,
            outcome,
            details
        };

        var line = JsonSerializer.Serialize(entry) + Environment.NewLine;

        await _gate.WaitAsync();
        try
        {
            await File.AppendAllTextAsync(_logFilePath, line);
        }
        finally
        {
            _gate.Release();
        }
    }
}
