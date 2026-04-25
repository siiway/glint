const POST_LOGIN_REDIRECT_KEY = "post_login_redirect";

export function sanitizePostLoginPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.startsWith("/login") || path.startsWith("/callback")) return null;
  return path;
}

export function buildLoginPath(returnTo: string): string {
  const safe = sanitizePostLoginPath(returnTo);
  if (!safe) return "/login";
  return `/login?redirect=${encodeURIComponent(safe)}`;
}

export function readRedirectFromSearch(search: string): string | null {
  const redirect = new URLSearchParams(search).get("redirect");
  return sanitizePostLoginPath(redirect);
}

export function rememberPostLoginRedirect(
  value: string | null | undefined,
): void {
  const safe = sanitizePostLoginPath(value);
  if (safe) {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, safe);
    return;
  }
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
}

export function consumePostLoginRedirect(): string | null {
  const value = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  return sanitizePostLoginPath(value);
}
