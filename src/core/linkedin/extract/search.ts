import type { ProfileSearchResult } from "../../schema.ts";
import { parseRscChunks, type ChunkMap } from "../flight/index.ts";
import { largestProfileImage, walkResolved } from "./shared.ts";

interface SearchCandidate {
	name: string;
	vanityName: string;
}

/** Reads the identity fields from one typeahead action payload. */
function searchCandidate(value: unknown): SearchCandidate | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const candidate = (value as Record<string, unknown>).payload;
	if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
		return null;
	}

	const result = candidate as Record<string, unknown>;
	if (
		typeof result.vanityName !== "string" ||
		typeof result.searchTerm !== "string"
	) {
		return null;
	}

	const vanityName = result.vanityName.trim();
	const name = result.searchTerm.trim();
	return vanityName && name ? { name, vanityName } : null;
}

/** Finds the distinct profile actions inside one rendered result component. */
function componentCandidates(value: unknown, chunks: ChunkMap): SearchCandidate[] {
	const candidates = new Map<string, SearchCandidate>();
	walkResolved(value, chunks, (child) => {
		const candidate = searchCandidate(child);
		if (candidate) candidates.set(candidate.vanityName.toLowerCase(), candidate);
	});
	return [...candidates.values()];
}

export function extractSearchResults(payload: string): ProfileSearchResult[] {
	const chunks = parseRscChunks(payload);
	const results = new Map<string, ProfileSearchResult>();

	/** Keeps the first match, but upgrades it when a component supplies an image. */
	function addResult(
		candidate: SearchCandidate,
		profileImageUrl: string | null,
	): void {
		const key = candidate.vanityName.toLowerCase();
		const previous = results.get(key);
		if (previous && !profileImageUrl) return;
		results.set(key, {
			...candidate,
			url: `https://www.linkedin.com/in/${encodeURIComponent(candidate.vanityName)}/`,
			profileImageUrl,
		});
	}

	// A result card contains one profile action and its matching image node.
	for (const chunk of chunks.values()) {
		walkResolved(chunk, chunks, (item) => {
			if (!Array.isArray(item) || item[0] !== "$") return;
			const candidates = componentCandidates(item, chunks);
			if (candidates.length !== 1) return;
			addResult(
				candidates[0] as SearchCandidate,
				largestProfileImage({ chunks, root: item, scoped: true }),
			);
		});
	}

	// Keep valid action payloads even when LinkedIn omits the image component.
	for (const chunk of chunks.values()) {
		walkResolved(chunk, chunks, (item) => {
			const candidate = searchCandidate(item);
			if (candidate) addResult(candidate, null);
		});
	}

	return [...results.values()];
}
