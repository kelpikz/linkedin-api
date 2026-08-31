import type { Certification } from "../../schema.ts";
import {
	sectionEntityTextRecords,
	type SectionPayload,
} from "./shared.ts";

/** Extracts license and certification cards from their detail component. */
export function extractCertifications(
	payload: SectionPayload,
): Certification[] | null {
	try {
		const records = sectionEntityTextRecords(
			payload,
			[
				"certificationDetailSection",
				"certificationTopLevelSection",
				"profile.details.certifications",
			],
		);
		if (records === null) return null;
		return records
			.filter((record) => record.text.length > 0)
			.map((record) => ({
				name: record.text[0] ?? null,
				issuer: record.text[1] ?? null,
				issueDate:
					record.text[2]?.replace(/^Issued\s+/i, "").trim() || null,
			}));
	} catch {
		return null;
	}
}
