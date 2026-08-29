export type ChunkMap = Map<string, unknown>;

const REFERENCE_PATTERN = /^\$L?([0-9a-f]+)(?::(.+))?$/i;

export function parseRscChunks(payload: string): ChunkMap {
	const chunks: ChunkMap = new Map();

	for (const line of payload.split(/\r?\n/)) {
		const match = line.match(/^([0-9a-f]+):(.*)$/i);
		if (!match) continue;

		const [, id, encoded] = match;
		if (!id || !encoded || encoded.startsWith("I[") || encoded.startsWith("E{")) {
			continue;
		}

		try {
			chunks.set(id.toLowerCase(), JSON.parse(encoded));
		} catch {
			// Flight streams also contain records that are not JSON models.
		}
	}

	return chunks;
}

function resolvePath(value: unknown, path: string): unknown {
	let current = value;
	for (const part of path.split(":")) {
		if (part === "props" && Array.isArray(current) && current[0] === "$") {
			current = current[3];
			continue;
		}
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

export function resolveReference(value: unknown, chunks: ChunkMap): unknown {
	if (typeof value !== "string") return value;
	const match = value.match(REFERENCE_PATTERN);
	if (!match?.[1]) return value;
	const chunk = chunks.get(match[1].toLowerCase());
	return match[2] ? resolvePath(chunk, match[2]) : chunk;
}

export function walk(
	value: unknown,
	visit: (value: unknown) => void,
	seen = new Set<object>(),
): void {
	visit(value);
	if (value === null || typeof value !== "object") return;
	if (seen.has(value as object)) return;
	seen.add(value as object);

	if (Array.isArray(value)) {
		for (const item of value) walk(item, visit, seen);
		return;
	}

	for (const child of Object.values(value as Record<string, unknown>)) {
		walk(child, visit, seen);
	}
}

function flattenRenderedText(
	value: unknown,
	chunks: ChunkMap,
	depth = 0,
): string[] {
	if (depth > 100 || value === null || value === undefined) return [];
	const resolved = resolveReference(value, chunks);
	if (resolved !== value) {
		return flattenRenderedText(resolved, chunks, depth + 1);
	}
	if (typeof value === "string") {
		if (value.startsWith("$") || value === " ") return [];
		return [value.trim()].filter(Boolean);
	}
	if (!Array.isArray(value)) {
		if (typeof value !== "object") return [];
		const object = value as Record<string, unknown>;
		if (object.textProps && typeof object.textProps === "object") {
			return flattenRenderedText(
				(object.textProps as Record<string, unknown>).children,
				chunks,
				depth + 1,
			);
		}
		return [
			...flattenRenderedText(object.children, chunks, depth + 1),
			...flattenRenderedText(object.initialContent, chunks, depth + 1),
		];
	}
	if (value[0] === "$") {
		const props = value[3] as Record<string, unknown> | undefined;
		if (props?.textProps && typeof props.textProps === "object") {
			return flattenRenderedText(
				(props.textProps as Record<string, unknown>).children,
				chunks,
				depth + 1,
			);
		}
		return flattenRenderedText(props?.children, chunks, depth + 1);
	}
	return value.flatMap((item) => flattenRenderedText(item, chunks, depth + 1));
}

export function collectVisibleText(root: unknown, chunks: ChunkMap): string[] {
	const found: string[] = [];
	const visitedRefs = new Set<string>();

	function collect(value: unknown, depth = 0): void {
		if (depth > 30 || value === null || value === undefined) return;
		if (typeof value === "string" && REFERENCE_PATTERN.test(value)) {
			if (visitedRefs.has(value)) return;
			visitedRefs.add(value);
			collect(resolveReference(value, chunks), depth + 1);
			return;
		}
		if (Array.isArray(value)) {
			if (value[0] === "$") {
				const props = value[3] as Record<string, unknown> | undefined;
				if (props?.textProps && typeof props.textProps === "object") {
					found.push(
						...flattenRenderedText(
							(props.textProps as Record<string, unknown>).children,
							chunks,
						),
					);
				} else {
					found.push(...flattenRenderedText(props?.children, chunks));
				}
				return;
			}
			for (const item of value) collect(item, depth + 1);
			return;
		}
		if (typeof value !== "object") return;
		const object = value as Record<string, unknown>;
		if (object.textProps && typeof object.textProps === "object") {
			found.push(
				...flattenRenderedText(
					(object.textProps as Record<string, unknown>).children,
					chunks,
				),
			);
		}
		if ("children" in object) collect(object.children, depth + 1);
		if ("initialContent" in object) collect(object.initialContent, depth + 1);
	}

	collect(root);
	return [
		...new Set(
			found
				.map((text) => text.replace(/\s+/g, " ").trim())
				.filter(Boolean),
		),
	];
}
