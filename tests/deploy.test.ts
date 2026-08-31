import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const deploymentFiles = [
	"Dockerfile",
	"compose.yml",
	"Caddyfile",
	".dockerignore",
];

function read(path: string): string {
	return readFileSync(path, "utf8");
}

describe("deployment files", () => {
	test("ships the container, compose, and TLS configuration", () => {
		for (const path of deploymentFiles) {
			if (!existsSync(path)) {
				throw new Error(`Missing deployment file: ${path}`);
			}
		}
	});

	test("keeps secrets and raw payloads out of the build context", () => {
		const ignored = read(".dockerignore")
			.split(/\r?\n/)
			.map((line) => line.trim());

		for (const entry of [".env", "fixtures", "node_modules", "*.har", ".git"]) {
			expect(ignored).toContain(entry);
		}
	});

	test("reads the app environment from an untracked env file", () => {
		expect(read("compose.yml")).toMatch(/env_file:\s*\n\s*-\s*\.env/);
	});

	test("keeps the proxy URL out of compose", () => {
		expect(read("compose.yml")).not.toMatch(/LINKEDIN_PROXY_URL\s*[:=]/);
	});

	test("documents the proxy URL as optional configuration", () => {
		expect(read(".env.example")).toMatch(/^LINKEDIN_PROXY_URL=\s*$/m);
	});

	test("carries no credentials in any tracked deployment file", () => {
		for (const path of [...deploymentFiles, ".env.example", "Caddyfile"]) {
			const source = read(path);
			expect(source).not.toMatch(/\/\/[^/\s]+:[^@\s]+@/);
			expect(source).not.toMatch(
				/(?:LINKEDIN_COOKIE|LINKEDIN_CSRF_TOKEN|API_KEYS|LINKEDIN_PROXY_URL)[ 	]*[:=][ 	]*\S/,
			);
			expect(source).not.toMatch(/(?:li_at|JSESSIONID)[ 	]*=[ 	]*\S/);
		}
	});

	test("serves the app through Caddy on a configurable address", () => {
		const caddyfile = read("Caddyfile");
		expect(caddyfile).toMatch(/\{\$SITE_ADDRESS[^}]*\}/);
		expect(caddyfile).toMatch(/reverse_proxy\s+app:3000/);
	});

	test("defaults the site address to plain HTTP for local runs", () => {
		expect(read("compose.yml")).toMatch(/SITE_ADDRESS:\s*\$\{SITE_ADDRESS:-:80\}/);
	});
});
