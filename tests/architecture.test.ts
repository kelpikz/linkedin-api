import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const targetFiles = [
	"src/core/linkedin/http.ts",
	"src/core/linkedin/endpoints/profile.ts",
	"src/core/linkedin/endpoints/search.ts",
	"src/core/linkedin/flight/index.ts",
	"src/core/linkedin/extract/identity.ts",
	"src/core/linkedin/extract/about.ts",
	"src/core/linkedin/extract/experience.ts",
	"src/core/linkedin/extract/education.ts",
	"src/core/linkedin/extract/skills.ts",
	"src/core/linkedin/extract/certifications.ts",
	"src/core/linkedin/extract/languages.ts",
	"src/core/linkedin/extract/search.ts",
	"src/core/schema.ts",
	"src/core/cache.ts",
	"src/core/errors.ts",
	"src/core/profile-service.ts",
	"src/api/app.ts",
	"src/api/index.ts",
	"src/mcp/index.ts",
	"web/.gitkeep",
];

describe("module layout", () => {
	test("creates the complete target structure", async () => {
		for (const path of targetFiles) {
			if (!existsSync(path)) {
				throw new Error(`Missing target file: ${path}`);
			}
		}
		expect(existsSync("src/server.ts")).toBe(false);
		expect(existsSync("src/linkedin/client.ts")).toBe(false);
	});

	test("keeps LinkedIn internals behind profile-service", async () => {
		const consumers = ["src/api/app.ts", "src/api/index.ts", "src/mcp/index.ts"];

		for (const path of consumers) {
			const source = readFileSync(path, "utf8");
			expect(source).not.toMatch(/from\s+["'][^"']*core\/linkedin\//);
		}
	});

	test("keeps core independent from api and mcp", async () => {
		const coreFiles = targetFiles.filter(
			(path) => path.startsWith("src/core/") && path.endsWith(".ts"),
		);
		for (const path of coreFiles) {
			const source = readFileSync(path, "utf8");
			expect(source).not.toMatch(/from\s+["'][^"']*\/(?:api|mcp)\//);
		}
	});
});
