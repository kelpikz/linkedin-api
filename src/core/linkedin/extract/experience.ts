import type { Experience } from "../../schema.ts";
import {
	sectionEntityTextRecords,
	type EntityTextRecord,
	type SectionPayload,
} from "./shared.ts";

const DATE_PATTERN = /(?:\b(?:19|20)\d{2}\b|\bpresent\b)/i;
const DURATION_ONLY_PATTERN = /^\d+\s+(?:(?:yr|yrs)(?:\s+\d+\s+(?:mo|mos))?|(?:mo|mos))$/i;
const EMPLOYMENT_PATTERN = /^(?:full-time|part-time|self-employed|freelance|contract|internship|apprenticeship|seasonal)$/i;
const LOCATION_PATTERN = /(?:,|\barea\b|\bregion\b|\bindia\b|\bunited states\b|\bunited kingdom\b|^remote$|^hybrid$|^on-site$)/i;

/** Splits LinkedIn's combined company and employment-type line. */
function splitCompany(value: string | undefined): {
	company: string | null;
	employmentType: string | null;
} {
	if (!value) return { company: null, employmentType: null };
	const parts = value.split(/\s+·\s+/);
	const possibleType = parts.at(-1);
	if (parts.length > 1 && possibleType && EMPLOYMENT_PATTERN.test(possibleType)) {
		return {
			company: parts.slice(0, -1).join(" · ") || null,
			employmentType: possibleType,
		};
	}
	return { company: value, employmentType: null };
}

/** Maps the rendered lines of one experience card to the public fields. */
function parseExperience(
	text: string[],
	parentText: string[],
): Experience | null {
	if (!text.length) return null;
	const dateIndex = text.findIndex((value) => DATE_PATTERN.test(value));
	const beforeDate = dateIndex >= 0 ? text.slice(0, dateIndex) : text;
	const inherited = splitCompany(parentText[0]);
	const direct = splitCompany(beforeDate[1]);
	const company = inherited.company ?? direct.company;
	const employmentType =
		parentText.find((value) => EMPLOYMENT_PATTERN.test(value)) ??
		inherited.employmentType ??
		direct.employmentType ??
		beforeDate.find(
			(value, index) => index > 1 && EMPLOYMENT_PATTERN.test(value),
		) ??
		null;
	const dateParts =
		dateIndex >= 0 ? (text[dateIndex]?.split(/\s+·\s+/) ?? []) : [];

	return {
		title: beforeDate[0] ?? null,
		company,
		employmentType,
		dateRange: dateParts[0] ?? null,
		duration: dateParts.slice(1).join(" · ") || null,
		location:
			dateIndex >= 0
				? (text.slice(dateIndex + 1).find((value) => LOCATION_PATTERN.test(value)) ??
					null)
				: null,
	};
}

/** Finds the next title followed by a date, with an optional employment type. */
function findNextRoleStart(text: string[], start: number): number {
	for (let index = start; index < text.length; index += 1) {
		if (DATE_PATTERN.test(text[index] ?? "")) continue;
		if (DATE_PATTERN.test(text[index + 1] ?? "")) return index;
		if (
			EMPLOYMENT_PATTERN.test(text[index + 1] ?? "") &&
			DATE_PATTERN.test(text[index + 2] ?? "")
		) {
			return index;
		}
	}
	return -1;
}

/** Splits a flat company card that contains two or more sequential roles. */
function parseGroupedExperience(text: string[]): Experience[] | null {
	if (!DURATION_ONLY_PATTERN.test(text[1] ?? "")) return null;
	const company = text[0] ?? null;
	const roles: Experience[] = [];
	let roleStart = findNextRoleStart(text, 2);

	while (roleStart >= 0) {
		const possibleType = text[roleStart + 1];
		const employmentType =
			possibleType && EMPLOYMENT_PATTERN.test(possibleType)
				? possibleType
				: null;
		const dateIndex = roleStart + (employmentType ? 2 : 1);
		const dateParts = text[dateIndex]?.split(/\s+·\s+/) ?? [];
		const nextRole = findNextRoleStart(text, dateIndex + 1);
		const tail = text.slice(dateIndex + 1, nextRole >= 0 ? nextRole : undefined);
		roles.push({
			title: text[roleStart] ?? null,
			company,
			employmentType,
			dateRange: dateParts[0] ?? null,
			duration: dateParts.slice(1).join(" · ") || null,
			location: tail.find((value) => LOCATION_PATTERN.test(value)) ?? null,
		});
		roleStart = nextRole;
	}

	return roles.length > 0 ? roles : null;
}

/** Maps a semantic card to one job, or several jobs for a grouped company. */
function parseExperienceRecord(record: EntityTextRecord): Experience[] {
	const grouped = parseGroupedExperience(record.text);
	if (grouped) return grouped;
	const item = parseExperience(record.text, record.parentText);
	return item ? [item] : [];
}

/** Extracts experience cards, including roles nested under one company. */
export function extractExperience(
	payload: SectionPayload,
): Experience[] | null {
	try {
		const records = sectionEntityTextRecords(
			payload,
			[
				"experienceDetailSection",
				"experienceTopLevelSection",
				"profile.details.experience",
			],
		);
		if (records === null) return null;
		const items = records.flatMap(parseExperienceRecord);
		const seen = new Set<string>();
		return items.filter((item) => {
			const key = JSON.stringify(item);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	} catch {
		return null;
	}
}
