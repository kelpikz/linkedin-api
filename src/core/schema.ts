import { z } from "zod";

const nullableText = z.string().nullable();
const nullableUrl = z.string().url().nullable();

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
	})
	.strict();

export type Identity = z.infer<typeof identitySchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Certification = z.infer<typeof certificationSchema>;
export type Language = z.infer<typeof languageSchema>;
export type Profile = z.infer<typeof profileSchema>;
