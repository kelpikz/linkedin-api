import {
	fetchProfilePage,
	fetchProfileSection,
} from "../src/core/linkedin/endpoints/profile.ts";
import {
	createLinkedInHttp,
	loadLinkedInConfig,
} from "../src/core/linkedin/http.ts";

const DETAIL_SECTIONS = [
	"experience",
	"education",
	"skills",
	"certifications",
	"languages",
	"courses",
	"projects",
	"honors",
	"volunteering",
	"publications",
	"recommendations",
];

const http = createLinkedInHttp(loadLinkedInConfig());

function sectionsIn(payload: string): string[] {
	const matches = payload.matchAll(
		/"observabilityIdentifier":"[^"]*profile\.components\.([^"]*)"/g,
	);
	return [...new Set([...matches].map((match) => match[1]))].filter(
		(id) => id && /detail|section|card/i.test(id),
	) as string[];
}

async function save(
	vanityName: string,
	label: string,
	payload: string,
): Promise<void> {
	const path = `fixtures/raw/${vanityName}/${label}.txt`;
	await Bun.write(path, payload);
	const found = sectionsIn(payload);
	console.log(
		`  ${label.padEnd(24)} ${String(Math.round(payload.length / 1024)).padStart(4)} KB  ${found.join(", ") || "no profile sections"}`,
	);
}

async function capture(vanityName: string): Promise<void> {
	console.log(`\n${vanityName}`);

	try {
		await save(vanityName, "page", await fetchProfilePage(http, vanityName));
	} catch (error) {
		console.log(`  page                     FAILED: ${(error as Error).message}`);
		return;
	}

	for (const section of DETAIL_SECTIONS) {
		try {
			await save(
				vanityName,
				`details-${section}`,
				await fetchProfileSection(http, vanityName, section),
			);
		} catch (error) {
			console.log(
				`  details-${section.padEnd(15)} FAILED: ${(error as Error).message}`,
			);
		}
	}
}

const names = Bun.argv.slice(2);
if (!names.length) {
	console.error("Usage: bun scripts/capture.ts <vanity-name> [vanity-name ...]");
	process.exit(1);
}

for (const name of names) await capture(name);
