using System.Security.Cryptography;
using System.Text.Json;
using GameBoosterPro.Agent.Configuration;
using GameBoosterPro.Agent.Models;
using GameBoosterPro.Agent.Security;
using GameBoosterPro.Agent.Services;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection(AgentOptions.SectionName));
builder.Services.PostConfigure<AgentOptions>(opts =>
{
    if (!SafetyPolicyGuard.IsLoopbackHost(opts.BindHost))
    {
        throw new InvalidOperationException($"Security policy violation: BindHost '{opts.BindHost}' must be loopback (127.0.0.1 or localhost).");
    }

    if (string.IsNullOrWhiteSpace(opts.AuthToken))
    {
        Directory.CreateDirectory(opts.DataDirectory);
        var tokenFile = Path.Combine(opts.DataDirectory, "agent-token.txt");
        if (File.Exists(tokenFile))
        {
            opts.AuthToken = File.ReadAllText(tokenFile).Trim();
        }
        else
        {
            opts.AuthToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
            File.WriteAllText(tokenFile, opts.AuthToken);
        }
    }
});

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

builder.Services.AddSingleton<IAuditLogger, AuditLogger>();
builder.Services.AddSingleton<ILocalDatabaseService, LocalDatabaseService>();
builder.Services.AddSingleton<IHardwareDetectionService, HardwareDetectionService>();
builder.Services.AddSingleton<IPerformanceMonitorService, PerformanceMonitorService>();
builder.Services.AddSingleton<IGameScannerService, GameScannerService>();
builder.Services.AddSingleton<IOptimizationService, OptimizationService>();
builder.Services.AddSingleton<ISmartGameAnalysisService, SmartGameAnalysisService>();

var agentConfig = builder.Configuration.GetSection(AgentOptions.SectionName).Get<AgentOptions>() ?? new AgentOptions();
if (!SafetyPolicyGuard.IsLoopbackHost(agentConfig.BindHost))
{
    throw new InvalidOperationException("BindHost must be 127.0.0.1 or localhost.");
}

builder.WebHost.ConfigureKestrel(kestrel =>
{
    kestrel.Limits.MaxRequestBodySize = agentConfig.MaxRequestBodyBytes;
    kestrel.Listen(System.Net.IPAddress.Loopback, agentConfig.Port);
});

var app = builder.Build();
var startedAt = DateTimeOffset.UtcNow;

var resolvedOptions = app.Services.GetRequiredService<IOptions<AgentOptions>>().Value;
app.Logger.LogInformation("GAME BOOSTER PRO Windows Agent listening on http://{Host}:{Port}", resolvedOptions.BindHost, resolvedOptions.Port);
app.Logger.LogInformation("Bearer token stored in: {TokenPath}", Path.Combine(resolvedOptions.DataDirectory, "agent-token.txt"));

app.UseMiddleware<AuthAndOriginMiddleware>();

var api = app.MapGroup("/api/v1");

api.MapGet("/health", (IHardwareDetectionService hw) =>
{
    var response = new AgentHealthResponse(
        Status: "ok",
        AgentVersion: "1.0.0-net8-win",
        Os: Environment.OSVersion.VersionString,
        Elevation: hw.IsElevatedAdministrator() ? "administrator" : "standard_user",
        UptimeSeconds: (long)(DateTimeOffset.UtcNow - startedAt).TotalSeconds,
        OriginValidated: true,
        SecurityServicesProtected: true,
        Timestamp: DateTimeOffset.UtcNow.ToString("O")
    );
    return Results.Ok(response);
});

api.MapGet("/hardware", (IHardwareDetectionService hw) =>
{
    var profile = hw.DetectHardware();
    return Results.Ok(profile);
});

api.MapGet("/games", (IGameScannerService scanner) =>
{
    return Results.Ok(scanner.GetCachedOrManualGames());
});

api.MapPost("/games/scan", async (HttpContext httpContext, IHardwareDetectionService hw, IGameScannerService scanner) =>
{
    GameScanRequest? scanRequest = null;
    if (httpContext.Request.ContentLength > 0)
    {
        try
        {
            scanRequest = await httpContext.Request.ReadFromJsonAsync<GameScanRequest>();
        }
        catch
        {
            // Ignore malformed optional body and scan default locations
        }
    }

    var hardware = hw.DetectHardware();
    var gpuLabel = hardware.Gpu.PrimaryModel ?? "غير محدد";
    var scanResult = scanner.ScanInstalledGames(gpuLabel, scanRequest?.CustomFolders);
    return Results.Ok(scanResult);
});

