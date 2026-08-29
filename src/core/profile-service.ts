import { extractAbout } from "./linkedin/extract/about.ts";
import { extractCertifications } from "./linkedin/extract/certifications.ts";
import { extractEducation } from "./linkedin/extract/education.ts";
import { extractExperience } from "./linkedin/extract/experience.ts";
import { extractIdentity } from "./linkedin/extract/identity.ts";
import { extractLanguages } from "./linkedin/extract/languages.ts";
import { extractSkills } from "./linkedin/extract/skills.ts";
import { profileSchema, type Profile } from "./schema.ts";

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
