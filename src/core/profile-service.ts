import { extractAbout } from "./linkedin/extract/about.ts";
import { extractCertifications } from "./linkedin/extract/certifications.ts";
import { extractEducation } from "./linkedin/extract/education.ts";
import { extractExperience } from "./linkedin/extract/experience.ts";
import { extractIdentity } from "./linkedin/extract/identity.ts";
import { extractLanguages } from "./linkedin/extract/languages.ts";
import { extractSearchResults } from "./linkedin/extract/search.ts";
import { extractSkills } from "./linkedin/extract/skills.ts";
import { fetchProfileSearch } from "./linkedin/endpoints/search.ts";
import {
	createLinkedInHttp,
	loadLinkedInConfig,
	type LinkedInHttp,
} from "./linkedin/http.ts";
import {
	profileSchema,
	profileSearchQuerySchema,
	profileSearchResponseSchema,
	type Profile,
	type ProfileSearchResponse,
} from "./schema.ts";

export async function getProfile(sourceUrl: string): Promise<Profile> {
	const identity = extractIdentity(null);
	const profile = {
		sourceUrl,
		name: identity?.name ?? null,
		headline: identity?.headline ?? null,
		location: identity?.location ?? null,
		about: extractAbout(null),
		profileImageUrl: identity?.profileImageUrl ?? null,
		experience: extractExperience(null),
		education: extractEducation(null),
		skills: extractSkills(null),
		certifications: extractCertifications(null),
		languages: extractLanguages(null),
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
