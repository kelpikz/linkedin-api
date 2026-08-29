export interface LinkedInConfig {
  cookie: string;
  csrfToken: string;
  appVersion: string;
  applicationInstance?: string;
  xLiTrack?: string;
  userAgent: string;
}

const CAPTURED_APPLICATION_INSTANCE = "dMtJujm3QU+VT2XaV2MXcQ==";

function readCookieValue(cookieHeader: string, name: string): string | null {
  const item = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!item) return null;
  return item.slice(name.length + 1).replace(/^"|"$/g, "");
}

export function loadLinkedInConfig(env: Record<string, string | undefined> = Bun.env): LinkedInConfig {
  const cookie = env.LINKEDIN_COOKIE?.trim();
  if (!cookie) {
    throw new Error("LINKEDIN_COOKIE is required");
  }

  const csrfToken = env.LINKEDIN_CSRF_TOKEN?.trim() || readCookieValue(cookie, "JSESSIONID");
  if (!csrfToken) {
    throw new Error("LINKEDIN_CSRF_TOKEN is required when LINKEDIN_COOKIE has no JSESSIONID");
  }

  return {
    cookie,
    csrfToken,
    appVersion: env.LINKEDIN_APP_VERSION?.trim() || "0.2.6975",
    applicationInstance: env.LINKEDIN_APPLICATION_INSTANCE?.trim() || CAPTURED_APPLICATION_INSTANCE,
    xLiTrack: env.LINKEDIN_X_LI_TRACK?.trim() || undefined,
    userAgent:
      env.LINKEDIN_USER_AGENT?.trim() ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };
}
