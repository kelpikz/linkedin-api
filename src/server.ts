import { loadLinkedInConfig } from "./linkedin/config.ts";
import { LinkedInClient, LinkedInRequestError } from "./linkedin/client.ts";

const port = Number(Bun.env.PORT || 3000);

function json(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: { "cache-control": "no-store" },
	});
}

function errorResponse(error: unknown): Response {
	if (error instanceof LinkedInRequestError) {
		return json(
			{ error: error.message, upstreamStatus: error.status },
			error.status === 429 ? 429 : 502,
		);
	}
	const message = error instanceof Error ? error.message : "Unknown error";
	return json({ error: message }, 500);
}

function getClient(): LinkedInClient {
	return new LinkedInClient(loadLinkedInConfig());
}

const server = Bun.serve({
	port,
	async fetch(request) {
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/") {
			return json({
				name: "LinkedIn internal API POC",
				routes: {
					search: "GET /api/search?q=billgates",
					profile: "GET /api/profile/:vanityName?profileId=...",
					health: "GET /health",
				},
			});
		}

		if (request.method === "GET" && url.pathname === "/health") {
			return json({
				ok: true,
				authenticated: Boolean(Bun.env.LINKEDIN_COOKIE),
			});
		}

		if (request.method === "GET" && url.pathname === "/api/search") {
			const query = url.searchParams.get("q")?.trim();
			if (!query || query.length < 1 || query.length > 100) {
				return json(
					{ error: "q must contain between 1 and 100 characters" },
					400,
				);
			}
			try {
				const suggestions = await getClient().searchSuggestions(query);
				return json({ query, count: suggestions.length, suggestions });
			} catch (error) {
				return errorResponse(error);
			}
		}

		const profileMatch = url.pathname.match(
			/^\/api\/profile\/([a-zA-Z0-9_-]+)$/,
		);
		if (request.method === "GET" && profileMatch) {
			const vanityName = profileMatch[1];
			const profileId = url.searchParams.get("profileId")?.trim();
			if (!profileId)
				return json(
					{ error: "profileId is required. Obtain it from /api/search." },
					400,
				);
			try {
				return json(await getClient().getProfile(vanityName, profileId));
			} catch (error) {
				return errorResponse(error);
			}
		}

		return json({ error: "Not found" }, 404);
	},
});

console.log(`LinkedIn API POC listening on http://localhost:${server.port}`);
