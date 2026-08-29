import type { LinkedInProfile, ProfileSection, SearchSuggestion } from "./types.ts";

type ChunkMap = Map<string, unknown>;

const REFERENCE_PATTERN = /^\$L?([0-9a-f]+)(?::(.+))?$/i;
const UI_TEXT = new Set([
  "About",
  "Activity",
  "Contact info",
  "Education",
  "Experience",
  "Featured",
  "Highlights",
  "Licenses & certifications",
  "More",
  "Message",
  "Skills",
  "Top skills",
]);

export function parseRscChunks(payload: string): ChunkMap {
  const chunks: ChunkMap = new Map();

  for (const line of payload.split(/\r?\n/)) {
    const match = line.match(/^([0-9a-f]+):(.*)$/i);
    if (!match) continue;

    const [, id, encoded] = match;
    if (!encoded || encoded.startsWith("I[") || encoded.startsWith("E{")) continue;

    try {
      chunks.set(id.toLowerCase(), JSON.parse(encoded));
    } catch {
      // Flight streams may contain records that are not JSON model chunks.
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

function resolveReference(value: unknown, chunks: ChunkMap): unknown {
  if (typeof value !== "string") return value;
  const match = value.match(REFERENCE_PATTERN);
  if (!match) return value;
  const chunk = chunks.get(match[1].toLowerCase());
  return match[2] ? resolvePath(chunk, match[2]) : chunk;
}

function walk(value: unknown, visit: (value: unknown) => void, seen = new Set<object>()): void {
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

function flattenRenderedText(value: unknown, chunks: ChunkMap, depth = 0): string[] {
  if (depth > 100 || value === null || value === undefined) return [];
  const resolved = resolveReference(value, chunks);
  if (resolved !== value) return flattenRenderedText(resolved, chunks, depth + 1);
  if (typeof value === "string") {
    if (value.startsWith("$") || value === " ") return [];
    return [value.trim()].filter(Boolean);
  }
  if (!Array.isArray(value)) {
    if (typeof value !== "object") return [];
    const object = value as Record<string, unknown>;
    if (object.textProps && typeof object.textProps === "object") {
      return flattenRenderedText((object.textProps as Record<string, unknown>).children, chunks, depth + 1);
    }
    return [
      ...flattenRenderedText(object.children, chunks, depth + 1),
      ...flattenRenderedText(object.initialContent, chunks, depth + 1),
    ];
  }
  if (value[0] === "$") {
    const props = value[3] as Record<string, unknown> | undefined;
    if (props?.textProps && typeof props.textProps === "object") {
      return flattenRenderedText((props.textProps as Record<string, unknown>).children, chunks, depth + 1);
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
          found.push(...flattenRenderedText((props.textProps as Record<string, unknown>).children, chunks));
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
      found.push(...flattenRenderedText((object.textProps as Record<string, unknown>).children, chunks));
    }
    if ("children" in object) collect(object.children, depth + 1);
    if ("initialContent" in object) collect(object.initialContent, depth + 1);
  }

  collect(root);
  return [...new Set(found.map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function sectionLabel(identifier: string): string {
  const tail = identifier.split(".").at(-1) || identifier;
  return tail
    .replace(/TopLevelSection$/, "")
    .replace(/Section$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function collectInitialContentReferences(value: unknown): string[] {
  const references: string[] = [];
  walk(value, (item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const initialContent = (item as Record<string, unknown>).initialContent;
    if (typeof initialContent === "string" && REFERENCE_PATTERN.test(initialContent)) {
      references.push(initialContent);
    }
  });
  return [...new Set(references)];
}

function extractSections(chunks: ChunkMap): ProfileSection[] {
  const sections = new Map<string, ProfileSection>();

  for (const chunk of chunks.values()) {
    walk(chunk, (item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return;
      const object = item as Record<string, unknown>;
      const identifier = object.observabilityIdentifier;
      if (typeof identifier !== "string" || !identifier.includes(".profile.components.")) return;

      const key = identifier.split(".").at(-1) || identifier;
      const text = collectInitialContentReferences(object)
        .flatMap((reference) => collectVisibleText(resolveReference(reference, chunks), chunks));
      const cleaned = [...new Set(text)].filter((item) => item.length > 1);
      if (!cleaned.length) return;

      const existing = sections.get(key);
      if (!existing || cleaned.length > existing.text.length) {
        sections.set(key, { key, label: sectionLabel(identifier), text: cleaned });
      }
    });
  }

  return [...sections.values()];
}

function extractName(payload: string): string | null {
  const title = payload.match(/"children":"([^"\\]+) \| LinkedIn"/);
  if (title) return title[1];
  const heading = payload.match(/"tagName":"h1"[^\n]{0,500}?"children":\["([^"\\]+)"\]/);
  return heading?.[1] || null;
}

function findTopCard(chunks: ChunkMap): unknown {
  for (const chunk of chunks.values()) {
    let result: unknown;
    walk(chunk, (item) => {
      if (result || !item || typeof item !== "object" || Array.isArray(item)) return;
      const specs = (item as Record<string, unknown>).viewTrackingSpecs;
      if (specs && typeof specs === "object" && (specs as Record<string, unknown>).viewName === "profile-top-card") {
        result = item;
      }
    });
    if (result) return result;
  }
  return undefined;
}

function extractImageUrl(root: unknown): string | null {
  let best: { width: number; url: string } | null = null;
  walk(root, (item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const object = item as Record<string, unknown>;
    const rootUrl = object.rootUrl;
    const renditions = object.imageRenditions;
    if (typeof rootUrl !== "string" || !Array.isArray(renditions) || !rootUrl.includes("profile")) return;
    for (const rendition of renditions) {
      if (!rendition || typeof rendition !== "object") continue;
      const width = Number((rendition as Record<string, unknown>).width || 0);
      const suffix = (rendition as Record<string, unknown>).suffixUrl;
      if (typeof suffix === "string" && (!best || width > best.width)) {
        best = { width, url: `${rootUrl}${suffix}` };
      }
    }
  });
  return best?.url || null;
}

export function parseSearchSuggestions(payload: string): SearchSuggestion[] {
  const chunks = parseRscChunks(payload);
  const suggestions = new Map<string, SearchSuggestion>();

  for (const chunk of chunks.values()) {
    walk(chunk, (item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return;
      const object = item as Record<string, unknown>;
      const candidate = object.payload;
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return;
      const payload = candidate as Record<string, unknown>;
      if (
        typeof payload.vanityName !== "string" ||
        typeof payload.vieweeProfileId !== "string" ||
        typeof payload.searchTerm !== "string"
      ) {
        return;
      }

      suggestions.set(payload.vieweeProfileId, {
        name: payload.searchTerm,
        vanityName: payload.vanityName,
        profileId: payload.vieweeProfileId,
        url: `https://www.linkedin.com/in/${payload.vanityName}/`,
      });
    });
  }

  return [...suggestions.values()];
}

export function parseProfile(payload: string, vanityName: string, profileId: string): LinkedInProfile {
  const chunks = parseRscChunks(payload);
  const name = extractName(payload);
  const topCardRoot = findTopCard(chunks);
  const topCard = collectVisibleText(topCardRoot, chunks).filter((text) => !UI_TEXT.has(text));
  const sections = extractSections(chunks);
  const aboutSection = sections.find((section) => /about/i.test(section.key));
  const about = aboutSection?.text.find((text) => text !== "About" && text.length > 30) || null;
  const topCardDetails = topCard.filter((text) => text !== name && !text.startsWith("Message "));

  return {
    name,
    vanityName,
    profileId,
    headline: topCardDetails.find((text) => text.length > 20) || null,
    location: topCardDetails.find((text) => text.length <= 50 && /,/.test(text)) || null,
    about,
    topCard,
    sections,
    profileImageUrl: extractImageUrl(topCardRoot),
    sourceUrl: `https://www.linkedin.com/in/${vanityName}/`,
  };
}
