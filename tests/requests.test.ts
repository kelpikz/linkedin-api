import { describe, expect, test } from "bun:test";
import {
	fetchProfilePage,
	fetchProfileSection,
	type LinkedInEndpointRequest,
} from "../src/core/linkedin/endpoints.ts";
import { loadLinkedInConfig } from "../src/core/linkedin/http.ts";

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

describe("LinkedIn endpoints", () => {
	test("builds a profile page request from vanity name alone", async () => {
		const { http, requests } = recordingHttp();

		const result = await fetchProfilePage(http, "williamhgates");

		expect(result).toBe("raw Flight text");
		expect(requests).toHaveLength(1);
		expect(requests[0]?.path).toBe("/flagship-web/in/williamhgates/");
		expect(requests[0]?.pageKey).toBe("d_flagship3_profile_view_base");
		expect(requests[0]?.body.requestedArguments.payload).toEqual({
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
		expect(requests[0]?.pageKey).toBe("profile_view_base_details");
		expect(requests[0]?.body.requestedArguments.payload).toEqual({
			vanityName: "satyanadella",
			isVanityNameResolved: true,
			sectionType: "education",
		});
	});
});

test("derives the CSRF token from JSESSIONID", () => {
	const config = loadLinkedInConfig({
		LINKEDIN_COOKIE: 'foo=bar; JSESSIONID="ajax:123"; baz=qux',
	});
	expect(config.csrfToken).toBe("ajax:123");
});
