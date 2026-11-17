namespace GameBoosterPro.Agent.Configuration;

public sealed class AgentOptions
{
    public const string SectionName = "Agent";

    /// <summary>
    /// Must remain a loopback address (127.0.0.1 or localhost).
    /// </summary>
    public string BindHost { get; set; } = "127.0.0.1";

    public int Port { get; set; } = 48920;

    /// <summary>
    /// Bearer token required on all /api/v1/* routes (except OPTIONS preflight).
    /// If empty in config, Program.cs generates and persists a cryptographically random token in %LocalAppData%\GameBoosterPro\agent-token.txt.
    /// </summary>
    public string AuthToken { get; set; } = string.Empty;

    /// <summary>
    /// Explicit CORS & Origin allowlist. Requests from unknown origins are rejected with 403 Forbidden.
    /// </summary>
    public List<string> AllowedOrigins { get; set; } =
    [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ];

    /// <summary>
    /// Enables /apply and /restore endpoints for safe, reversible Windows user-level settings.
    /// Set to false to operate strictly in read-only Analysis & Preview mode.
    /// </summary>
    public bool AllowSystemChanges { get; set; } = true;

    public int MaxRequestBodyBytes { get; set; } = 65536;

    public string DataDirectory { get; set; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "GameBoosterPro"
    );
}
