import type {
	Profile,
	ProfileSearchResponse,
} from "../../src/core/schema.ts";

type Fetcher = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

/** Hides the LinkedIn CDN URL behind an opaque same-origin path. */
export function profileImageSource(url: string): string {
	const bytes = new TextEncoder().encode(url);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	const token = btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
	return `/api/profile-image/${token}`;
}

/** Returns the API's useful message without exposing response internals. */
async function responseError(response: Response): Promise<Error> {
	const body = await response
		.json()
		.catch(() => null) as { error?: unknown } | null;
	const message =
		typeof body?.error === "string"
			? body.error
			: `Request failed with status ${response.status}`;
	return new Error(message);
}

/** Loads every profile section for one submitted LinkedIn URL. */
export async function loadProfile(
	url: string,
	request: Fetcher = fetch,
): Promise<Profile> {
	const response = await request(
		`/api/profile?url=${encodeURIComponent(url.trim())}`,
	);
	if (!response.ok) throw await responseError(response);
	return await response.json() as Profile;
}

/** Finds public profile matches without loading any profile details. */
export async function searchProfiles(
	query: string,
	request: Fetcher = fetch,
): Promise<ProfileSearchResponse> {
	const response = await request(
		`/api/search?q=${encodeURIComponent(query.trim())}`,
	);
	if (!response.ok) throw await responseError(response);
	return await response.json() as ProfileSearchResponse;
}
