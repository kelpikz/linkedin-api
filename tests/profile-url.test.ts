import { describe, expect, test } from "bun:test";
import {
	InvalidProfileUrlError,
	parseProfileUrl,
} from "../src/core/linkedin/profile-url.ts";

describe("LinkedIn profile URL parsing", () => {
	test.each([
		["https://www.linkedin.com/in/satyanadella", "satyanadella"],
		["https://www.linkedin.com/in/satyanadella/", "satyanadella"],
		[
			"https://www.linkedin.com/in/satyanadella/?trk=public_profile",
			"satyanadella",
		],
		["https://linkedin.com/in/satyanadella#about", "satyanadella"],
		["HTTPS://WWW.LINKEDIN.COM/IN/SATYANADELLA/", "satyanadella"],
		[
			"https://www.linkedin.com/pub/satya-nadella/12/345/678",
			"satya-nadella",
		],
	])("parses %s", (url, vanityName) => {
		expect(parseProfileUrl(url).vanityName).toBe(vanityName);
	});

	test.each([
		"not a URL",
		"https://example.com/in/satyanadella/",
		"https://www.linkedin.com/company/microsoft/",
		"https://www.linkedin.com/in/",
		"https://evil.linkedin.com/in/satyanadella/",
		"ftp://www.linkedin.com/in/satyanadella/",
	])("rejects %s", (url) => {
			expect(() => parseProfileUrl(url)).toThrow(InvalidProfileUrlError);
		});
});
