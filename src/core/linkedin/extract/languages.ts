import type { Language } from "../../schema.ts";
import { collectVisibleText } from "../flight/index.ts";
import {
	entityTextRecords,
	isEmptySection,
	readSectionGraphs,
	type SectionPayload,
} from "./shared.ts";

const PROFICIENCY_PATTERN = /^(?:elementary|limited working|professional working|full professional|native or bilingual) proficiency$/i;

const LANGUAGE_IDENTIFIERS = [
	"languageDetailSection",
	"languagesDetailSection",
	"profileLanguageDetailsMain",
	"languageTopLevelSection",
	"profile.details.languages",
] as const;

/** Adds alternating language names and optional proficiency labels. */
function appendLanguages(text: readonly string[], languages: Language[]): void {
	for (let index = 0; index < text.length; index += 1) {
		const name = text[index];
		if (!name || name === "Languages" || PROFICIENCY_PATTERN.test(name)) continue;
		const next = text[index + 1];
		const proficiency = next && PROFICIENCY_PATTERN.test(next) ? next : null;
		if (proficiency) index += 1;
		languages.push({ name, proficiency });
	}
}

/** Extracts language names and proficiency labels when LinkedIn sends them. */
export function extractLanguages(payload: SectionPayload): Language[] | null {
	try {
		const graphs = readSectionGraphs(payload, LANGUAGE_IDENTIFIERS, true);
		if (!graphs.length) return null;
		const languages: Language[] = [];
		let recognized = false;

		for (const graph of graphs) {
			const records = entityTextRecords(graph);
			if (records) {
				recognized = true;
				for (const record of records) appendLanguages(record.text, languages);
				continue;
			}
			if (isEmptySection(graph)) {
				recognized = true;
				continue;
			}

			const visible = collectVisibleText(graph.root, graph.chunks);
			const heading = visible.indexOf("Languages");
			if (heading === 0) {
				recognized = true;
				appendLanguages(visible.slice(1), languages);
			}
		}

		if (!recognized) return null;
		const seen = new Set<string>();
		return languages.filter((language) => {
			const key = JSON.stringify(language);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	} catch {
		return null;
	}
}
