import type { ProfileSearchResult } from "../../schema.ts";
import { parseRscChunks, walk } from "../flight/index.ts";

export function extractSearchResults(payload: string): ProfileSearchResult[] {
	const chunks = parseRscChunks(payload);
	const results = new Map<string, ProfileSearchResult>();

	for (const chunk of chunks.values()) {
		walk(chunk, (item) => {
			if (!item || typeof item !== "object" || Array.isArray(item)) return;
			const candidate = (item as Record<string, unknown>).payload;
			if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
				return;
			}

			const result = candidate as Record<string, unknown>;
			if (
				typeof result.vanityName !== "string" ||
				typeof result.searchTerm !== "string"
			) {
				return;
			}

			const vanityName = result.vanityName.trim();
			const name = result.searchTerm.trim();
			if (!vanityName || !name) return;

			results.set(vanityName.toLowerCase(), {
				name,
				vanityName,
				url: `https://www.linkedin.com/in/${encodeURIComponent(vanityName)}/`,
			});
		});
	}

	return [...results.values()];
}
