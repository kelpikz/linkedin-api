import { Hono } from "hono";
import { serveStatic } from "hono/bun";
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
import {
	bearerAuth,
	keyRateLimit,
	parseApiKeys,
	type AuthRateLimit,
	type RequestRateLimit,
} from "./auth.ts";
import { openApiDocument, swaggerUiPage } from "./openapi.ts";

interface AppDependencies {
	getProfile(url: string, options?: GetProfileOptions): Promise<Profile>;
	searchProfiles(query: string): Promise<ProfileSearchResponse>;
	fetchProfileImage(url: string): Promise<Response>;
}

interface AppOptions {
	webRoot?: string;
	apiKeys?: readonly string[];
	authRateLimit?: Partial<AuthRateLimit>;
	rateLimit?: Partial<RequestRateLimit>;
}

/** Fetches one signed LinkedIn media URL without following it to another host. */
function fetchProfileImage(url: string): Promise<Response> {
	return fetch(url, {
		redirect: "error",
		headers: {
			accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
		},
	});
}

const defaultDependencies: AppDependencies = {
	getProfile,
	searchProfiles,
	fetchProfileImage,
};

/** Decodes and restricts an image token to LinkedIn's media CDN. */
function profileImageUrl(token: string): string | null {
	try {
		const value = Buffer.from(token, "base64url").toString("utf8");
		const url = new URL(value);
		return url.protocol === "https:" && url.hostname === "media.licdn.com"
			? url.href
			: null;
	} catch {
		return null;
	}
}

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
	options: AppOptions = {},
): Hono {
	const app = new Hono();
	const dependencies = { ...defaultDependencies, ...overrides };
	const webRoot = options.webRoot ?? "./dist/web";
	const apiKeys = options.apiKeys ?? parseApiKeys(Bun.env.API_KEYS);

	app.get("/assets/*", serveStatic({ root: webRoot }));
	app.get("/favicon.svg", serveStatic({ root: webRoot }));
	app.get("/", serveStatic({ root: webRoot, path: "index.html" }));

	app.get("/health", (context) => context.json({ ok: true }));
	app.get("/openapi.json", (context) => context.json(openApiDocument));
	app.get(
		"/docs",
		() =>
			new Response(swaggerUiPage, {
				headers: { "content-type": "text/html; charset=UTF-8" },
			}),
	);

	app.get("/profile-images/:source", async (context) => {
		const source = profileImageUrl(context.req.param("source"));
		if (!source) {
			return context.json({ error: "Invalid profile image URL" }, 400);
		}

		try {
			const image = await dependencies.fetchProfileImage(source);
			const contentType = image.headers.get("content-type");
			if (!image.ok || !image.body || !contentType?.startsWith("image/")) {
				return context.json({ error: "Profile image is unavailable" }, 502);
			}

			return new Response(image.body, {
				headers: {
					"cache-control": "public, max-age=3600",
					"content-type": contentType,
					"x-content-type-options": "nosniff",
				},
			});
		} catch {
			return context.json({ error: "Profile image is unavailable" }, 502);
		}
	});

	app.use("/api/*", bearerAuth(apiKeys, options.authRateLimit));
	app.use("/api/*", keyRateLimit(options.rateLimit));

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
