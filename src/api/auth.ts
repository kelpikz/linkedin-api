import type { Context, MiddlewareHandler } from "hono";

/** Failed-attempt budget applied to each client address. */
export interface AuthRateLimit {
	maxFailures: number;
	windowMs: number;
	now(): number;
}

interface FailureWindow {
	count: number;
	expiresAt: number;
}

const defaultRateLimit: AuthRateLimit = {
	maxFailures: 10,
	windowMs: 60_000,
	now: () => Date.now(),
};

/** Caps the address table so a distributed attempt cannot exhaust memory. */
const maxTrackedAddresses = 10_000;

/** Request budget applied to each API key. */
export interface RequestRateLimit {
	maxRequests: number;
	windowMs: number;
	now(): number;
}

const defaultRequestRateLimit: RequestRateLimit = {
	maxRequests: 10,
	windowMs: 60_000,
	now: () => Date.now(),
};

/** Splits the configured API keys and discards blank entries. */
export function parseApiKeys(value: string | undefined): string[] {
	return value
		? value
				.split(",")
				.map((key) => key.trim())
				.filter(Boolean)
		: [];
}

/** Reads the bearer token out of the Authorization header. */
function bearerToken(context: Context): string | null {
	const authorization = context.req.header("authorization");
	return /^Bearer\s+(\S+)$/i.exec(authorization ?? "")?.[1] ?? null;
}

/**
 * Reads the caller address from the proxy header. Caddy is the only ingress,
 * because compose exposes the app port instead of publishing it, so no client
 * can set this header itself.
 */
function clientAddress(context: Context): string {
	const forwarded = context.req.header("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
	return context.req.header("x-real-ip")?.trim() || "unknown";
}

/**
 * Requires one configured bearer token on every matched request, and answers
 * 429 once an address spends its failed-attempt budget. A valid key always
 * passes and clears the count, so a caller who knows the key is never locked
 * out by someone else guessing.
 */
export function bearerAuth(
	apiKeys: readonly string[],
	rateLimit: Partial<AuthRateLimit> = {},
): MiddlewareHandler {
	const validKeys = new Set(apiKeys);
	const { maxFailures, windowMs, now } = { ...defaultRateLimit, ...rateLimit };
	const retryAfter = String(Math.ceil(windowMs / 1000));
	const failures = new Map<string, FailureWindow>();

	function prune(time: number): void {
		for (const [address, window] of failures) {
			if (window.expiresAt <= time) failures.delete(address);
		}
	}

	return async (context, next) => {
		const address = clientAddress(context);
		const time = now();
		const window = failures.get(address);
		const active = window && window.expiresAt > time ? window : undefined;

		const token = bearerToken(context);
		if (token && validKeys.has(token)) {
			failures.delete(address);
			await next();
			return;
		}

		if (active && active.count >= maxFailures) {
			context.header("Retry-After", retryAfter);
			return context.json({ error: "Too many requests" }, 429);
		}

		if (active) {
			active.count += 1;
		} else {
			if (failures.size >= maxTrackedAddresses) prune(time);
			failures.set(address, { count: 1, expiresAt: time + windowMs });
		}

		context.header("WWW-Authenticate", "Bearer");
		return context.json({ error: "Unauthorized" }, 401);
	};
}

/**
 * Caps how many /api requests one key spends inside the window. A profile
 * request costs about ten upstream LinkedIn calls, so this budget protects the
 * session cookie rather than the CPU.
 *
 * Run it after `bearerAuth`. Only a valid key gets this far, so the table holds
 * one entry per configured key and cannot grow past that. Each entry keeps at
 * most `maxRequests` timestamps, and the window slides, so ten requests in any
 * sixty seconds is the real ceiling instead of twenty across a boundary.
 */
export function keyRateLimit(
	limit: Partial<RequestRateLimit> = {},
): MiddlewareHandler {
	const { maxRequests, windowMs, now } = {
		...defaultRequestRateLimit,
		...limit,
	};

	const hits = new Map<string, number[]>();

	return async (context, next) => {
		const key = bearerToken(context) ?? "unknown";
		const time = now();
		const recent = (hits.get(key) ?? []).filter((hit) => hit > time - windowMs);
		hits.set(key, recent);

		if (recent.length >= maxRequests) {
			const oldest = recent[0] ?? time;
			const seconds = Math.ceil((oldest + windowMs - time) / 1000);
			context.header("Retry-After", String(seconds));
			return context.json({ error: "Rate limit exceeded" }, 429);
		}

		recent.push(time);
		await next();
	};
}
