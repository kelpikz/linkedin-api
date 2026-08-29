import { describe, expect, test } from "bun:test";
import {
	collectVisibleText,
	parseRscChunks,
} from "../src/core/linkedin/flight/index.ts";

describe("Flight decoder", () => {
	test("extracts JSON model chunks and skips other records", () => {
		const chunks = parseRscChunks(
			[
				'1:["$","div",null,{"children":["Hello"]}]',
				'2:I[123,["module.js"],"default"]',
				'3:E{"digest":"failed"}',
				"not-a-chunk",
			].join("\n"),
		);

		expect(chunks.size).toBe(1);
		expect(chunks.has("1")).toBe(true);
	});

	test("follows Flight references while collecting rendered text", () => {
		const chunks = parseRscChunks(
			[
				'1:["$","section",null,{"children":["$L2","$L3"]}]',
				'2:["$","h2",null,{"children":["About"]}]',
				'3:["$","p",null,{"children":["Chairman and Chief Executive Officer at Microsoft."]}]',
			].join("\n"),
		);

		expect(collectVisibleText(chunks.get("1"), chunks)).toEqual([
			"About",
			"Chairman and Chief Executive Officer at Microsoft.",
		]);
	});
});
