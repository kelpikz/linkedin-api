import { describe, expect, test } from "bun:test";
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
};

describe("API routes", () => {
	test("describes the service", async () => {
		const response = await createApp().request("/");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			name: "LinkedIn profile API",
			routes: {
				profile: "GET /api/profile?url=...",
				search: "GET /api/search?q=...",
				health: "GET /health",
			},
		});
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

	test("returns schema-valid nulls through the default service", async () => {
		const response = await createApp().request(
			"/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fsatyanadella%2F",
		);
		const body = profileSchema.parse(await response.json());

		expect(response.status).toBe(200);
		expect(body).toEqual({
			...emptyProfile,
			sourceUrl: "https://www.linkedin.com/in/satyanadella/",
		});
	});
});
