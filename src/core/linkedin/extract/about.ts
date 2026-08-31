import { readSection, sectionText } from "./shared.ts";

/** Extracts the longest rendered text value from the About component. */
export function extractAbout(payload: string | null): string | null {
	try {
		const graph = readSection(payload, ["aboutSection"]);
		if (!graph) return null;
		return (
			sectionText(graph, new Set(["About"]))
				.filter((text) => text.length > 1)
				.sort((left, right) => right.length - left.length)[0] ?? null
		);
	} catch {
		return null;
	}
}
