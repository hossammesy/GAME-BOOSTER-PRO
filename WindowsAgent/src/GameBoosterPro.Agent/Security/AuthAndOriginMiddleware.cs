using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GameBoosterPro.Agent.Configuration;
using GameBoosterPro.Agent.Models;
using Microsoft.Extensions.Options;

namespace GameBoosterPro.Agent.Security;

public sealed class AuthAndOriginMiddleware
{
    private readonly RequestDelegate _next;
    private readonly AgentOptions _options;
    private readonly ILogger<AuthAndOriginMiddleware> _logger;

    public AuthAndOriginMiddleware(
        RequestDelegate next,
        IOptions<AgentOptions> options,
        ILogger<AuthAndOriginMiddleware> logger)
    {
        _next = next;
        _options = options.Value;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // 1. Validate loopback remote IP when available
        var remoteIp = context.Connection.RemoteIpAddress;
        if (remoteIp is not null && !System.Net.IPAddress.IsLoopback(remoteIp))
        {
            _logger.LogWarning("Rejected non-loopback request from {RemoteIp}", remoteIp);
            await WriteJsonError(context, StatusCodes.Status403Forbidden, "NON_LOOPBACK_FORBIDDEN",
                "يُسمح بالاتصال فقط من الجهاز المحلي (Loopback).", "Non-loopback client address rejected.");
            return;
        }

        // 2. Origin / X-Client-Origin validation
        var origin = context.Request.Headers.Origin.FirstOrDefault()
                     ?? context.Request.Headers["X-Client-Origin"].FirstOrDefault();

        if (!string.IsNullOrWhiteSpace(origin))
        {
            if (!IsOriginAllowed(origin))
            {
                _logger.LogWarning("Rejected unauthorized origin: {Origin}", origin);
                await WriteJsonError(context, StatusCodes.Status403Forbidden, "ORIGIN_NOT_ALLOWED",
                    "تم رفض الطلب: مصدر الواجهة (Origin) غير مدرج في قائمة السماح.", $"Origin '{origin}' is not allowed.");
                return;
            }

            context.Response.Headers["Access-Control-Allow-Origin"] = origin;
            context.Response.Headers["Vary"] = "Origin";
            context.Response.Headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, X-Client-Origin";
            context.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
        }

        if (HttpMethods.IsOptions(context.Request.Method))
        {
            context.Response.StatusCode = StatusCodes.Status204NoContent;
            return;
        }

        // 3. Request size limit check
        if (context.Request.ContentLength.HasValue && context.Request.ContentLength.Value > _options.MaxRequestBodyBytes)
        {
            await WriteJsonError(context, StatusCodes.Status413PayloadTooLarge, "PAYLOAD_TOO_LARGE",
                "حجم الطلب يتجاوز الحد الأقصى المسموح به.", $"Max payload size is {_options.MaxRequestBodyBytes} bytes.");
            return;
        }

        // 4. Constant-time Bearer token check
        if (!string.IsNullOrWhiteSpace(_options.AuthToken))
        {
            var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
            if (string.IsNullOrWhiteSpace(authHeader) ||
                !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                await WriteJsonError(context, StatusCodes.Status401Unauthorized, "MISSING_BEARER_TOKEN",
                    "مطلوب رمز مصادقة Bearer صالح للوصول إلى الوكيل المحلي.", "Missing Authorization: Bearer header.");
                return;
            }

            var providedToken = authHeader["Bearer ".Length..].Trim();
            if (!FixedTimeEquals(providedToken, _options.AuthToken))
            {
                _logger.LogWarning("Rejected request with invalid Bearer token on {Path}", context.Request.Path);
                await WriteJsonError(context, StatusCodes.Status401Unauthorized, "INVALID_BEARER_TOKEN",
                    "رمز المصادقة المحلي غير صحيح.", "Invalid Bearer token.");
                return;
            }
        }

        await _next(context);
    }

    public bool IsOriginAllowed(string origin)
    {
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
        {
            return false;
        }

        var normalized = $"{uri.Scheme}://{uri.Authority}".TrimEnd('/');
        if (_options.AllowedOrigins.Any(a => string.Equals(a.TrimEnd('/'), normalized, StringComparison.OrdinalIgnoreCase)))
        {
            return true;
        }

        // Always allow local loopback HTTP/HTTPS origins on any port for local Vite dev
        if ((uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps) &&
            SafetyPolicyGuard.IsLoopbackHost(uri.Host))
        {
            return true;
        }

        return false;
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        var bytesA = Encoding.UTF8.GetBytes(a);
        var bytesB = Encoding.UTF8.GetBytes(b);
        return CryptographicOperations.FixedTimeEquals(bytesA, bytesB);
    }

    private static Task WriteJsonError(HttpContext context, int statusCode, string code, string messageAr, string detail)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        var payload = new ApiErrorResponse(code, messageAr, detail);
        return context.Response.WriteAsync(JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        }));
    }
}
