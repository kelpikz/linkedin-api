import { LinkedInRequestError } from "../errors.ts";

export interface LinkedInConfig {
	cookie: string;
	csrfToken: string;
	appVersion: string;
	applicationInstance?: string;
	xLiTrack?: string;
	userAgent: string;
}

export interface LinkedInRequestState {
	key?: string;
	value?: string | boolean;
	[key: string]: unknown;
}

export interface LinkedInRequestBody {
	requestedArguments: {
		payload: Record<string, unknown>;
		[key: string]: unknown;
	};
	states?: LinkedInRequestState[];
	[key: string]: unknown;
}

export interface LinkedInPrefetchBody extends LinkedInRequestBody {
	requestedArguments: {
		payload: Record<string, unknown>;
		states: unknown[];
		requestMetadata: { $type: string };
		screenId: string;
		knownTemplateIds: unknown[];
	};
	isPrefetch: true;
}

export interface LinkedInEndpointRequest {
	path: string;
	pageKey: string;
	refererPath: string;
	body: LinkedInRequestBody;
	extraHeaders?: Record<string, string>;
}

export interface LinkedInHttp {
	post(request: LinkedInEndpointRequest): Promise<string>;
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

export function loadLinkedInConfig(
	env: Record<string, string | undefined> = Bun.env,
): LinkedInConfig {
	const cookie = env.LINKEDIN_COOKIE?.trim();
	if (!cookie) throw new Error("LINKEDIN_COOKIE is required");

	const csrfToken =
		env.LINKEDIN_CSRF_TOKEN?.trim() || readCookieValue(cookie, "JSESSIONID");
	if (!csrfToken) {
		throw new Error(
			"LINKEDIN_CSRF_TOKEN is required when LINKEDIN_COOKIE has no JSESSIONID",
		);
	}

	return {
		cookie,
		csrfToken,
		appVersion: env.LINKEDIN_APP_VERSION?.trim() || "0.2.6975",
		applicationInstance:
			env.LINKEDIN_APPLICATION_INSTANCE?.trim() ||
			CAPTURED_APPLICATION_INSTANCE,
		xLiTrack: env.LINKEDIN_X_LI_TRACK?.trim() || undefined,
		userAgent:
			env.LINKEDIN_USER_AGENT?.trim() ||
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	};
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

function requestHeaders(
	config: LinkedInConfig,
	request: LinkedInEndpointRequest,
): Headers {
	const trackingId = randomBase64(16);
	const pageForestId = randomHex(16);
	const traceSpanId = randomHex(8);
	const xLiTrack = JSON.stringify({
		clientVersion: config.appVersion,
		mpVersion: config.appVersion,
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
		cookie: config.cookie,
		"csrf-token": config.csrfToken,
		origin: "https://www.linkedin.com",
		referer: `https://www.linkedin.com${request.refererPath}`,
		"user-agent": config.userAgent,
		"x-li-anchor-page-key": request.pageKey,
		"x-li-application-version": config.appVersion,
		"x-li-page-instance": `urn:li:page:${request.pageKey};${trackingId}`,
		"x-li-page-instance-tracking-id": trackingId,
		"x-li-pageforestid": pageForestId,
		"x-li-rsc-stream": "true",
		"x-li-traceparent": `00-${pageForestId}-${traceSpanId}-00`,
		"x-li-tracestate": `LinkedIn=${traceSpanId}`,
		"x-li-track": config.xLiTrack || xLiTrack,
		...request.extraHeaders,
	});

	if (config.applicationInstance) {
		headers.set("x-li-application-instance", config.applicationInstance);
	}

	return headers;
}

export function createLinkedInHttp(
	config: LinkedInConfig,
	fetcher: typeof fetch = fetch,
): LinkedInHttp {
	return {
		async post(request): Promise<string> {
			const response = await fetcher(
				new URL(request.path, "https://www.linkedin.com"),
				{
					method: "POST",
					headers: requestHeaders(config, request),
					body: JSON.stringify(request.body),
					redirect: "manual",
				},
			);
			const text = await response.text();
			const contentType = response.headers.get("content-type") || "";

			if (!response.ok || response.status >= 300) {
				const authHint = [401, 403].includes(response.status)
					? " LinkedIn authentication may have expired."
					: "";
				throw new LinkedInRequestError(
					`LinkedIn returned HTTP ${response.status}.${authHint}`,
					response.status,
				);
			}
			if (contentType.includes("text/html") || /^\s*</.test(text)) {
				throw new LinkedInRequestError(
					"LinkedIn returned an HTML login or challenge page.",
					401,
				);
			}

			return text;
		},
	};
}
