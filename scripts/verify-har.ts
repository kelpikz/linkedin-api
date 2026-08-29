import { readHar, requestJson, responseText } from "../src/linkedin/har.ts";
import { parseProfile, parseSearchSuggestions } from "../src/linkedin/rsc.ts";

const paths = Bun.argv.slice(2);
if (!paths.length) {
  console.error("Usage: bun run verify:har <capture.har> [capture.har ...]");
  process.exit(1);
}

for (const path of paths) {
  const har = await readHar(path);
  const searches = [];
  const profiles = [];

  for (const entry of har.log.entries) {
    const body = requestJson(entry);
    const payload = responseText(entry);
    if (!payload) continue;

    if (body?.requestId === "com.linkedin.sdui.search.requests.SearchGlobalTypeaheadRequestAction") {
      const suggestions = parseSearchSuggestions(payload);
      if (suggestions.length) searches.push(...suggestions);
    }

    if (entry.request.method === "POST" && entry.request.url.includes("/flagship-web/in/")) {
      const requested = body?.requestedArguments as Record<string, unknown> | undefined;
      const requestPayload = requested?.payload as Record<string, unknown> | undefined;
      const vanityName = requestPayload?.vanityName;
      const profileId = requestPayload?.vieweeProfileId;
      if (typeof vanityName === "string" && typeof profileId === "string") {
        const profile = parseProfile(payload, vanityName, profileId);
        profiles.push({
          name: profile.name,
          vanityName: profile.vanityName,
          headline: profile.headline,
          about: profile.about,
          sectionCount: profile.sections.length,
          topCard: profile.topCard,
        });
      }
    }
  }

  const uniqueSearches = [...new Map(searches.map((item) => [item.profileId, item])).values()];
  console.log(
    JSON.stringify(
      {
        file: path,
        searchSuggestions: uniqueSearches,
        profiles,
      },
      null,
      2,
    ),
  );
}
