import {
	fetchProfilePage,
	fetchProfilePageHtml,
	fetchProfileSection,
	fetchProfileSectionPage,
} from "./endpoints/profile.ts";
import {
	createLinkedInPageContext,
	type LinkedInHttp,
	type LinkedInPaginationRequest,
} from "./http.ts";
import { parseRscChunks, walk } from "./flight/index.ts";
import {
	PROFILE_DETAIL_SECTIONS,
	type ProfileDetailSection,
} from "../schema.ts";

export { PROFILE_DETAIL_SECTIONS } from "../schema.ts";

export interface ProfilePayloads {
	page: string | null;
	html: string | null;
	sections: Record<ProfileDetailSection, readonly string[] | null>;
}

export interface FetchProfileOptions {
	sections?: readonly ProfileDetailSection[];
	concurrency?: number;
	timeoutMs?: number;
}

interface FetchTask {
	key: "page" | "html" | ProfileDetailSection;
	run(signal: AbortSignal): Promise<string | readonly string[]>;
}

const MAX_SECTION_PAGES = 100;

/** Finds the pager for the requested profile section in a detail response. */
function findProfileSectionPager(
	payload: string,
	section: ProfileDetailSection,
): LinkedInPaginationRequest | null {
	const expectedPagerId = `com.linkedin.sdui.pagers.profile.details.${section}`;
	const chunks = parseRscChunks(payload);
	let pager: LinkedInPaginationRequest | null = null;

	for (const chunk of chunks.values()) {
		walk(chunk, (value) => {
			if (pager || !value || typeof value !== "object" || Array.isArray(value)) {
				return;
			}
			const request = (value as Record<string, unknown>).nextPageRequest;
			if (!request || typeof request !== "object" || Array.isArray(request)) {
				return;
			}
			const candidate = request as Record<string, unknown>;
			const requestedArguments = candidate.requestedArguments;
			if (
				candidate.pagerId === expectedPagerId &&
				requestedArguments &&
				typeof requestedArguments === "object" &&
				!Array.isArray(requestedArguments) &&
				(requestedArguments as Record<string, unknown>).payload &&
				typeof (requestedArguments as Record<string, unknown>).payload ===
					"object"
			) {
				pager = candidate as LinkedInPaginationRequest;
			}
		});
		if (pager) return pager;
	}

	return null;
}

/** Fetches a detail page and follows every collection pager it returns. */
export async function fetchProfileSectionPayloads(
	http: LinkedInHttp,
	vanityName: string,
	section: ProfileDetailSection,
	signal?: AbortSignal,
): Promise<readonly string[]> {
	const context = createLinkedInPageContext();
	const initial = await fetchProfileSection(
		http,
		vanityName,
		section,
		signal,
		context,
	);
	const payloads = [initial];
	const seenRequests = new Set<string>();
	let pager = findProfileSectionPager(initial, section);

	while (pager) {
		const requestKey = JSON.stringify({
			pagerId: pager.pagerId,
			payload: pager.requestedArguments.payload,
		});
		if (seenRequests.has(requestKey)) {
			return payloads;
		}
		if (payloads.length >= MAX_SECTION_PAGES) {
			return payloads;
		}

		seenRequests.add(requestKey);
		const page = await fetchProfileSectionPage(
			http,
			vanityName,
			section,
			pager,
			signal,
			context,
		);
		payloads.push(page);
		pager = findProfileSectionPager(page, section);
	}

	return payloads;
}

/** Runs one upstream call with an abort signal and converts failure to null. */
async function settleTask(
	task: FetchTask,
	timeoutMs: number,
): Promise<[FetchTask["key"], string | readonly string[] | null]> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return [task.key, await task.run(controller.signal)];
	} catch {
		return [task.key, null];
	} finally {
		clearTimeout(timeout);
	}
}

/**
 * Pulls work from a shared index so no more than `limit` LinkedIn calls run at
 * once. Task order does not affect response ordering.
 */
async function runBounded(
	tasks: FetchTask[],
	limit: number,
	timeoutMs: number,
): Promise<
	Array<[FetchTask["key"], string | readonly string[] | null]>
> {
	const results: Array<
		[FetchTask["key"], string | readonly string[] | null]
	> = [];
	let next = 0;

	async function worker(): Promise<void> {
		while (next < tasks.length) {
			const task = tasks[next++];
			if (task) results.push(await settleTask(task, timeoutMs));
		}
	}

	const workerCount = Math.min(Math.max(1, limit), tasks.length);
	await Promise.all(Array.from({ length: workerCount }, () => worker()));
	return results;
}

/** Fetches the page plus selected detail payloads without failing as a group. */
export async function fetchProfilePayloads(
	http: LinkedInHttp,
	vanityName: string,
	options: FetchProfileOptions = {},
): Promise<ProfilePayloads> {
	const sections = options.sections ?? PROFILE_DETAIL_SECTIONS;
	const tasks: FetchTask[] = [
		{
			key: "page",
			run: (signal) => fetchProfilePage(http, vanityName, signal),
		},
		{
			key: "html",
			run: (signal) => fetchProfilePageHtml(http, vanityName, signal),
		},
		...sections.map(
			(section): FetchTask => ({
				key: section,
				run: (signal) =>
					fetchProfileSectionPayloads(http, vanityName, section, signal),
			}),
		),
	];
	const results = await runBounded(
		tasks,
		options.concurrency ?? 4,
		options.timeoutMs ?? 30_000,
	);
	const payloads: ProfilePayloads = {
		page: null,
		html: null,
		sections: {
			experience: null,
			education: null,
			skills: null,
			certifications: null,
			languages: null,
		},
	};

	for (const [key, value] of results) {
		if (key === "page") {
			payloads.page = typeof value === "string" ? value : null;
		} else if (key === "html") {
			payloads.html = typeof value === "string" ? value : null;
		} else {
			payloads.sections[key] = Array.isArray(value) ? value : null;
		}
	}

	return payloads;
}