api.MapGet("/games/folders", (IGameScannerService scanner) =>
{
    return Results.Ok(scanner.GetCustomFolders());
});

api.MapPost("/games/folders", (CustomGameFolderRequest request, IGameScannerService scanner) =>
{
    var (success, folders, errorAr) = scanner.AddCustomFolder(request.FolderPath);
    return success
        ? Results.Ok(folders)
        : Results.BadRequest(new ApiErrorResponse("INVALID_FOLDER", errorAr ?? "مسار المجلد غير صالح.", "Custom folder validation failed."));
});

api.MapPost("/games/folders/remove", (CustomGameFolderRequest request, IGameScannerService scanner) =>
{
    var folders = scanner.RemoveCustomFolder(request.FolderPath);
    return Results.Ok(folders);
});

api.MapGet("/filesystem/browse", (string? path, IGameScannerService scanner) =>
{
    var (success, response, errorAr) = scanner.BrowseFileSystem(path);
    return success
        ? Results.Ok(response)
        : Results.BadRequest(new ApiErrorResponse("BROWSE_FAILED", errorAr ?? "تعذر استعراض المسار.", "Filesystem browse failed."));
});

api.MapPost("/games/manual", (
    ManualGameRegistrationRequest request,
    IHardwareDetectionService hw,
    IGameScannerService scanner) =>
{
    var hardware = hw.DetectHardware();
    var gpuLabel = hardware.Gpu.PrimaryModel ?? "غير محدد";
    var (success, game, errorAr) = scanner.RegisterManualGame(request, gpuLabel);
    return success
        ? Results.Ok(game)
        : Results.BadRequest(new ApiErrorResponse("INVALID_GAME_REGISTRATION", errorAr ?? "بيانات غير صالحة.", "Manual game validation failed."));
});

api.MapPut("/games/manual/{id}", (
    string id,
    ManualGameRegistrationRequest request,
    IHardwareDetectionService hw,
    IGameScannerService scanner) =>
{
    var hardware = hw.DetectHardware();
    var gpuLabel = hardware.Gpu.PrimaryModel ?? "غير محدد";
    var (success, game, errorAr) = scanner.UpdateManualGame(id, request, gpuLabel);
    return success
        ? Results.Ok(game)
        : Results.BadRequest(new ApiErrorResponse("INVALID_GAME_UPDATE", errorAr ?? "تعذر تحديث اللعبة.", "Manual game update failed."));
});

api.MapDelete("/games/manual/{id}", (string id, IGameScannerService scanner) =>
{
    var removed = scanner.RemoveManualGame(id);
    return removed ? Results.NoContent() : Results.NotFound();
});

api.MapGet("/settings", (ILocalDatabaseService db) =>
{
    return Results.Ok(db.GetAllSettings());
});

api.MapPut("/settings", (Dictionary<string, string> settings, ILocalDatabaseService db) =>
{
    db.UpsertSettings(settings);
    return Results.Ok(db.GetAllSettings());
});

api.MapPost("/games/{id}/favorite", (string id, FavoriteToggleRequest request, IGameScannerService scanner) =>
{
    scanner.SetFavorite(id, request.IsFavorite);
    return Results.Ok(new { gameId = id, isFavorite = request.IsFavorite });
});

api.MapGet("/games/{id}/analyze", (
    string id,
    IHardwareDetectionService hw,
    IGameScannerService scanner,
    IPerformanceMonitorService perf,
    ISmartGameAnalysisService smart) =>
{
    var games = scanner.GetCachedOrManualGames();
    var game = games.FirstOrDefault(g => string.Equals(g.Id, id, StringComparison.Ordinal));
    if (game is null)
    {
        return Results.NotFound(new ApiErrorResponse("GAME_NOT_FOUND", "اللعبة المطلوبة غير مسجلة أو غير مكتشفة.", $"Game '{id}' not found."));
    }

    var hardware = hw.DetectHardware();
    var snapshot = perf.CaptureSnapshot(games);
    return Results.Ok(smart.AnalyzeGame(game, hardware, snapshot));
});

