interface HarEntry {
	request: {
		method: string;
		url: string;
		postData?: { text?: string };
	};
	response: {
		content: {
			encoding?: string;
			text?: string;
		};
	};
}

interface HarFile {
	log: { entries: HarEntry[] };
}

export async function readHar(path: string): Promise<HarFile> {
	return JSON.parse(await Bun.file(path).text()) as HarFile;
}

export function responseText(entry: HarEntry): string | null {
	const text = entry.response.content.text;
	if (!text) return null;
	return entry.response.content.encoding === "base64"
		? Buffer.from(text, "base64").toString("utf8")
		: text;
}

export function requestJson(
	entry: HarEntry,
): Record<string, unknown> | null {
	const text = entry.request.postData?.text;
	if (!text) return null;
	try {
		return JSON.parse(text) as Record<string, unknown>;
	} catch {
		return null;
	}
}
