import { parseRscChunks } from "../src/core/linkedin/flight/index.ts";
import { readHar, requestJson, responseText } from "./lib/har.ts";

const paths = Bun.argv.slice(2);
if (!paths.length) {
	console.error("Usage: bun run verify:har <capture.har> [capture.har ...]");
	process.exit(1);
}

for (const path of paths) {
	const har = await readHar(path);
	const profilePayloads = [];

	for (const entry of har.log.entries) {
		if (
			entry.request.method !== "POST" ||
			!entry.request.url.includes("/flagship-web/in/")
		) {
			continue;
		}

		const body = requestJson(entry);
		const text = responseText(entry);
		if (!body || !text) continue;

		const requested = body.requestedArguments as
			| Record<string, unknown>
			| undefined;
		const payload = requested?.payload as Record<string, unknown> | undefined;
		const vanityName = payload?.vanityName;
		if (typeof vanityName !== "string") continue;

		profilePayloads.push({
			vanityName,
			endpoint: new URL(entry.request.url).pathname,
			chunkCount: parseRscChunks(text).size,
		});
	}

	console.log(JSON.stringify({ file: path, profilePayloads }, null, 2));
}
