import { describe, expect, test } from "bun:test";
import type { LinkedInEndpointRequest } from "../src/core/linkedin/http.ts";
import { extractSearchResults } from "../src/core/linkedin/extract/search.ts";
import { searchProfiles } from "../src/core/profile-service.ts";

const searchPayload = [
	'1:["$","div",null,{"image":["$","$L50",null,{"renderPayload":{"rootUrl":"https://media.licdn.com/profile-displayphoto-shrink_","imageRenditions":[{"width":100,"height":100,"suffixUrl":"small.jpg"},{"width":400,"height":400,"suffixUrl":"large.jpg"}]}}],"action":{"payload":{"vanityName":"satyanadella","searchTerm":"Satya Nadella","vieweeProfileId":"abc123"}}}]',
	'2:["$","div",null,{"duplicate":{"payload":{"vanityName":"satyanadella","searchTerm":"Satya Nadella","vieweeProfileId":"different-id"}}}]',
].join("\n");

describe("profile search extraction", () => {
	test("extracts and deduplicates public profile results", () => {
		expect(extractSearchResults(searchPayload)).toEqual([
			{
				name: "Satya Nadella",
				vanityName: "satyanadella",
				url: "https://www.linkedin.com/in/satyanadella/",
				profileImageUrl:
					"https://media.licdn.com/profile-displayphoto-shrink_large.jpg",
			},
		]);
	});

	test("keeps a result when LinkedIn omits its profile image", () => {
		const payload =
			'1:["$","div",null,{"action":{"payload":{"vanityName":"williamhgates","searchTerm":"Bill Gates"}}}]';

		expect(extractSearchResults(payload)).toEqual([
			{
				name: "Bill Gates",
				vanityName: "williamhgates",
				url: "https://www.linkedin.com/in/williamhgates/",
				profileImageUrl: null,
			},
		]);
	});
});

describe("profile search service", () => {
	test("makes one typeahead call and no profile calls", async () => {
		const requests: LinkedInEndpointRequest[] = [];
		const http = {
			async post(request: LinkedInEndpointRequest): Promise<string> {
				requests.push(request);
				return searchPayload;
			},
		};

		const response = await searchProfiles("  satya nadella  ", http);

		expect(response).toEqual({
			query: "satya nadella",
			count: 1,
			results: [
				{
					name: "Satya Nadella",
					vanityName: "satyanadella",
					url: "https://www.linkedin.com/in/satyanadella/",
					profileImageUrl:
						"https://media.licdn.com/profile-displayphoto-shrink_large.jpg",
				},
			],
		});
		expect(requests).toHaveLength(1);
		expect(requests[0]?.path).toContain(
			"/flagship-web/rsc-action/actions/server-request",
		);
		expect(requests[0]?.path).not.toContain("/flagship-web/in/");
	});
});
