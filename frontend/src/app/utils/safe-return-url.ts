const ALLOWED_RETURN_PATH = '/appointment';

export function sanitizeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('://')) {
    return null;
  }

  const path = decoded.split('?')[0];
  if (path !== ALLOWED_RETURN_PATH) {
    return null;
  }

  return decoded;
}

export function returnUrlQueryParams(returnUrl: string | null): Record<string, string> {
  return returnUrl ? { returnUrl } : {};
}
