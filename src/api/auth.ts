import type { MiddlewareHandler } from "hono";

/** Splits the configured API keys and discards blank entries. */
export function parseApiKeys(value: string | undefined): string[] {
	return value
		? value
				.split(",")
				.map((key) => key.trim())
				.filter(Boolean)
		: [];
}

/** Requires one configured bearer token on every matched request. */
export function bearerAuth(apiKeys: readonly string[]): MiddlewareHandler {
	const validKeys = new Set(apiKeys);

	return async (context, next) => {
		const authorization = context.req.header("authorization");
		const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");
		if (!match?.[1] || !validKeys.has(match[1])) {
			context.header("WWW-Authenticate", "Bearer");
			return context.json({ error: "Unauthorized" }, 401);
		}

		await next();
	};
}
