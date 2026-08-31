import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App, ProfileSearchResults, apiKeyFromSearch } from "../web/src/app.tsx";
import {
	loadProfile,
	profileImageSource,
	searchProfiles,
} from "../web/src/api.ts";
import { Button } from "../web/src/components/ui/button.tsx";
import { ProfileView } from "../web/src/profile-view.tsx";
import viteConfig from "../web/vite.config.ts";
import type { Profile } from "../src/core/schema.ts";

const profile: Profile = {
	sourceUrl: "https://www.linkedin.com/in/satyanadella/",
	name: "Satya Nadella",
	headline: "Chairman and CEO at Microsoft",
	location: "Redmond, Washington, United States",
	about: "I work to empower every person and organization.",
	profileImageUrl: "https://media.licdn.com/satya-profile.jpg",
	experience: [
		{
			title: "Chairman and CEO",
			company: "Microsoft",
			employmentType: "Full-time",
			dateRange: "Feb 2014 - Present",
			duration: "12 yrs",
			location: "Redmond, Washington",
		},
	],
	education: [
		{
			school: "Manipal Institute of Technology",
			degree: "Bachelor of Engineering",
			field: "Electrical Engineering",
			dateRange: "1984 - 1988",
		},
	],
	skills: ["Leadership", "Cloud Computing"],
	certifications: [
		{
			name: "Cloud Architecture",
			issuer: "Microsoft",
			issueDate: "Issued January 2026",
		},
	],
	languages: null,
	meta: {
		extracted: [
			"identity",
			"about",
			"experience",
			"education",
			"skills",
			"certifications",
		],
		missing: ["languages"],
	},
};

describe("frontend scaffold", () => {
	test("proxies development API requests to the Bun backend", () => {
		expect(viteConfig.server?.proxy).toEqual({
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
			"/profile-images": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
			"/health": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
		});
	});

	test("renders the shadcn button component", () => {
		const markup = renderToStaticMarkup(<Button>View profile</Button>);

		expect(markup).toContain("<button");
		expect(markup).toContain("View profile");
	});

	test("puts profile search and direct URL lookup in the first view", () => {
		const markup = renderToStaticMarkup(<App />);

		expect(markup).toContain("Search by name");
		expect(markup).toContain("Use profile URL");
		expect(markup).toContain("Search LinkedIn profiles");
		expect(markup).toContain("API key");
		expect(markup).toContain('type="password"');
		expect(markup).toContain('autoComplete="off"');
		expect(markup).toContain('aria-label="Show API key"');
	});

	test("seeds the API key from the apiKey query parameter", () => {
		const previousWindow = globalThis.window;
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: { location: { search: "?apiKey=abc123" } },
		});

		try {
			const markup = renderToStaticMarkup(<App />);

			expect(apiKeyFromSearch("?apiKey=abc123")).toBe("abc123");
			expect(markup).toContain('value="abc123"');
		} finally {
			Object.defineProperty(globalThis, "window", {
				configurable: true,
				value: previousWindow,
			});
		}
	});

	test("searches with the in-memory API key without fetching any result", async () => {
		const calls: Array<{ input: string; init?: RequestInit }> = [];
		const request = async (input: string | URL | Request, init?: RequestInit) => {
			calls.push({ input: String(input), init });
			return Response.json({
				query: "Satya Nadella",
				count: 1,
				results: [
					{
						name: "Satya Nadella",
						vanityName: "satyanadella",
						url: profile.sourceUrl,
						profileImageUrl: profile.profileImageUrl,
					},
				],
			});
		};

		const result = await searchProfiles(
			"  Satya Nadella  ",
			"reviewer-key",
			request,
		);

		expect(result.results[0]?.url).toBe(profile.sourceUrl);
		expect(calls).toEqual([
			{
				input: "/api/search?q=Satya%20Nadella",
				init: { headers: { authorization: "Bearer reviewer-key" } },
			},
		]);
	});

	test("renders profile images in search results", () => {
		const imageSource = profileImageSource(profile.profileImageUrl as string);
		const markup = renderToStaticMarkup(
			<ProfileSearchResults
				response={{
					query: "Satya Nadella",
					count: 1,
					results: [
						{
							name: "Satya Nadella",
							vanityName: "satyanadella",
							url: profile.sourceUrl,
							profileImageUrl: profile.profileImageUrl,
						},
					],
				}}
				busy={false}
				onSelect={() => {}}
			/>,
		);

		expect(imageSource).toStartWith("/profile-images/");
		expect(imageSource).not.toContain("linkedin.com");
		expect(markup).toContain(`src="${imageSource}"`);
		expect(markup).toContain('alt="Satya Nadella"');
	});

	test("shows the API message when profile search fails", async () => {
		const request = async () =>
			Response.json(
				{ error: "q must contain between 1 and 100 characters" },
				{ status: 400 },
			);

		expect(searchProfiles("", "reviewer-key", request)).rejects.toThrow(
			"q must contain between 1 and 100 characters",
		);
	});

	test("loads a selected profile without a search hop", async () => {
		const calls: Array<{ input: string; init?: RequestInit }> = [];
		const request = async (input: string | URL | Request, init?: RequestInit) => {
			calls.push({ input: String(input), init });
			return Response.json(profile);
		};

		const result = await loadProfile(profile.sourceUrl, "reviewer-key", request);

		expect(result.name).toBe("Satya Nadella");
		expect(calls).toEqual([
			{
				input:
					"/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fsatyanadella%2F",
				init: { headers: { authorization: "Bearer reviewer-key" } },
			},
		]);
	});

	test("shows the API message when profile loading fails", async () => {
		const request = async () =>
			Response.json(
				{ error: "url must be a LinkedIn profile URL" },
				{ status: 400 },
			);

		expect(
			loadProfile("https://example.com/profile", "reviewer-key", request),
		).rejects.toThrow("url must be a LinkedIn profile URL");
	});

	test("renders returned sections and reports missing ones", () => {
		const markup = renderToStaticMarkup(<ProfileView profile={profile} />);
		const imageSource = profileImageSource(profile.profileImageUrl as string);

		for (const expected of [
			"Satya Nadella",
			"Chairman and CEO",
			"Manipal Institute of Technology",
			"Leadership",
			"Cloud Architecture",
			"Languages could not be extracted",
			`src="${imageSource}"`,
		]) {
			expect(markup).toContain(expected);
		}
	});
});
