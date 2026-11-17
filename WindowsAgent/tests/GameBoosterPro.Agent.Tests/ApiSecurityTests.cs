using System.Net;
using GameBoosterPro.Agent.Configuration;
using GameBoosterPro.Agent.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace GameBoosterPro.Agent.Tests;

public sealed class ApiSecurityTests
{
    [Fact]
    public async Task AuthMiddleware_Returns401_WhenBearerTokenIsMissingOrWrong()
    {
        var options = Options.Create(new AgentOptions { AuthToken = "secret-token-123" });
        var middleware = new AuthAndOriginMiddleware(
            _ => Task.CompletedTask,
            options,
            NullLogger<AuthAndOriginMiddleware>.Instance
        );

        var missingCtx = new DefaultHttpContext();
        missingCtx.Connection.RemoteIpAddress = IPAddress.Loopback;
        await middleware.InvokeAsync(missingCtx);
        Assert.Equal(StatusCodes.Status401Unauthorized, missingCtx.Response.StatusCode);

        var wrongCtx = new DefaultHttpContext();
        wrongCtx.Connection.RemoteIpAddress = IPAddress.Loopback;
        wrongCtx.Request.Headers.Authorization = "Bearer wrong-token";
        await middleware.InvokeAsync(wrongCtx);
        Assert.Equal(StatusCodes.Status401Unauthorized, wrongCtx.Response.StatusCode);
    }

    [Fact]
    public async Task AuthMiddleware_Returns403_WhenOriginIsUnauthorizedOrIpIsNonLoopback()
    {
        var options = Options.Create(new AgentOptions
        {
            AuthToken = "secret-token-123",
            AllowedOrigins = ["http://localhost:3000"]
        });
        var middleware = new AuthAndOriginMiddleware(
            _ => Task.CompletedTask,
            options,
            NullLogger<AuthAndOriginMiddleware>.Instance
        );

        var evilOriginCtx = new DefaultHttpContext();
        evilOriginCtx.Connection.RemoteIpAddress = IPAddress.Loopback;
        evilOriginCtx.Request.Headers.Origin = "https://evil.example.com";
        evilOriginCtx.Request.Headers.Authorization = "Bearer secret-token-123";
        await middleware.InvokeAsync(evilOriginCtx);
        Assert.Equal(StatusCodes.Status403Forbidden, evilOriginCtx.Response.StatusCode);

        var remoteIpCtx = new DefaultHttpContext();
        remoteIpCtx.Connection.RemoteIpAddress = IPAddress.Parse("192.168.1.99");
        remoteIpCtx.Request.Headers.Authorization = "Bearer secret-token-123";
        await middleware.InvokeAsync(remoteIpCtx);
        Assert.Equal(StatusCodes.Status403Forbidden, remoteIpCtx.Response.StatusCode);
    }

    [Fact]
    public async Task AuthMiddleware_AllowsValidLoopbackAndToken_AndRejectsOversizedPayload()
    {
        var nextCalled = false;
        var options = Options.Create(new AgentOptions
        {
            AuthToken = "secret-token-123",
            MaxRequestBodyBytes = 1024
        });
        var middleware = new AuthAndOriginMiddleware(
            _ => { nextCalled = true; return Task.CompletedTask; },
            options,
            NullLogger<AuthAndOriginMiddleware>.Instance
        );

        var validCtx = new DefaultHttpContext();
        validCtx.Connection.RemoteIpAddress = IPAddress.Loopback;
        validCtx.Request.Headers.Origin = "http://localhost:3000";
        validCtx.Request.Headers.Authorization = "Bearer secret-token-123";
        await middleware.InvokeAsync(validCtx);
        Assert.True(nextCalled);

        var bigCtx = new DefaultHttpContext();
        bigCtx.Connection.RemoteIpAddress = IPAddress.Loopback;
        bigCtx.Request.Headers.Authorization = "Bearer secret-token-123";
        bigCtx.Request.ContentLength = 4096;
        await middleware.InvokeAsync(bigCtx);
        Assert.Equal(StatusCodes.Status413PayloadTooLarge, bigCtx.Response.StatusCode);
    }

    [Fact]
    public void SafetyPolicyGuard_ProtectsSecurityProcessesAndGameFiles()
    {
        Assert.True(SafetyPolicyGuard.IsProtectedProcess("MsMpEng"));
        Assert.True(SafetyPolicyGuard.IsProtectedProcess("WinDefend.exe"));
        Assert.False(SafetyPolicyGuard.IsSafeModificationTarget(@"C:\Games\CS2\cs2.exe"));
        Assert.False(SafetyPolicyGuard.IsSafeModificationTarget(@"C:\Games\CS2\config.cfg"));
        Assert.False(SafetyPolicyGuard.IsSafeModificationTarget(@"C:\Games\CS2\engine.ini"));
        Assert.False(SafetyPolicyGuard.IsAllowedTweakId("disable_defender"));
        Assert.True(SafetyPolicyGuard.IsAllowedTweakId("tweak_power_plan"));
    }
}
