import { extractAbout } from "./linkedin/extract/about.ts";
import { extractCertifications } from "./linkedin/extract/certifications.ts";
import { extractEducation } from "./linkedin/extract/education.ts";
import { extractExperience } from "./linkedin/extract/experience.ts";
import {
	extractIdentity,
	extractProfileImageFromHtml,
} from "./linkedin/extract/identity.ts";
import { extractLanguages } from "./linkedin/extract/languages.ts";
import { extractSearchResults } from "./linkedin/extract/search.ts";
import { extractSkills } from "./linkedin/extract/skills.ts";
import { fetchProfilePayloads } from "./linkedin/fetch-profile.ts";
import { fetchProfileSearch } from "./linkedin/endpoints/search.ts";
import {
	createLinkedInHttp,
	loadLinkedInConfig,
	type LinkedInHttp,
} from "./linkedin/http.ts";
import { parseProfileUrl } from "./linkedin/profile-url.ts";
import {
	PROFILE_DETAIL_SECTIONS,
	profileSchema,
	profileDetailSectionSchema,
	profileSearchQuerySchema,
	profileSearchResponseSchema,
	type Profile,
	type ProfileDetailSection,
	type ProfileSection,
	type ProfileSearchResponse,
} from "./schema.ts";

export interface GetProfileOptions {
	http?: LinkedInHttp;
	sections?: readonly ProfileDetailSection[];
	concurrency?: number;
	timeoutMs?: number;
}

/**
 * Validates a profile URL, fetches the requested payloads, and combines every
 * extractor result into the public response contract.
 */
export async function getProfile(
	inputUrl: string,
	options: GetProfileOptions = {},
): Promise<Profile> {
	const { vanityName, sourceUrl } = parseProfileUrl(inputUrl);
	const requestedSections = [
		...new Set(
			profileDetailSectionSchema
				.array()
				.parse(options.sections ?? PROFILE_DETAIL_SECTIONS),
		),
	];
	const client = options.http ?? createLinkedInHttp(loadLinkedInConfig());
	const payloads = await fetchProfilePayloads(client, vanityName, {
		sections: requestedSections,
		concurrency: options.concurrency,
		timeoutMs: options.timeoutMs,
	});
	const flightIdentity = extractIdentity(payloads.page);
	const htmlProfileImage = extractProfileImageFromHtml(payloads.html);
	const identity = flightIdentity
		? {
				...flightIdentity,
				profileImageUrl:
					htmlProfileImage ?? flightIdentity.profileImageUrl,
			}
		: htmlProfileImage
			? {
					name: null,
					headline: null,
					location: null,
					profileImageUrl: htmlProfileImage,
				}
			: null;
	const about = extractAbout(payloads.page);
	const experience = requestedSections.includes("experience")
		? extractExperience(payloads.sections.experience)
		: null;
	const education = requestedSections.includes("education")
		? extractEducation(payloads.sections.education)
		: null;
	const skills = requestedSections.includes("skills")
		? extractSkills(payloads.sections.skills)
		: null;
	const certifications = requestedSections.includes("certifications")
		? extractCertifications(payloads.sections.certifications)
		: null;
	const languages = requestedSections.includes("languages")
		? extractLanguages(payloads.sections.languages)
		: null;
	const extractedValues = new Map<ProfileSection, unknown>([
		["identity", identity],
		["about", about],
		["experience", experience],
		["education", education],
		["skills", skills],
		["certifications", certifications],
		["languages", languages],
	]);
	const activeSections: ProfileSection[] = [
		"identity",
		"about",
		...requestedSections,
	];
	const extracted = activeSections.filter(
		(section) => extractedValues.get(section) !== null,
	);
	const missing = activeSections.filter(
		(section) => extractedValues.get(section) === null,
	);
	const profile = {
		sourceUrl,
		name: identity?.name ?? null,
		headline: identity?.headline ?? null,
		location: identity?.location ?? null,
		about,
		profileImageUrl: identity?.profileImageUrl ?? null,
		experience,
		education,
		skills,
		certifications,
		languages,
		meta: { extracted, missing },
	};

	return profileSchema.parse(profile);
}

export async function searchProfiles(
	query: string,
	http?: LinkedInHttp,
): Promise<ProfileSearchResponse> {
	const normalizedQuery = profileSearchQuerySchema.parse(query);
	const client = http ?? createLinkedInHttp(loadLinkedInConfig());
	const payload = await fetchProfileSearch(client, normalizedQuery);
	const results = extractSearchResults(payload);

	return profileSearchResponseSchema.parse({
		query: normalizedQuery,
		count: results.length,
		results,
	});
}
