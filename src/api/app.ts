import { Hono } from "hono";
import { getProfile } from "../core/profile-service.ts";
import type { Profile } from "../core/schema.ts";

interface AppDependencies {
	getProfile(url: string): Promise<Profile>;
}

const defaultDependencies: AppDependencies = { getProfile };

export function createApp(
	dependencies: AppDependencies = defaultDependencies,
): Hono {
	const app = new Hono();

	app.get("/", (context) =>
		context.json({
			name: "LinkedIn profile API",
			routes: {
				profile: "GET /api/profile?url=...",
				health: "GET /health",
			},
		}),
	);

	app.get("/health", (context) =>
		context.json({
			ok: true,
			authenticated: Boolean(Bun.env.LINKEDIN_COOKIE),
		}),
	);

	app.get("/api/profile", async (context) => {
		const url = context.req.query("url")?.trim();
		if (!url) return context.json({ error: "url is required" }, 400);

		return context.json(await dependencies.getProfile(url));
	});

	app.notFound((context) => context.json({ error: "Not found" }, 404));

	return app;
}

export const app = createApp();
