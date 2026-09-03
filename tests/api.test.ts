import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { createApp } from "../src/api/app.ts";
import { parseApiKeys } from "../src/api/auth.ts";
import {
	certificationSchema,
	educationSchema,
	experienceSchema,
	identitySchema,
	languageSchema,
	profileDetailSectionSchema,
	profileMetaSchema,
	profileSchema,
	profileSearchResponseSchema,
	profileSearchResultSchema,
	profileSectionSchema,
	type Profile,
	type ProfileSearchResponse,
} from "../src/core/schema.ts";

function openApiSchema(schema: z.ZodType) {
	const { $schema, ...document } = z.toJSONSchema(schema);
	return document;
}

const emptyProfile: Profile = {
	sourceUrl: "https://www.linkedin.com/in/williamhgates/",
	name: null,
	headline: null,
	location: null,
	about: null,
	profileImageUrl: null,
	experience: null,
	education: null,
	skills: null,
	certifications: null,
	languages: null,
	meta: {
		extracted: [],
		missing: [
			"identity",
			"about",
			"experience",
			"education",
			"skills",
			"certifications",
			"languages",
		],
	},
};

const apiKey = "reviewer-key";
const authorized = { headers: { authorization: `Bearer ${apiKey}` } };

describe("API routes", () => {
	test("reads trimmed non-empty keys from API_KEYS", () => {
		expect(parseApiKeys(" first-key, , reviewer-key ,")).toEqual([
			"first-key",
			"reviewer-key",
		]);
		expect(parseApiKeys(undefined)).toEqual([]);
	});

	test("serves the built frontend and its assets", async () => {
		const webRoot = mkdtempSync(join(tmpdir(), "tross-web-"));
		mkdirSync(join(webRoot, "assets"));
		writeFileSync(join(webRoot, "index.html"), "<main>Profile viewer</main>");
		writeFileSync(join(webRoot, "assets", "app.js"), "export {};\n");

		try {
			const app = createApp({}, { webRoot });
			const page = await app.request("/");
			const asset = await app.request("/assets/app.js");

			expect(page.status).toBe(200);
			expect(page.headers.get("content-type")).toContain("text/html");
			expect(await page.text()).toContain("Profile viewer");
			expect(asset.status).toBe(200);
			expect(asset.headers.get("content-type")).toContain("javascript");
			expect(await asset.text()).toBe("export {};\n");
		} finally {
			rmSync(webRoot, { recursive: true, force: true });
		}
	});

	test("serves the OpenAPI document with every public endpoint", async () => {
		const response = await createApp({}, { apiKeys: [apiKey] }).request(
			"/openapi.json",
		);
		const document = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("application/json");
		expect(document.openapi).toBe("3.1.0");
		expect(Object.keys(document.paths).sort()).toEqual([
			"/api/profile",
			"/api/search",
			"/health",
			"/openapi.json",
			"/profile-images/{source}",
		]);
		expect(document.components.securitySchemes.bearerAuth).toEqual({
			type: "http",
			scheme: "bearer",
			bearerFormat: "API key",
		});
		expect(document.components.schemas).toEqual({
			Error: expect.any(Object),
			Health: expect.any(Object),
			Identity: openApiSchema(identitySchema),
			Experience: openApiSchema(experienceSchema),
			Education: openApiSchema(educationSchema),
			Certification: openApiSchema(certificationSchema),
			Language: openApiSchema(languageSchema),
			Profile: openApiSchema(profileSchema),
			ProfileMeta: openApiSchema(profileMetaSchema),
			ProfileSection: openApiSchema(profileSectionSchema),
			ProfileDetailSection: openApiSchema(profileDetailSectionSchema),
			ProfileSearchResult: openApiSchema(profileSearchResultSchema),
			ProfileSearchResponse: openApiSchema(profileSearchResponseSchema),
		});
		expect(document.paths["/api/profile"].get.security).toEqual([
			{ bearerAuth: [] },
		]);
		expect(document.paths["/api/search"].get.security).toEqual([
			{ bearerAuth: [] },
		]);
		expect(
			document.paths["/api/profile"].get.parameters[1].schema.items,
		).toEqual({ $ref: "#/components/schemas/ProfileDetailSection" });
	});

	test("serves an interactive Swagger UI page", async () => {
		const response = await createApp().request("/docs");
		const page = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(page).toContain("<title>LinkedIn Profile API documentation</title>");
		expect(page).toContain('id="swagger-ui"');
		expect(page).toContain('url: "/openapi.json"');
		expect(page).toContain("SwaggerUIBundle");
	});

	test("keeps unknown API routes as JSON errors", async () => {
		const response = await createApp({}, { apiKeys: [apiKey] }).request(
			"/api/missing",
			authorized,
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Not found" });
	});

	test("requires a valid bearer token on every API route", async () => {
		const app = createApp({}, { apiKeys: ["first-key", apiKey] });

		for (const authorization of [
			undefined,
			"reviewer-key",
			"Bearer wrong-key",
			"Basic reviewer-key",
		]) {
			const response = await app.request("/api/missing", {
				headers: authorization ? { authorization } : undefined,
			});

			expect(response.status).toBe(401);
			expect(response.headers.get("www-authenticate")).toBe("Bearer");
			expect(await response.json()).toEqual({ error: "Unauthorized" });
		}

		const response = await app.request("/api/missing", authorized);
		expect(response.status).toBe(404);
	});

	test("proxies LinkedIn profile images through the API origin", async () => {
		const source = "https://media.licdn.com/profile-displayphoto/image.jpg?sig=1";
		const token = Buffer.from(source).toString("base64url");
		const calls: string[] = [];
		const app = createApp(
			{
				async fetchProfileImage(url: string): Promise<Response> {
					calls.push(url);
					return new Response("image bytes", {
						headers: { "content-type": "image/jpeg" },
					});
				},
			},
			{ apiKeys: [apiKey] },
		);

		const response = await app.request(`/profile-images/${token}`);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/jpeg");
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=3600",
		);
		expect(await response.text()).toBe("image bytes");
		expect(calls).toEqual([source]);
	});

	test("rejects non-LinkedIn image proxy targets", async () => {
		const source = "https://example.com/image.jpg";
		const token = Buffer.from(source).toString("base64url");
		let called = false;
		const app = createApp(
			{
				async fetchProfileImage(): Promise<Response> {
					called = true;
					return new Response();
				},
			},
			{ apiKeys: [apiKey] },
		);

		const response = await app.request(`/profile-images/${token}`);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Invalid profile image URL" });
		expect(called).toBe(false);
	});

	test("rejects an invalid search query", async () => {
		const app = createApp({}, { apiKeys: [apiKey] });

		for (const path of [
			"/api/search",
			"/api/search?q=%20%20%20",
			`/api/search?q=${"a".repeat(101)}`,
		]) {
			const response = await app.request(path, authorized);
			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({
				error: "q must contain between 1 and 100 characters",
			});
		}
	});

	test("passes a trimmed query to profile-service", async () => {
		const calls: string[] = [];
		const searchResponse: ProfileSearchResponse = {
			query: "satya nadella",
			count: 1,
			results: [
				{
					name: "Satya Nadella",
					vanityName: "satyanadella",
					url: "https://www.linkedin.com/in/satyanadella/",
					profileImageUrl: "https://media.licdn.com/satya-profile.jpg",
				},
			],
		};
		const app = createApp(
			{
				async searchProfiles(query: string): Promise<ProfileSearchResponse> {
					calls.push(query);
					return searchResponse;
				},
			},
			{ apiKeys: [apiKey] },
		);

		const response = await app.request(
			"/api/search?q=%20satya%20nadella%20",
			authorized,
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(calls).toEqual(["satya nadella"]);
		expect(profileSearchResponseSchema.parse(body)).toEqual(searchResponse);
	});

	test("reports health without loading LinkedIn credentials", async () => {
		const response = await createApp().request("/health");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	test("rejects a missing profile URL", async () => {
		const response = await createApp({}, { apiKeys: [apiKey] }).request(
			"/api/profile",
			authorized,
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "url is required" });
	});

	test("passes the URL to profile-service and returns its result", async () => {
		const calls: string[] = [];
		const app = createApp(
			{
				async getProfile(url: string): Promise<Profile> {
					calls.push(url);
					return emptyProfile;
				},
			},
			{ apiKeys: [apiKey] },
		);

		const response = await app.request(
			"/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fwilliamhgates%2F",
			authorized,
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(calls).toEqual([
			"https://www.linkedin.com/in/williamhgates/",
		]);
		expect(profileSchema.parse(body)).toEqual(emptyProfile);
	});

	test("rejects an invalid profile URL before loading credentials", async () => {
		const response = await createApp({}, { apiKeys: [apiKey] }).request(
			"/api/profile?url=https%3A%2F%2Fexample.com%2Fin%2Fsatyanadella%2F",
			authorized,
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "url must be a LinkedIn profile URL",
		});
	});

	test("passes selected sections to profile-service", async () => {
		const calls: unknown[] = [];
		const app = createApp(
			{
				async getProfile(_url, options): Promise<Profile> {
					calls.push(options);
					return emptyProfile;
				},
			},
			{ apiKeys: [apiKey] },
		);

		const response = await app.request(
			"/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fsatyanadella%2F&sections=experience%2Ceducation%2Cexperience",
			authorized,
		);

		expect(response.status).toBe(200);
		expect(calls).toEqual([{ sections: ["experience", "education"] }]);
	});

	test("rejects an unknown section", async () => {
		const response = await createApp({}, { apiKeys: [apiKey] }).request(
			"/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fsatyanadella%2F&sections=experience%2Cposts",
			authorized,
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error:
				"sections must contain experience, education, skills, certifications, or languages",
		});
	});
});

describe("API key brute force protection", () => {
	function from(ip: string, authorization?: string): RequestInit {
		const headers: Record<string, string> = { "x-forwarded-for": ip };
		if (authorization) headers.authorization = authorization;
		return { headers };
	}

	function appWithClock(clock: { value: number }) {
		return createApp(
			{},
			{
				apiKeys: [apiKey],
				authRateLimit: {
					maxFailures: 3,
					windowMs: 60_000,
					now: () => clock.value,
				},
			},
		);
	}

	test("blocks an address after repeated wrong keys", async () => {
		const app = appWithClock({ value: 0 });

		for (let attempt = 0; attempt < 3; attempt += 1) {
			const response = await app.request(
				"/api/search?q=gates",
				from("203.0.113.5", "Bearer wrong-key"),
			);
			expect(response.status).toBe(401);
		}

		const blocked = await app.request(
			"/api/search?q=gates",
			from("203.0.113.5", "Bearer wrong-key"),
		);

		expect(blocked.status).toBe(429);
		expect(blocked.headers.get("retry-after")).toBe("60");
		expect(await blocked.json()).toEqual({ error: "Too many requests" });
	});

	test("allows attempts again after the window passes", async () => {
		const clock = { value: 0 };
		const app = appWithClock(clock);
		const attempt = () =>
			app.request("/api/search?q=gates", from("203.0.113.5", "Bearer wrong-key"));

		for (let count = 0; count < 4; count += 1) await attempt();
		expect((await attempt()).status).toBe(429);

		clock.value = 60_000;

		expect((await attempt()).status).toBe(401);
	});

	test("counts each client address separately", async () => {
		const app = appWithClock({ value: 0 });

		for (let count = 0; count < 4; count += 1) {
			await app.request(
				"/api/search?q=gates",
				from("203.0.113.5", "Bearer wrong-key"),
			);
		}

		const other = await app.request(
			"/api/search?q=gates",
			from("198.51.100.7", "Bearer wrong-key"),
		);

		expect(other.status).toBe(401);
	});

	test("never blocks a request that carries a valid key", async () => {
		const app = createApp(
			{
				async searchProfiles(): Promise<ProfileSearchResponse> {
					return { query: "gates", count: 0, results: [] };
				},
			},
			{
				apiKeys: [apiKey],
				authRateLimit: { maxFailures: 3, windowMs: 60_000, now: () => 0 },
			},
		);

		for (let count = 0; count < 10; count += 1) {
			await app.request(
				"/api/search?q=gates",
				from("203.0.113.5", "Bearer wrong-key"),
			);
		}

		const response = await app.request(
			"/api/search?q=gates",
			from("203.0.113.5", `Bearer ${apiKey}`),
		);

		expect(response.status).toBe(200);
	});

	test("clears the count after a valid key arrives", async () => {
		const app = createApp(
			{
				async searchProfiles(): Promise<ProfileSearchResponse> {
					return { query: "gates", count: 0, results: [] };
				},
			},
			{
				apiKeys: [apiKey],
				authRateLimit: { maxFailures: 3, windowMs: 60_000, now: () => 0 },
			},
		);
		const wrong = () =>
			app.request("/api/search?q=gates", from("203.0.113.5", "Bearer wrong-key"));

		for (let count = 0; count < 2; count += 1) await wrong();
		await app.request(
			"/api/search?q=gates",
			from("203.0.113.5", `Bearer ${apiKey}`),
		);

		for (let count = 0; count < 3; count += 1) {
			expect((await wrong()).status).toBe(401);
		}
	});
});

describe("API request rate limit", () => {
	const otherKey = "second-key";
	const stubs = {
		async getProfile(): Promise<Profile> {
			return emptyProfile;
		},
		async searchProfiles(): Promise<ProfileSearchResponse> {
			return { query: "gates", count: 0, results: [] };
		},
	};

	function appWithBudget(clock: { value: number }) {
		return createApp(stubs, {
			apiKeys: [apiKey, otherKey],
			// A wide failure budget keeps the brute-force lockout out of these tests.
			authRateLimit: { maxFailures: 1_000, windowMs: 60_000, now: () => 0 },
			rateLimit: { maxRequests: 10, windowMs: 60_000, now: () => clock.value },
		});
	}

	function search(app: ReturnType<typeof createApp>, key = apiKey) {
		return app.request("/api/search?q=gates", {
			headers: { authorization: `Bearer ${key}` },
		});
	}

	function profile(app: ReturnType<typeof createApp>, key = apiKey) {
		return app.request(
			"/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fwilliamhgates%2F",
			{ headers: { authorization: `Bearer ${key}` } },
		);
	}

	test("allows ten requests a minute and refuses the eleventh", async () => {
		const app = appWithBudget({ value: 0 });

		for (let count = 0; count < 10; count += 1) {
			expect((await search(app)).status).toBe(200);
		}

		const blocked = await search(app);

		expect(blocked.status).toBe(429);
		expect(blocked.headers.get("retry-after")).toBe("60");
		expect(await blocked.json()).toEqual({ error: "Rate limit exceeded" });
	});

	test("defaults to ten requests a minute", async () => {
		const app = createApp(stubs, { apiKeys: [apiKey] });

		for (let count = 0; count < 10; count += 1) {
			expect((await search(app)).status).toBe(200);
		}

		expect((await search(app)).status).toBe(429);
	});

	test("spends one budget across search and profile", async () => {
		const app = appWithBudget({ value: 0 });

		for (let count = 0; count < 5; count += 1) {
			expect((await search(app)).status).toBe(200);
			expect((await profile(app)).status).toBe(200);
		}

		expect((await search(app)).status).toBe(429);
	});

	test("counts each API key separately", async () => {
		const app = appWithBudget({ value: 0 });

		for (let count = 0; count < 11; count += 1) await search(app);

		expect((await search(app, otherKey)).status).toBe(200);
	});

	test("frees a slot once its request leaves the window", async () => {
		const clock = { value: 0 };
		const app = appWithBudget(clock);

		for (let count = 0; count < 10; count += 1) await search(app);

		clock.value = 30_000;
		const blocked = await search(app);
		expect(blocked.status).toBe(429);
		expect(blocked.headers.get("retry-after")).toBe("30");

		clock.value = 60_000;
		expect((await search(app)).status).toBe(200);
	});

	test("charges nothing to a key that fails auth", async () => {
		const app = appWithBudget({ value: 0 });

		for (let count = 0; count < 20; count += 1) {
			expect((await search(app, "wrong-key")).status).toBe(401);
		}

		expect((await search(app)).status).toBe(200);
	});
});
