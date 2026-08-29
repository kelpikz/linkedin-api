import type { LinkedInConfig } from "./config.ts";
import { buildProfileBody, buildTypeaheadBody, createParentSpanId, TYPEAHEAD_ACTION } from "./requests.ts";
import { parseProfile, parseSearchSuggestions } from "./rsc.ts";
import type { LinkedInProfile, SearchSuggestion } from "./types.ts";

interface BrowserRequestContext {
  trackingId: string;
  pageForestId: string;
  traceSpanId: string;
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function randomBase64(length: number): string {
  return Buffer.from(randomBytes(length)).toString("base64");
}

function randomHex(length: number): string {
  return Buffer.from(randomBytes(length)).toString("hex");
}

function createBrowserRequestContext(): BrowserRequestContext {
  return {
    trackingId: randomBase64(16),
    pageForestId: randomHex(16),
    traceSpanId: randomHex(8),
  };
}

export class LinkedInRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class LinkedInClient {
  constructor(private readonly config: LinkedInConfig) {}

  private headers(pageKey: string, referer: string, extra: Record<string, string> = {}): Headers {
    const context = createBrowserRequestContext();
    const xLiTrack = JSON.stringify({
      clientVersion: this.config.appVersion,
      mpVersion: this.config.appVersion,
      osName: "web",
      timezoneOffset: 5.5,
      timezone: "Asia/Calcutta",
      deviceFormFactor: "DESKTOP",
      mpName: "web",
      displayDensity: 1.25,
      displayWidth: 1600,
      displayHeight: 1000,
    });
    const headers = new Headers({
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json",
      cookie: this.config.cookie,
      "csrf-token": this.config.csrfToken,
      origin: "https://www.linkedin.com",
      referer,
      "user-agent": this.config.userAgent,
      "x-li-anchor-page-key": pageKey,
      "x-li-application-version": this.config.appVersion,
      "x-li-page-instance": `urn:li:page:${pageKey};${context.trackingId}`,
      "x-li-page-instance-tracking-id": context.trackingId,
      "x-li-pageforestid": context.pageForestId,
      "x-li-rsc-stream": "true",
      "x-li-traceparent": `00-${context.pageForestId}-${context.traceSpanId}-00`,
      "x-li-tracestate": `LinkedIn=${context.traceSpanId}`,
      "x-li-track": this.config.xLiTrack || xLiTrack,
      ...extra,
    });

    if (this.config.applicationInstance) {
      headers.set("x-li-application-instance", this.config.applicationInstance);
    }
    return headers;
  }

  private async post(url: URL, body: unknown, headers: Headers): Promise<string> {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "manual",
    });
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok || response.status >= 300) {
      const authHint = [401, 403].includes(response.status)
        ? " LinkedIn authentication may have expired."
        : "";
      throw new LinkedInRequestError(`LinkedIn returned HTTP ${response.status}.${authHint}`, response.status);
    }
    if (contentType.includes("text/html") || /^\s*</.test(text)) {
      throw new LinkedInRequestError("LinkedIn returned an HTML login or challenge page.", 401);
    }
    return text;
  }

  async searchSuggestions(query: string): Promise<SearchSuggestion[]> {
    const url = new URL("https://www.linkedin.com/flagship-web/rsc-action/actions/server-request");
    url.searchParams.set("sduiid", TYPEAHEAD_ACTION);
    url.searchParams.set("parentSpanId", createParentSpanId());

    const payload = await this.post(
      url,
      buildTypeaheadBody(query),
      this.headers("d_flagship3_feed", "https://www.linkedin.com/feed/"),
    );
    return parseSearchSuggestions(payload);
  }

  async getProfile(vanityName: string, profileId: string): Promise<LinkedInProfile> {
    const url = new URL(`https://www.linkedin.com/flagship-web/in/${encodeURIComponent(vanityName)}/`);
    const initialUrl = `/search/results/all/?keywords=${encodeURIComponent(vanityName)}&origin=GLOBAL_SEARCH_HEADER`;
    const referer = `https://www.linkedin.com${initialUrl}`;
    const payload = await this.post(
      url,
      buildProfileBody(vanityName, profileId),
      this.headers("d_flagship3_search_srp_all", referer, {
        "x-li-initial-url": initialUrl,
        "x-li-layout-tree": JSON.stringify([
          "com.linkedin.sdui.flagshipnav.search.SearchResults#0",
          "com.linkedin.sdui.flagshipnav.home.Home#0",
          "a15eca777c146d37da0475b8f19e5d56",
        ]),
        "x-li-prefetch": "true",
      }),
    );
    return parseProfile(payload, vanityName, profileId);
  }
}
