import { Hono } from "hono";
import { getProfile, searchProfiles } from "../core/profile-service.ts";
import {
	profileSearchQuerySchema,
	type Profile,
	type ProfileSearchResponse,
} from "../core/schema.ts";

interface AppDependencies {
	getProfile(url: string): Promise<Profile>;
	searchProfiles(query: string): Promise<ProfileSearchResponse>;
}

const defaultDependencies: AppDependencies = { getProfile, searchProfiles };

export function createApp(
	overrides: Partial<AppDependencies> = {},
): Hono {
	const app = new Hono();
	const dependencies = { ...defaultDependencies, ...overrides };

	app.get("/", (context) =>
		context.json({
			name: "LinkedIn profile API",
			routes: {
				profile: "GET /api/profile?url=...",
				search: "GET /api/search?q=...",
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

	app.get("/api/search", async (context) => {
		const query = profileSearchQuerySchema.safeParse(context.req.query("q"));
		if (!query.success) {
			return context.json(
				{ error: "q must contain between 1 and 100 characters" },
				400,
			);
		}

		return context.json(await dependencies.searchProfiles(query.data));
	});

	app.get("/api/profile", async (context) => {
		const url = context.req.query("url")?.trim();
		if (!url) return context.json({ error: "url is required" }, 400);

		return context.json(await dependencies.getProfile(url));
	});

	app.notFound((context) => context.json({ error: "Not found" }, 404));

	return app;
}

export const app = createApp();
