import { describe, expect, test } from "bun:test";
import {
	fetchProfilePage,
	fetchProfileSection,
} from "../src/core/linkedin/endpoints/profile.ts";
import { fetchProfileSearch } from "../src/core/linkedin/endpoints/search.ts";
import {
	loadLinkedInConfig,
	type LinkedInEndpointRequest,
	type LinkedInRequestBody,
} from "../src/core/linkedin/http.ts";

function recordingHttp(response = "raw Flight text") {
	const requests: LinkedInEndpointRequest[] = [];
	return {
		requests,
		http: {
			async post(request: LinkedInEndpointRequest): Promise<string> {
				requests.push(request);
				return response;
			},
		},
	};
}

function standardBody(
	request: LinkedInEndpointRequest | undefined,
): LinkedInRequestBody {
	if (!request || !("requestedArguments" in request.body)) {
		throw new Error("Expected a standard LinkedIn request body");
	}
	return request.body;
}

describe("LinkedIn endpoints", () => {
	test("builds a profile page request from vanity name alone", async () => {
		const { http, requests } = recordingHttp();

		const result = await fetchProfilePage(http, "williamhgates");

		expect(result).toBe("raw Flight text");
		expect(requests).toHaveLength(1);
		expect(requests[0]?.path).toBe("/flagship-web/in/williamhgates/");
		expect(requests[0]?.pageKey).toBe("d_flagship3_profile_view_base");
		expect(standardBody(requests[0]).requestedArguments.payload).toEqual({
			vanityName: "williamhgates",
			isVanityNameResolved: true,
		});
	});

	test("builds a detail-section request", async () => {
		const { http, requests } = recordingHttp();

		await fetchProfileSection(http, "satyanadella", "education");

		expect(requests[0]?.path).toBe(
			"/flagship-web/in/satyanadella/details/education/",
		);
		expect(requests[0]?.pageKey).toBe(
			"d_flagship3_profile_view_base_education_details",
		);
		expect(standardBody(requests[0]).requestedArguments.payload).toEqual({
			vanityName: "satyanadella",
			isVanityNameResolved: true,
			sectionType: "education",
		});
	});

	test("builds one typeahead request for profile search", async () => {
		const { http, requests } = recordingHttp();

		await fetchProfileSearch(http, "bill gates");

		expect(requests).toHaveLength(1);
		const request = requests[0];
		expect(request?.pageKey).toBe("d_flagship3_feed");
		expect(request?.refererPath).toBe("/feed/");
		const url = new URL(request?.path ?? "", "https://www.linkedin.com");
		expect(url.pathname).toBe(
			"/flagship-web/rsc-action/actions/server-request",
		);
		expect(url.searchParams.get("sduiid")).toBe(
			"com.linkedin.sdui.search.requests.SearchGlobalTypeaheadRequestAction",
		);
		expect(url.searchParams.get("parentSpanId")).toBeTruthy();
		expect(
			standardBody(request).states?.find(
				(state) => state.key === "SearchResultsGlobalTyahKeywordsBinding",
			)?.value,
		).toBe("bill gates");
	});
});

test("derives the CSRF token from JSESSIONID", () => {
	const config = loadLinkedInConfig({
		LINKEDIN_COOKIE: 'foo=bar; JSESSIONID="ajax:123"; baz=qux',
	});
	expect(config.csrfToken).toBe("ajax:123");
});
