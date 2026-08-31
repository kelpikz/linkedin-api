import {
	collectVisibleText,
	parseRscChunks,
	resolveReference,
	type ChunkMap,
} from "../flight/index.ts";

export interface SectionGraph {
	chunks: ChunkMap;
	root: unknown;
	scoped: boolean;
}

export interface EntityTextRecord {
	text: string[];
	parentText: string[];
}

export type SectionPayload = string | readonly string[] | null;

/** Walks an object graph and follows Flight references along the way. */
export function walkResolved(
	value: unknown,
	chunks: ChunkMap,
	visit: (value: unknown) => void,
	seenObjects = new Set<object>(),
	seenReferences = new Set<string>(),
): void {
	if (typeof value === "string") {
		const resolved = resolveReference(value, chunks);
		if (resolved !== value && !seenReferences.has(value)) {
			seenReferences.add(value);
			walkResolved(resolved, chunks, visit, seenObjects, seenReferences);
		}
		return;
	}

	visit(value);
	if (value === null || typeof value !== "object") return;
	if (seenObjects.has(value)) return;
	seenObjects.add(value);

	for (const child of Object.values(value)) {
		walkResolved(child, chunks, visit, seenObjects, seenReferences);
	}
}

/** Finds a named profile component or, for pager output, exposes all chunks. */
export function readSection(
	payload: string | null,
	identifiers: readonly string[],
	allowUnscoped = false,
): SectionGraph | null {
	if (!payload) return null;
	const chunks = parseRscChunks(payload);
	let root: unknown;

	for (const chunk of chunks.values()) {
		walkResolved(chunk, chunks, (value) => {
			if (root || !value || typeof value !== "object" || Array.isArray(value)) {
				return;
			}
			const identifier = (value as Record<string, unknown>)
				.observabilityIdentifier;
			if (
				typeof identifier === "string" &&
				identifiers.some((candidate) => identifier.endsWith(candidate))
			) {
				root = value;
			}
		});
		if (root) return { chunks, root, scoped: true };
	}

	if (allowUnscoped && chunks.size > 0) {
		return { chunks, root: [...chunks.values()], scoped: false };
	}
	return null;
}

/** Reads each initial or paged response as its own resolved section graph. */
export function readSectionGraphs(
	payload: SectionPayload,
	identifiers: readonly string[],
	allowUnscoped = false,
): SectionGraph[] {
	const pages = typeof payload === "string" ? [payload] : (payload ?? []);
	return pages
		.map((page) => readSection(page, identifiers, allowUnscoped))
		.filter((graph): graph is SectionGraph => graph !== null);
}

/** Detects LinkedIn's rendered empty-state response for a profile section. */
export function isEmptySection(graph: SectionGraph): boolean {
	return collectVisibleText(graph.root, graph.chunks).some((text) =>
		text.toLowerCase().startsWith("nothing to see"),
	);
}

/** Returns rendered text for React elements with one of the requested tags. */
export function elementText(
	graph: SectionGraph,
	tags: ReadonlySet<string>,
): string[] {
	const found: string[] = [];
	walkResolved(graph.root, graph.chunks, (value) => {
		if (
			Array.isArray(value) &&
			value[0] === "$" &&
			typeof value[1] === "string" &&
			tags.has(value[1])
		) {
			found.push(...collectVisibleText(value, graph.chunks));
		}
	});
	return [...new Set(found)];
}

/** Returns the largest rendition from the top card's primary image node. */
export function largestProfileImage(graph: SectionGraph): string | null {
	const candidates: Array<{ area: number; priority: number; url: string }> = [];

	/** Adds each rendition from one LinkedIn image render payload. */
	function addImagePayload(value: unknown, priority: number): void {
		if (!value || typeof value !== "object" || Array.isArray(value)) return;
		const object = value as Record<string, unknown>;
		const rootUrl = object.rootUrl;
		const renditions = object.imageRenditions;
		if (
			typeof rootUrl !== "string" ||
			!rootUrl.includes("profile-displayphoto") ||
			!Array.isArray(renditions)
		) {
			return;
		}

		for (const rendition of renditions) {
			if (!rendition || typeof rendition !== "object") continue;
			const item = rendition as Record<string, unknown>;
			const suffix = item.suffixUrl;
			const area = Number(item.width || 0) * Number(item.height || 0);
			if (typeof suffix === "string") {
				candidates.push({ area, priority, url: `${rootUrl}${suffix}` });
			}
		}
	}

	walkResolved(graph.root, graph.chunks, (value) => {
		if (
			Array.isArray(value) &&
			value[0] === "$" &&
			value[3] &&
			typeof value[3] === "object"
		) {
			const props = value[3] as Record<string, unknown>;
			const renderPayload = resolveReference(props.renderPayload, graph.chunks);
			const priority =
				props.fetchPriority === "high"
					? 2
					: props.shouldUseImagePreload === true
						? 1
						: 0;
			if (priority > 0) addImagePayload(renderPayload, priority);
		}

		addImagePayload(value, 0);
	});

	return (
		candidates.sort(
			(left, right) =>
				right.priority - left.priority ||
				right.area - left.area,
		)[0]?.url ?? null
	);
}

