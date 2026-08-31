import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/api/app.ts";
import {
	profileSchema,
	profileSearchResponseSchema,
	type Profile,
	type ProfileSearchResponse,
} from "../src/core/schema.ts";

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

describe("API routes", () => {
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

	test("keeps unknown API routes as JSON errors", async () => {
		const response = await createApp().request("/api/missing");

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Not found" });
	});

	test("proxies LinkedIn profile images through the API origin", async () => {
		const source = "https://media.licdn.com/profile-displayphoto/image.jpg?sig=1";
		const token = Buffer.from(source).toString("base64url");
		const calls: string[] = [];
		const app = createApp({
			async fetchProfileImage(url: string): Promise<Response> {
				calls.push(url);
				return new Response("image bytes", {
					headers: { "content-type": "image/jpeg" },
				});
			},
		});

		const response = await app.request(`/api/profile-image/${token}`);

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
		const app = createApp({
			async fetchProfileImage(): Promise<Response> {
				called = true;
				return new Response();
			},
		});

		const response = await app.request(`/api/profile-image/${token}`);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Invalid profile image URL" });
		expect(called).toBe(false);
	});

	test("rejects an invalid search query", async () => {
		const app = createApp();

		for (const path of [
			"/api/search",
			"/api/search?q=%20%20%20",
			`/api/search?q=${"a".repeat(101)}`,
		]) {
			const response = await app.request(path);
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
		const app = createApp({
			async searchProfiles(query: string): Promise<ProfileSearchResponse> {
				calls.push(query);
				return searchResponse;
			},
		});

		const response = await app.request("/api/search?q=%20satya%20nadella%20");
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(calls).toEqual(["satya nadella"]);
		expect(profileSearchResponseSchema.parse(body)).toEqual(searchResponse);
	});

	test("reports health without loading LinkedIn credentials", async () => {
		const response = await createApp().request("/health");
		const body = (await response.json()) as {
			ok: boolean;
			authenticated: boolean;
		};

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(typeof body.authenticated).toBe("boolean");
	});

	test("rejects a missing profile URL", async () => {
		const response = await createApp().request("/api/profile");

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "url is required" });
	});

	test("passes the URL to profile-service and returns its result", async () => {
		const calls: string[] = [];
		const app = createApp({
			async getProfile(url: string): Promise<Profile> {
				calls.push(url);
				return emptyProfile;
			},
		});

		const response = await app.request(
			"/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fwilliamhgates%2F",
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(calls).toEqual([
			"https://www.linkedin.com/in/williamhgates/",
		]);
		expect(profileSchema.parse(body)).toEqual(emptyProfile);
	});

	test("rejects an invalid profile URL before loading credentials", async () => {
		const response = await createApp().request(
			"/api/profile?url=https%3A%2F%2Fexample.com%2Fin%2Fsatyanadella%2F",
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "url must be a LinkedIn profile URL",
		});
	});

	test("passes selected sections to profile-service", async () => {
		const calls: unknown[] = [];
		const app = createApp({
			async getProfile(_url, options): Promise<Profile> {
				calls.push(options);
				return emptyProfile;
			},
		});

		const response = await app.request(
			"/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fsatyanadella%2F&sections=experience%2Ceducation%2Cexperience",
		);

		expect(response.status).toBe(200);
		expect(calls).toEqual([{ sections: ["experience", "education"] }]);
	});

	test("rejects an unknown section", async () => {
		const response = await createApp().request(
			"/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fsatyanadella%2F&sections=experience%2Cposts",
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error:
				"sections must contain experience, education, skills, certifications, or languages",
		});
	});
});
