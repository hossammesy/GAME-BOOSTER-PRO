export function isLoopbackUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
    );
  } catch {
    return false;
  }
}

export function maskBearerToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 8) return '********';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function isAllowedRendererNavigation(rawUrl: string, allowDevLocalhost = false): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'file:') {
      return true;
    }
    if (
      allowDevLocalhost &&
      parsed.protocol === 'http:' &&
      (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') &&
      parsed.port === '3000'
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isSafeAgentBinaryPath(binaryPath: string): boolean {
  if (!binaryPath || /[;&|`$<>]/.test(binaryPath)) {
    return false;
  }
  const lower = binaryPath.toLowerCase();
  return lower.endsWith('gameboosterpro.agent.exe') || lower.endsWith('gameboosterpro.agent.dll');
}