api.MapPost("/games/{id}/launch", async (
    string id,
    GameLaunchRequest request,
    IGameScannerService scanner,
    ISmartGameAnalysisService smart) =>
{
    var game = scanner.GetCachedOrManualGames().FirstOrDefault(g => string.Equals(g.Id, id, StringComparison.Ordinal));
    if (game is null)
    {
        return Results.NotFound(new ApiErrorResponse("GAME_NOT_FOUND", "اللعبة المطلوبة غير موجودة في القائمة.", $"Game '{id}' not found."));
    }

    var result = await smart.SafeLaunchAsync(game, request);
    if (result.Launched)
    {
        var lastPlayed = scanner.RecordLastPlayed(game.Id);
        result = result with { LastPlayed = lastPlayed };
    }
    return Results.Ok(result);
});

api.MapGet("/performance", (IGameScannerService scanner, IPerformanceMonitorService monitor) =>
{
    var games = scanner.GetCachedOrManualGames();
    return Results.Ok(monitor.CaptureSnapshot(games));
});

api.MapPost("/optimization/analyze", (
    OptimizationAnalyzeRequest request,
    IHardwareDetectionService hw,
    IGameScannerService scanner,
    IOptimizationService opt) =>
{
    var hardware = hw.DetectHardware();
    var targetGame = string.IsNullOrWhiteSpace(request.TargetGameId)
        ? null
        : scanner.GetCachedOrManualGames().FirstOrDefault(g => g.Id == request.TargetGameId);

    return Results.Ok(opt.Analyze(hardware, targetGame));
});

api.MapPost("/optimization/preview", (
    OptimizationPreviewRequest request,
    IHardwareDetectionService hw,
    IGameScannerService scanner,
    IOptimizationService opt) =>
{
    if (request.TweakIds is null || request.TweakIds.Count == 0)
    {
        return Results.BadRequest(new ApiErrorResponse("EMPTY_TWEAK_LIST", "يرجى تحديد تعديل واحد على الأقل للمعاينة.", "tweakIds must not be empty."));
    }

    if (request.TweakIds.Any(id => !SafetyPolicyGuard.IsAllowedTweakId(id)))
    {
        return Results.BadRequest(new ApiErrorResponse("DISALLOWED_TWEAK", "يوجد تعديل غير مصرح به في الطلب.", "Requested tweak ID is not allowlisted."));
    }

    var hardware = hw.DetectHardware();
    var targetGame = string.IsNullOrWhiteSpace(request.TargetGameId)
        ? null
        : scanner.GetCachedOrManualGames().FirstOrDefault(g => g.Id == request.TargetGameId);

    return Results.Ok(opt.CreatePreview(hardware, targetGame, request.TweakIds));
});

api.MapPost("/optimization/apply", async (
    OptimizationApplyRequest request,
    IGameScannerService scanner,
    IOptimizationService opt) =>
{
    var targetGame = string.IsNullOrWhiteSpace(request.TargetGameId)
        ? null
        : scanner.GetCachedOrManualGames().FirstOrDefault(g => g.Id == request.TargetGameId);

    var (success, response, errorCode, errorAr) = await opt.ApplyAsync(request, targetGame);
    if (!success)
    {
        var statusCode = errorCode == "CONFIRMATION_REQUIRED" || errorCode == "DISALLOWED_TWEAK"
            ? StatusCodes.Status403Forbidden
            : StatusCodes.Status400BadRequest;
        return Results.Json(
            new ApiErrorResponse(errorCode ?? "APPLY_FAILED", errorAr ?? "تعذر تطبيق التعديلات.", errorCode ?? "Error"),
            statusCode: statusCode
        );
    }

    return Results.Ok(response);
});

api.MapPost("/optimization/restore", async (IOptimizationService opt) =>
{
    var (success, response, errorAr) = await opt.RestoreLatestAsync();
    return success
        ? Results.Ok(response)
        : Results.BadRequest(new ApiErrorResponse("RESTORE_FAILED", errorAr ?? "تعذرت الاستعادة.", "Restore failed."));
});

app.Run();