/** Checks whether a resolved graph contains the exact object or array target. */
function containsNode(
	root: unknown,
	target: object,
	chunks: ChunkMap,
): boolean {
	let found = false;
	walkResolved(root, chunks, (value) => {
		if (value === target && value !== root) found = true;
	});
	return found;
}

/** Removes text supplied by nested role components from their parent text. */
function ownText(
	node: unknown,
	descendants: object[],
	chunks: ChunkMap,
): string[] {
	const nested = new Set(
		descendants.flatMap((child) => collectVisibleText(child, chunks)),
	);
	return collectVisibleText(node, chunks).filter((text) => !nested.has(text));
}

/**
 * Reads semantic detail cards, falling back to UUID-keyed cards in unscoped
 * pager output. Nested experience roles also inherit their company text.
 */
export function entityTextRecords(
	graph: SectionGraph,
): EntityTextRecord[] | null {
	const semanticNodes: object[] = [];
	const uuidNodes: object[] = [];
	const uuidKey =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

	walkResolved(graph.root, graph.chunks, (value) => {
		if (!value || typeof value !== "object") return;
		if (!Array.isArray(value)) return;
		if (value[0] !== "$" || !value[3] || typeof value[3] !== "object") {
			return;
		}
		const componentKey = (value[3] as Record<string, unknown>).componentKey;
		if (typeof componentKey !== "string") return;
		if (componentKey.includes("entity-collection-item")) {
			semanticNodes.push(value);
		} else if (
			uuidKey.test(componentKey) &&
			collectVisibleText(value, graph.chunks).length > 0
		) {
			uuidNodes.push(value);
		}
	});

	const nodes = semanticNodes.length > 0 ? semanticNodes : uuidNodes;
	if (!nodes.length) return null;
	const leaves = nodes.filter(
		(node) =>
			!nodes.some(
				(candidate) =>
					candidate !== node &&
					containsNode(node, candidate, graph.chunks),
			),
	);

	return leaves.map((node) => {
		const parents = nodes
			.filter(
				(candidate) =>
					candidate !== node && containsNode(candidate, node, graph.chunks),
			)
			.sort(
				(left, right) =>
					collectVisibleText(left, graph.chunks).length -
					collectVisibleText(right, graph.chunks).length,
			);
		const parent = parents[0];
		const descendants = parent
			? nodes.filter(
					(candidate) =>
						candidate !== parent &&
						containsNode(parent, candidate, graph.chunks),
				)
			: [];

		return {
			text: collectVisibleText(node, graph.chunks),
			parentText: parent
				? ownText(parent, descendants, graph.chunks)
				: [],
		};
	});
}

/** Combines and deduplicates semantic cards across initial and paged responses. */
export function sectionEntityTextRecords(
	payload: SectionPayload,
	identifiers: readonly string[],
): EntityTextRecord[] | null {
	const graphs = readSectionGraphs(payload, identifiers, true);
	if (!graphs.length) return null;

	const records: EntityTextRecord[] = [];
	let foundEmptySection = false;
	for (const graph of graphs) {
		const pageRecords = entityTextRecords(graph);
		if (pageRecords) {
			records.push(...pageRecords);
			continue;
		}
		if (
			isEmptySection(graph) ||
			(graph.scoped && collectVisibleText(graph.root, graph.chunks).length === 0)
		) {
			foundEmptySection = true;
		}
	}

	if (records.length > 0) {
		const seen = new Set<string>();
		return records.filter((record) => {
			const key = JSON.stringify(record);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}
	return foundEmptySection ? [] : null;
}

/** Returns visible section text with headings removed. */
export function sectionText(
	graph: SectionGraph,
	headings: ReadonlySet<string>,
): string[] {
	return collectVisibleText(graph.root, graph.chunks).filter(
		(text) => !headings.has(text),
	);
}
