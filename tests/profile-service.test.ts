import { describe, expect, test } from "bun:test";
import { getProfile } from "../src/core/profile-service.ts";
import type { LinkedInHttp } from "../src/core/linkedin/http.ts";
import {
	educationPayload,
	experiencePayload,
	languagesPayload,
	pageHtml,
	pagePayload,
	skillsPayload,
} from "./profile-fixtures.ts";

function profileHttp(failSection?: string): LinkedInHttp {
	return {
		async post(request) {
			if (failSection && request.path.includes(`/details/${failSection}/`)) {
				throw new Error("section failed");
			}
			if (request.path.includes("/details/skills/")) {
				return skillsPayload;
			}
			if (request.path.includes("/details/languages/")) {
				return languagesPayload;
			}
			if (!request.path.includes("/details/")) return pagePayload;
			if (request.path.includes("/details/experience/")) {
				return experiencePayload;
			}
			if (request.path.includes("/details/education/")) return educationPayload;
			return "not Flight data";
		},
	};
}

describe("profile service", () => {
	test("normalizes the URL and extracts requested sections", async () => {
		const profile = await getProfile(
			"HTTPS://WWW.LINKEDIN.COM/IN/SATYANADELLA/?trk=test",
			{
				http: profileHttp(),
				sections: ["experience", "education"],
			},
		);

		expect(profile.sourceUrl).toBe(
			"https://www.linkedin.com/in/satyanadella/",
		);
		expect(profile.name).toBe("Satya Nadella");
		expect(profile.experience?.[0]?.company).toBe("Microsoft");
		expect(profile.education?.[0]?.school).toBe(
			"Manipal Institute of Technology",
		);
		expect(profile.skills).toBeNull();
		expect(profile.meta).toEqual({
			extracted: ["identity", "about", "experience", "education"],
			missing: [],
		});
	});

	test("reports a failed extractor without losing other sections", async () => {
		const profile = await getProfile(
			"https://www.linkedin.com/in/satyanadella/",
			{
				http: profileHttp("education"),
				sections: ["experience", "education"],
			},
		);

		expect(profile.experience).not.toBeNull();
		expect(profile.education).toBeNull();
		expect(profile.meta.extracted).toContain("experience");
		expect(profile.meta.missing).toEqual(["education"]);
	});

	test("returns skills and languages from their detail-page responses", async () => {
		const profile = await getProfile(
			"https://www.linkedin.com/in/satyanadella/",
			{
				http: profileHttp(),
				sections: ["skills", "languages"],
			},
		);

		expect(profile.skills).toEqual(["Leadership", "Cloud Computing"]);
		expect(profile.languages).toEqual([
			{ name: "English", proficiency: "Native or bilingual proficiency" },
			{ name: "Hindi", proficiency: "Elementary proficiency" },
		]);
		expect(profile.meta.missing).toEqual([]);
	});

	test("prefers the profile image rendered in the profile HTML", async () => {
		const http = profileHttp();
		http.get = async () => pageHtml;

		const profile = await getProfile(
			"https://www.linkedin.com/in/satyanadella/",
			{ http, sections: [] },
		);

		expect(profile.profileImageUrl).toBe(
			"https://media.licdn.com/profile-displayphoto-owner-large.jpg?expires=1&signature=large",
		);
	});
});
