import { describe, expect, test } from "bun:test";
import {
	createLinkedInHttp,
	createLinkedInPageContext,
	type LinkedInConfig,
} from "../src/core/linkedin/http.ts";

const config: LinkedInConfig = {
	cookie: "cookie-name=test",
	csrfToken: "ajax:test",
	appVersion: "0.2.test",
	userAgent: "test",
};

describe("LinkedIn HTTP page context", () => {
	test("fetches profile HTML as a browser navigation", async () => {
		let method: string | undefined;
		let headers = new Headers();
		const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
			method = init?.method;
			headers = new Headers(init?.headers);
			return new Response(
				"<!doctype html><script>window.__como_rehydration__ = [];</script>",
				{ status: 200, headers: { "content-type": "text/html" } },
			);
		}) as typeof fetch;
		const http = createLinkedInHttp(config, fetcher);

		const result = await http.get?.({
			path: "/in/satyanadella/",
			refererPath: "/in/satyanadella/",
		});

		expect(result).toContain("window.__como_rehydration__");
		expect(method).toBe("GET");
		expect(headers.get("cookie")).toBe(config.cookie);
		expect(headers.get("csrf-token")).toBeNull();
		expect(headers.get("x-li-rsc-stream")).toBeNull();
	});

	test("reuses page-bound headers for requests in one context", async () => {
		const headers: Headers[] = [];
		const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
			headers.push(new Headers(init?.headers));
			return new Response("1:{}", {
				status: 200,
				headers: { "content-type": "text/x-component" },
			});
		}) as typeof fetch;
		const http = createLinkedInHttp(config, fetcher);
		const context = createLinkedInPageContext();
		const request = {
			path: "/flagship-web/in/satyanadella/details/education/",
			pageKey: "d_flagship3_profile_view_base_education_details",
			refererPath: "/in/satyanadella/details/education/",
			body: { requestedArguments: { payload: {} } },
			context,
		};

		await http.post(request);
		await http.post({
			...request,
			path: "/flagship-web/rsc-action/actions/pagination",
		});

		expect(headers).toHaveLength(2);
		expect(headers[0]?.get("x-li-page-instance")).toBe(
			headers[1]?.get("x-li-page-instance"),
		);
		expect(headers[0]?.get("x-li-pageforestid")).toBe(
			headers[1]?.get("x-li-pageforestid"),
		);
	});
});
