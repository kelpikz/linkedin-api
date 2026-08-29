import { describe, expect, test } from "bun:test";
import {
	profileSchema,
	profileSearchQuerySchema,
	profileSearchResponseSchema,
} from "../src/core/schema.ts";

const emptyProfile = {
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

describe("profile schema", () => {
	test("accepts the empty extraction result", () => {
		expect(profileSchema.parse(emptyProfile)).toEqual(emptyProfile);
	});

	test("covers every target collection", () => {
		const result = profileSchema.parse({
			...emptyProfile,
			experience: [
				{
					title: "Co-chair",
					company: "Gates Foundation",
					employmentType: null,
					dateRange: "2000 - Present",
					duration: "26 yrs",
					location: "Seattle, Washington, United States",
				},
			],
			education: [
				{
					school: "Harvard University",
					degree: null,
					field: null,
					dateRange: "1973 - 1975",
				},
			],
			skills: ["Philanthropy"],
			certifications: [
				{
					name: "Example certificate",
					issuer: "Example issuer",
					issueDate: "January 2026",
				},
			],
			languages: [{ name: "English", proficiency: "Native" }],
		});

		expect(result.experience?.[0]?.title).toBe("Co-chair");
		expect(result.languages?.[0]?.name).toBe("English");
	});

	test("rejects an invalid profile image URL", () => {
		expect(() =>
			profileSchema.parse({
				...emptyProfile,
				profileImageUrl: "not-a-url",
			}),
		).toThrow();
	});
});

describe("profile search schema", () => {
	test("trims and validates a search query", () => {
		expect(profileSearchQuerySchema.parse("  bill gates  ")).toBe("bill gates");
		expect(() => profileSearchQuerySchema.parse("   ")).toThrow();
		expect(() => profileSearchQuerySchema.parse("a".repeat(101))).toThrow();
	});

	test("accepts search results without profileId", () => {
		const response = {
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

		expect(profileSearchResponseSchema.parse(response)).toEqual(response);
		expect(() =>
			profileSearchResponseSchema.parse({
				...response,
				results: [{ ...response.results[0], profileId: "unused" }],
			}),
		).toThrow();
	});
});
