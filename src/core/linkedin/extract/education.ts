import type { Education } from "../../schema.ts";
import {
	sectionEntityTextRecords,
	type SectionPayload,
} from "./shared.ts";

const DATE_PATTERN = /(?:\b(?:19|20)\d{2}\b|\bpresent\b)/i;

/** Maps the rendered lines of one education card to the public fields. */
function parseEducation(text: string[]): Education | null {
	if (!text.length) return null;
	const dateIndex = text.findIndex((value) => DATE_PATTERN.test(value));
	const details = dateIndex >= 0 ? text.slice(0, dateIndex) : text;
	let degree: string | null = details[1] ?? null;
	let field: string | null = details[2] ?? null;

	if (degree && !field && degree.includes(",")) {
		const [degreeName, ...fieldParts] = degree.split(",");
		degree = degreeName?.trim() || null;
		field = fieldParts.join(",").trim() || null;
	}

	return {
		school: details[0] ?? null,
		degree,
		field,
		dateRange: dateIndex >= 0 ? (text[dateIndex] ?? null) : null,
	};
}

/** Extracts education cards from the education detail component. */
export function extractEducation(
	payload: SectionPayload,
): Education[] | null {
	try {
		const records = sectionEntityTextRecords(
			payload,
			[
				"educationDetailSection",
				"educationTopLevelSection",
				"profile.details.education",
			],
		);
		if (records === null) return null;
		return records
			.map((record) => parseEducation(record.text))
			.filter((item): item is Education => item !== null);
	} catch {
		return null;
	}
}
