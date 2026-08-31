import { z } from "zod";

const nullableText = z.string().nullable();
const nullableUrl = z.string().url().nullable();

export const PROFILE_DETAIL_SECTIONS = [
	"experience",
	"education",
	"skills",
	"certifications",
	"languages",
] as const;

export const PROFILE_SECTIONS = [
	"identity",
	"about",
	...PROFILE_DETAIL_SECTIONS,
] as const;

export const profileDetailSectionSchema = z.enum(PROFILE_DETAIL_SECTIONS);
export const profileSectionSchema = z.enum(PROFILE_SECTIONS);

export const identitySchema = z
	.object({
		name: nullableText,
		headline: nullableText,
		location: nullableText,
		profileImageUrl: nullableUrl,
	})
	.strict();

export const experienceSchema = z
	.object({
		title: nullableText,
		company: nullableText,
		employmentType: nullableText,
		dateRange: nullableText,
		duration: nullableText,
		location: nullableText,
	})
	.strict();

export const educationSchema = z
	.object({
		school: nullableText,
		degree: nullableText,
		field: nullableText,
		dateRange: nullableText,
	})
	.strict();

export const certificationSchema = z
	.object({
		name: nullableText,
		issuer: nullableText,
		issueDate: nullableText,
	})
	.strict();

export const languageSchema = z
	.object({
		name: nullableText,
		proficiency: nullableText,
	})
	.strict();

export const profileMetaSchema = z
	.object({
		extracted: z.array(profileSectionSchema),
		missing: z.array(profileSectionSchema),
	})
	.strict();

export const profileSchema = z
	.object({
		sourceUrl: z.string().url(),
		name: nullableText,
		headline: nullableText,
		location: nullableText,
		about: nullableText,
		profileImageUrl: nullableUrl,
		experience: z.array(experienceSchema).nullable(),
		education: z.array(educationSchema).nullable(),
		skills: z.array(z.string()).nullable(),
		certifications: z.array(certificationSchema).nullable(),
		languages: z.array(languageSchema).nullable(),
		meta: profileMetaSchema,
	})
	.strict();

export const profileSearchQuerySchema = z.string().trim().min(1).max(100);

export const profileSearchResultSchema = z
	.object({
		name: z.string().min(1),
		vanityName: z.string().min(1),
		url: z.string().url(),
		profileImageUrl: nullableUrl,
	})
	.strict();

export const profileSearchResponseSchema = z
	.object({
		query: profileSearchQuerySchema,
		count: z.number().int().nonnegative(),
		results: z.array(profileSearchResultSchema),
	})
	.strict();

export type Identity = z.infer<typeof identitySchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Certification = z.infer<typeof certificationSchema>;
export type Language = z.infer<typeof languageSchema>;
export type ProfileMeta = z.infer<typeof profileMetaSchema>;
export type ProfileDetailSection = z.infer<typeof profileDetailSectionSchema>;
export type ProfileSection = z.infer<typeof profileSectionSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type ProfileSearchResult = z.infer<typeof profileSearchResultSchema>;
export type ProfileSearchResponse = z.infer<typeof profileSearchResponseSchema>;
