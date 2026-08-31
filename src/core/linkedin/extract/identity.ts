import type { Identity } from "../../schema.ts";
import {
	elementText,
	largestProfileImage,
	readSection,
	sectionText,
} from "./shared.ts";

const TOP_CARD_UI = new Set([
	"Contact info",
	"Profile enhanced with Premium",
]);
const LOCATION_PATTERN = /(?:\barea\b|\bregion\b|\bunited states\b|\bunited kingdom\b|\bindia\b)/i;

/** Decodes the HTML entities LinkedIn uses inside image attributes. */
function decodeHtmlAttribute(value: string): string {
	return value.replace(
		/&(?:amp|quot|apos|#39|#x[0-9a-f]+|#\d+);/gi,
		(entity) => {
			const normalized = entity.toLowerCase();
			if (normalized === "&amp;") return "&";
			if (normalized === "&quot;") return '"';
			if (normalized === "&apos;" || normalized === "&#39;") return "'";
			const numeric = normalized.startsWith("&#x")
				? Number.parseInt(normalized.slice(3, -1), 16)
				: Number.parseInt(normalized.slice(2, -1), 10);
			return Number.isNaN(numeric) ? entity : String.fromCodePoint(numeric);
		},
	);
}

/** Reads one quoted attribute from a rendered HTML tag. */
function htmlAttribute(tag: string, name: string): string | null {
	const match = tag.match(
		new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"),
	);
	return match?.[2] ? decodeHtmlAttribute(match[2]) : null;
}

/** Extracts the largest rendition from the profile HTML's primary image tag. */
export function extractProfileImageFromHtml(html: string | null): string | null {
	if (!html) return null;
	for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
		const tag = match[0];
		if (htmlAttribute(tag, "fetchPriority")?.toLowerCase() !== "high") {
			continue;
		}
		const src = htmlAttribute(tag, "src");
		const srcSet = htmlAttribute(tag, "srcSet");
		if (!`${src ?? ""} ${srcSet ?? ""}`.includes("profile-displayphoto")) {
			continue;
		}
		const candidates = (srcSet ?? "")
			.split(/,\s+/)
			.map((item) => {
				const [url, descriptor = "0"] = item.trim().split(/\s+/);
				return { url, size: Number.parseFloat(descriptor) || 0 };
			})
			.filter((item): item is { url: string; size: number } => Boolean(item.url));
		if (src) candidates.push({ url: src, size: 0 });
		const url = candidates.sort((left, right) => right.size - left.size)[0]?.url;
		if (url) return url;
	}
	return null;
}

/** Extracts the top-card identity fields and chooses the largest profile image. */
export function extractIdentity(payload: string | null): Identity | null {
	try {
		const graph = readSection(payload, ["topCard"]);
		if (!graph) return null;
		const name =
			elementText(graph, new Set(["h1", "h2"]))
				.find((text) => text.length > 1) ?? null;
		const visible = sectionText(graph, TOP_CARD_UI).filter(
			(text) =>
				text !== name &&
				!/^·/.test(text) &&
				!/^\d[\d,]* followers$/i.test(text) &&
				!/^followed by /i.test(text) &&
				!/^https?:/i.test(text),
		);
		const headline = visible[0] ?? null;
		const locationCandidates = visible.slice(1).reverse();
		const location =
			locationCandidates.find((text) => LOCATION_PATTERN.test(text)) ??
			locationCandidates.find((text) => text.includes(",")) ??
			visible[2] ??
			visible[1] ??
			null;
		const identity = {
			name,
			headline,
			location,
			profileImageUrl: largestProfileImage(graph),
		};

		return Object.values(identity).some((value) => value !== null)
			? identity
			: null;
	} catch {
		return null;
	}
}
