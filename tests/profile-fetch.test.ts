import { describe, expect, test } from "bun:test";
import {
	PROFILE_DETAIL_SECTIONS,
	fetchProfilePayloads,
} from "../src/core/linkedin/fetch-profile.ts";
import type {
	LinkedInEndpointRequest,
	LinkedInHttp,
} from "../src/core/linkedin/http.ts";

describe("profile fetch orchestration", () => {
	test("caps concurrent LinkedIn calls at four", async () => {
		let active = 0;
		let maximumActive = 0;
		const requests: LinkedInEndpointRequest[] = [];
		const http: LinkedInHttp = {
			async post(request) {
				requests.push(request);
				active += 1;
				maximumActive = Math.max(maximumActive, active);
				await new Promise((resolve) => setTimeout(resolve, 5));
				active -= 1;
				return request.path;
			},
		};

		const result = await fetchProfilePayloads(http, "satyanadella");

		expect(requests).toHaveLength(PROFILE_DETAIL_SECTIONS.length + 1);
		expect(maximumActive).toBe(4);
		expect(result.page).toContain("/in/satyanadella/");
	});

	test("fetches only requested detail sections", async () => {
		const paths: string[] = [];
		const http: LinkedInHttp = {
			async post(request) {
				paths.push(request.path);
				return request.path;
			},
		};

		const result = await fetchProfilePayloads(http, "satyanadella", {
			sections: ["experience", "education"],
		});

		expect(paths).toHaveLength(3);
		expect(result.sections.experience?.[0]).toContain("details/experience");
		expect(result.sections.education?.[0]).toContain("details/education");
		expect(result.sections.skills).toBeNull();
	});

	test("fetches the profile HTML when the HTTP client supports it", async () => {
		const getPaths: string[] = [];
		const http: LinkedInHttp = {
			async get(request) {
				getPaths.push(request.path);
				return "profile HTML";
			},
			async post(request) {
				return request.path;
			},
		};

		const result = await fetchProfilePayloads(http, "satyanadella", {
			sections: [],
		});

		expect(getPaths).toEqual(["/in/satyanadella/"]);
		expect(result.html).toBe("profile HTML");
	});

	test("fetches skills and languages from their complete detail pages", async () => {
		const paths: string[] = [];
		const http: LinkedInHttp = {
			async post(request) {
				paths.push(request.path);
				return request.path;
			},
		};

		const result = await fetchProfilePayloads(http, "satyanadella", {
			sections: ["skills", "languages"],
		});

		expect(paths).toHaveLength(3);
		expect(paths.some((path) => path.includes("details/skills"))).toBe(true);
		expect(paths.some((path) => path.includes("details/languages"))).toBe(true);
		expect(result.sections.skills?.[0]).toContain(
			"details/skills",
		);
		expect(result.sections.languages?.[0]).toContain(
			"details/languages",
		);
	});

	test("keeps other results when one section fails or times out", async () => {
		const http: LinkedInHttp = {
			async post(request) {
				if (request.path.includes("education")) throw new Error("failed");
				if (request.path.includes("skills")) {
					return new Promise((_, reject) => {
						request.signal?.addEventListener("abort", () =>
							reject(new Error("aborted")),
						);
					});
				}
				return request.path;
			},
		};

		const result = await fetchProfilePayloads(http, "satyanadella", {
			sections: ["experience", "education", "skills"],
			timeoutMs: 10,
		});

		expect(result.sections.experience).not.toBeNull();
		expect(result.sections.education).toBeNull();
		expect(result.sections.skills).toBeNull();
	});

	test("follows a profile detail pager returned by the section page", async () => {
		const requests: LinkedInEndpointRequest[] = [];
		const pagerId = "com.linkedin.sdui.pagers.profile.details.education";
		const detailPayload = `1:${JSON.stringify({
			nextPageRequest: {
				pagerId,
				requestedArguments: {
					$type: "proto.sdui.actions.requests.RequestedArguments",
					requestedStateKeys: [],
					payload: {
						vanityName: "satyanadella",
						start: 0,
						count: 10,
					},
					requestMetadata: {
						$type: "proto.sdui.common.RequestMetadata",
					},
				},
			},
		})}`;
		const http: LinkedInHttp = {
			async post(request) {
				requests.push(request);
				if (request.path.includes("details/education")) return detailPayload;
				if (request.path.includes("rsc-action")) return "paged education";
				return "page";
			},
		};

		const result = await fetchProfilePayloads(http, "satyanadella", {
			sections: ["education"],
		});

		expect(requests).toHaveLength(3);
		const pagerRequest = requests[2];
		expect(pagerRequest?.path).toContain(
			`/rsc-action/actions/pagination?sduiid=${encodeURIComponent(pagerId)}`,
		);
		expect(pagerRequest?.body).toMatchObject({
			pagerId,
			paginationRequest: {
				pagerId,
				requestedArguments: {
					payload: {
						vanityName: "satyanadella",
					},
				},
			},
			clientArguments: {
				payload: {
					vanityName: "satyanadella",
					start: 0,
					count: 10,
				},
				screenId:
					"com.linkedin.sdui.flagshipnav.profile.ProfileEducationDetails",
			},
		});
		expect(requests[1]?.context).toBeDefined();
		expect(pagerRequest?.context).toBe(requests[1]?.context);
		expect(result.sections.education).toEqual([
			detailPayload,
			"paged education",
		]);
	});

	test("keeps following section pagers until the last page", async () => {
		const requests: LinkedInEndpointRequest[] = [];
		const pagerId = "com.linkedin.sdui.pagers.profile.details.skills";
		const paginationPayload = (start: number) =>
			`1:${JSON.stringify({
				nextPageRequest: {
					pagerId,
					requestedArguments: {
						payload: { vanityName: "satyanadella", start, count: 2 },
					},
				},
			})}`;
		let paginationCall = 0;
		const http: LinkedInHttp = {
			async post(request) {
				requests.push(request);
				if (request.path.includes("details/skills")) {
					return paginationPayload(0);
				}
				if (request.path.includes("rsc-action")) {
					paginationCall += 1;
					return paginationCall === 1
						? paginationPayload(2)
						: "last skills page";
				}
				return "profile page";
			},
		};

		const result = await fetchProfilePayloads(http, "satyanadella", {
			sections: ["skills"],
		});

		expect(paginationCall).toBe(2);
		expect(result.sections.skills).toEqual([
			paginationPayload(0),
			paginationPayload(2),
			"last skills page",
		]);
	});

	test("keeps fetched pages when LinkedIn repeats a pager", async () => {
		const pagerId = "com.linkedin.sdui.pagers.profile.details.skills";
		const repeatedPayload = `1:${JSON.stringify({
			nextPageRequest: {
				pagerId,
				requestedArguments: {
					payload: { vanityName: "satyanadella", start: 0, count: 10 },
				},
			},
		})}`;
		let paginationCalls = 0;
		const http: LinkedInHttp = {
			async post(request) {
				if (request.path.includes("details/skills")) return repeatedPayload;
				if (request.path.includes("rsc-action")) {
					paginationCalls += 1;
					return repeatedPayload;
				}
				return "profile page";
			},
		};

		const result = await fetchProfilePayloads(http, "satyanadella", {
			sections: ["skills"],
		});

		expect(paginationCalls).toBe(1);
		expect(result.sections.skills).toEqual([
			repeatedPayload,
			repeatedPayload,
		]);
	});

	test("keeps the first 100 pages when pagination reaches its cap", async () => {
		const pagerId = "com.linkedin.sdui.pagers.profile.details.skills";
		const paginationPayload = (start: number) =>
			`1:${JSON.stringify({
				nextPageRequest: {
					pagerId,
					requestedArguments: {
						payload: { vanityName: "satyanadella", start, count: 10 },
					},
				},
			})}`;
		let paginationCalls = 0;
		const http: LinkedInHttp = {
			async post(request) {
				if (request.path.includes("details/skills")) {
					return paginationPayload(0);
				}
				if (request.path.includes("rsc-action")) {
					paginationCalls += 1;
					return paginationPayload(paginationCalls);
				}
				return "profile page";
			},
		};

		const result = await fetchProfilePayloads(http, "satyanadella", {
			sections: ["skills"],
		});

		expect(paginationCalls).toBe(99);
		expect(result.sections.skills).toHaveLength(100);
		expect(result.sections.skills?.at(-1)).toBe(paginationPayload(99));
	});
});
