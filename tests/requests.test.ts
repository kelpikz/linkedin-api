import { describe, expect, test } from "bun:test";
import { loadLinkedInConfig } from "../src/linkedin/config.ts";
import {
	buildProfileBody,
	buildTypeaheadBody,
} from "../src/linkedin/requests.ts";

describe("request builders", () => {
	test("builds a typeahead request with fresh session state", () => {
		const body = buildTypeaheadBody("billgates");
		expect(body.requestId).toContain("SearchGlobalTypeaheadRequestAction");
		expect(
			body.states.find(
				(state) => state.key === "SearchResultsGlobalTyahKeywordsBinding",
			)?.value,
		).toBe("billgates");
		expect(body.requestedArguments.states).toEqual(body.states);
	});

	test("builds a profile prefetch request", () => {
		const body = buildProfileBody("williamhgates", "profile-id");
		expect(body.isPrefetch).toBe(true);
		expect(body.requestedArguments.payload).toEqual({
			vanityName: "williamhgates",
			isVanityNameResolved: true,
			vieweeProfileId: "profile-id",
		});
	});

	test("derives the CSRF token from JSESSIONID", () => {
		const config = loadLinkedInConfig({
			LINKEDIN_COOKIE: 'foo=bar; JSESSIONID="ajax:123"; baz=qux',
		});
		expect(config.csrfToken).toBe("ajax:123");
	});
});
