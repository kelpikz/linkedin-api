import { collectVisibleText } from "../flight/index.ts";
import {
	entityTextRecords,
	isEmptySection,
	readSectionGraphs,
	type SectionPayload,
} from "./shared.ts";

const SKILL_IDENTIFIERS = [
	"profileSkillDetailsMain",
	"skillsSection",
	"profile.details.skills",
] as const;
const SKILL_UI = /^(?:skills|top skills|see all \d+ skills|\d+\s+endorsements?|\d+\s+experiences?\b.*|endorsed by\b.*)$/i;
const EXPERIENCE_ASSOCIATION = /\b(?:associate|chairperson|consultant|coordinator|developer|director|engineer|founder|intern|lead|manager|member|officer|president|specialist|treasurer)\s+at\s+/i;

/** Removes labels and role associations surrounding rendered skill names. */
function skillNames(text: readonly string[]): string[] {
	return text.filter(
		(value) =>
			value.length > 0 &&
			!SKILL_UI.test(value) &&
			!EXPERIENCE_ASSOCIATION.test(value),
	);
}

/** Extracts every skill name and removes endorsement labels. */
export function extractSkills(payload: SectionPayload): string[] | null {
	try {
		const graphs = readSectionGraphs(payload, SKILL_IDENTIFIERS, true);
		if (!graphs.length) return null;
		const skills: string[] = [];
		let recognized = false;

		for (const [pageIndex, graph] of graphs.entries()) {
			const records = entityTextRecords(graph);
			if (records) {
				recognized = true;
				skills.push(...skillNames(records.flatMap((record) => record.text)));
				continue;
			}
			if (isEmptySection(graph)) {
				recognized = true;
				continue;
			}

			const visible = collectVisibleText(graph.root, graph.chunks);
			const hasHeading = visible[0] === "Skills";
			if (pageIndex > 0 || hasHeading) {
				recognized = true;
				skills.push(...skillNames(hasHeading ? visible.slice(1) : visible));
			}
		}

		return recognized ? [...new Set(skills)] : null;
	} catch {
		return null;
	}
}
