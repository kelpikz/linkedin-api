import { describe, expect, test } from "bun:test";
import { extractAbout } from "../src/core/linkedin/extract/about.ts";
import { extractCertifications } from "../src/core/linkedin/extract/certifications.ts";
import { extractEducation } from "../src/core/linkedin/extract/education.ts";
import { extractExperience } from "../src/core/linkedin/extract/experience.ts";
import {
	extractIdentity,
	extractProfileImageFromHtml,
} from "../src/core/linkedin/extract/identity.ts";
import { extractLanguages } from "../src/core/linkedin/extract/languages.ts";
import { extractSkills } from "../src/core/linkedin/extract/skills.ts";
import {
	certificationPayload,
	combinedProfileCardsPayload,
	detailShellPayload,
	educationPayload,
	emptyCertificationPayload,
	emptySkillsPayload,
	experiencePayload,
	groupedExperiencePayload,
	languagesPayload,
	pageHtml,
	pagePayload,
	plainLanguagesPage,
	plainSkillsPage,
	skillsPayload,
} from "./profile-fixtures.ts";

describe("profile extractors", () => {
	test("extracts identity and About from the page", () => {
		expect(extractIdentity(pagePayload)).toEqual({
			name: "Satya Nadella",
			headline: "Chairman and CEO at Microsoft",
			location: "Redmond, Washington, United States",
			profileImageUrl:
				"https://media.licdn.com/profile-displayphoto-shrink_large.jpg",
		});
		expect(extractAbout(pagePayload)).toBe(
			"As chairman and CEO of Microsoft, I work to empower every person and organization.",
		);
	});

	test("uses the largest high-priority profile image from page HTML", () => {
		expect(extractProfileImageFromHtml(pageHtml)).toBe(
			"https://media.licdn.com/profile-displayphoto-owner-large.jpg?expires=1&signature=large",
		);
	});

	test("extracts standalone and nested experience roles", () => {
		expect(extractExperience(experiencePayload)).toEqual([
			{
				title: "Chairman and CEO",
				company: "Microsoft",
				employmentType: "Full-time",
				dateRange: "Feb 2014 - Present",
				duration: "12 yrs 7 mos",
				location: "Greater Seattle Area",
			},
			{
				title: "Executive Vice President",
				company: "Microsoft",
				employmentType: "Full-time",
				dateRange: "Jul 2013 - Feb 2014",
				duration: "8 mos",
				location: "Redmond, Washington, United States",
			},
			{
				title: "Member Board Of Trustees",
				company: "University of Chicago",
				employmentType: null,
				dateRange: "2018 – Present",
				duration: null,
				location: null,
			},
		]);
	});

	test("combines paged experience and splits flat grouped roles", () => {
		expect(
			extractExperience([experiencePayload, groupedExperiencePayload]),
		).toEqual([
			expect.objectContaining({
				title: "Chairman and CEO",
				company: "Microsoft",
			}),
			expect.objectContaining({
				title: "Executive Vice President",
				company: "Microsoft",
			}),
			expect.objectContaining({
				title: "Member Board Of Trustees",
				company: "University of Chicago",
			}),
			{
				title: "Co-chair",
				company: "Gates Foundation",
				employmentType: null,
				dateRange: "Jan 2024 - Present",
				duration: "2 yrs",
				location: null,
			},
			{
				title: "Board Member",
				company: "Gates Foundation",
				employmentType: null,
				dateRange: "Jan 2023 - Dec 2023",
				duration: "1 yr",
				location: null,
			},
		]);
	});

	test("extracts education, certifications, skills, and languages", () => {
		expect(extractEducation(educationPayload)).toEqual([
			{
				school: "Manipal Institute of Technology",
				degree: "Bachelor of Engineering",
				field: "Electrical Engineering",
				dateRange: "1984 – 1988",
			},
		]);
		expect(extractCertifications(certificationPayload)).toEqual([
			{
				name: "Cloud Architecture",
				issuer: "Microsoft",
				issueDate: "January 2026",
			},
		]);
		expect(extractSkills(skillsPayload)).toEqual([
			"Leadership",
			"Cloud Computing",
		]);
		expect(extractLanguages(languagesPayload)).toEqual([
			{ name: "English", proficiency: "Native or bilingual proficiency" },
			{ name: "Hindi", proficiency: "Elementary proficiency" },
		]);
	});

	test("combines language cards with plain-text pagination pages", () => {
		expect(extractLanguages([languagesPayload, plainLanguagesPage])).toEqual([
			{ name: "English", proficiency: "Native or bilingual proficiency" },
			{ name: "Hindi", proficiency: "Elementary proficiency" },
			{ name: "Spanish", proficiency: "Professional working proficiency" },
			{ name: "French", proficiency: null },
		]);
	});

	test("extracts skill names from a headingless pagination page", () => {
		expect(extractSkills([detailShellPayload, plainSkillsPage])).toEqual([
			"Leadership",
			"Product Management",
			"Strategy",
			"Cloud Computing",
		]);
	});

	test("scopes education and certifications inside combined profile cards", () => {
		expect(extractEducation(combinedProfileCardsPayload)).toEqual([
			{
				school: "Manipal Institute of Technology",
				degree: "Bachelor of Engineering",
				field: "Electrical Engineering",
				dateRange: "1984 – 1988",
			},
		]);
		expect(extractCertifications(combinedProfileCardsPayload)).toEqual([
			{
				name: "Azure Fundamentals",
				issuer: "Microsoft",
				issueDate: "January 2026",
			},
		]);
		expect(extractCertifications(emptyCertificationPayload)).toEqual([]);
	});

	test("returns null instead of throwing on malformed payloads", () => {
		for (const extract of [
			extractIdentity,
			extractAbout,
			extractExperience,
			extractEducation,
			extractCertifications,
			extractSkills,
			extractLanguages,
		]) {
			expect(extract("not Flight data")).toBeNull();
		}
	});

	test("returns an empty list for an explicit LinkedIn empty state", () => {
		expect(extractSkills(emptySkillsPayload)).toEqual([]);
	});
});
