import { InvalidProfileUrlError } from "../errors.ts";

export { InvalidProfileUrlError } from "../errors.ts";

export interface ParsedProfileUrl {
	vanityName: string;
	sourceUrl: string;
}

const LINKEDIN_HOSTS = new Set(["linkedin.com", "www.linkedin.com"]);
const VANITY_NAME_PATTERN = /^[a-z0-9][a-z0-9.-]{0,99}$/;

/**
 * Converts current `/in/` and legacy `/pub/` profile URLs into the vanity name
 * used by LinkedIn's profile endpoints.
 */
export function parseProfileUrl(input: string): ParsedProfileUrl {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		throw new InvalidProfileUrlError();
	}

	if (
		!["http:", "https:"].includes(url.protocol.toLowerCase()) ||
		!LINKEDIN_HOSTS.has(url.hostname.toLowerCase()) ||
		url.username ||
		url.password ||
		url.port
	) {
		throw new InvalidProfileUrlError();
	}

	let parts: string[];
	try {
		parts = url.pathname
			.split("/")
			.filter(Boolean)
			.map((part) => decodeURIComponent(part));
	} catch {
		throw new InvalidProfileUrlError();
	}

	const route = parts[0]?.toLowerCase();
	const vanityName = parts[1]?.toLowerCase();
	const validShape =
		(route === "in" && parts.length === 2) ||
		(route === "pub" && parts.length >= 2 && parts.length <= 5);

	if (
		!validShape ||
		!vanityName ||
		!VANITY_NAME_PATTERN.test(vanityName)
	) {
		throw new InvalidProfileUrlError();
	}

	return {
		vanityName,
		sourceUrl: `https://www.linkedin.com/in/${vanityName}/`,
	};
}
