import { Hono } from "hono";
import { InvalidProfileUrlError } from "../core/errors.ts";
import {
	getProfile,
	searchProfiles,
	type GetProfileOptions,
} from "../core/profile-service.ts";
import {
	profileDetailSectionSchema,
	profileSearchQuerySchema,
	type Profile,
	type ProfileDetailSection,
	type ProfileSearchResponse,
} from "../core/schema.ts";

interface AppDependencies {
	getProfile(url: string, options?: GetProfileOptions): Promise<Profile>;
	searchProfiles(query: string): Promise<ProfileSearchResponse>;
}

const defaultDependencies: AppDependencies = { getProfile, searchProfiles };

/** Parses and deduplicates the optional comma-separated detail section list. */
function requestedSections(value: string | undefined):
	| { success: true; data: ProfileDetailSection[] | undefined }
	| { success: false } {
	if (value === undefined) return { success: true, data: undefined };
	const candidates = [
		...new Set(
			value
				.split(",")
				.map((section) => section.trim().toLowerCase())
				.filter(Boolean),
		),
	];
	const result = profileDetailSectionSchema.array().safeParse(candidates);
	return result.success
		? { success: true, data: result.data }
		: { success: false };
}

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
		const sections = requestedSections(context.req.query("sections"));
		if (!sections.success) {
			return context.json(
				{
					error:
						"sections must contain experience, education, skills, certifications, or languages",
				},
				400,
			);
		}

		try {
			return context.json(
				await dependencies.getProfile(url, { sections: sections.data }),
			);
		} catch (error) {
			if (error instanceof InvalidProfileUrlError) {
				return context.json({ error: error.message }, 400);
			}
			throw error;
		}
	});

	app.notFound((context) => context.json({ error: "Not found" }, 404));

	return app;
}

export const app = createApp();
