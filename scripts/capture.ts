import { loadLinkedInConfig } from "../src/linkedin/config.ts";

// Every profile endpoint below is keyed by vanityName alone. No profileId needed.
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

const config = loadLinkedInConfig();

const b64 = (n: number) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString("base64");
const hex = (n: number) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString("hex");

function headers(pageKey: string, refererPath: string): Headers {
  const trackingId = b64(16);
  const forestId = hex(16);
  const spanId = hex(8);

  return new Headers({
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json",
    cookie: config.cookie,
    "csrf-token": config.csrfToken,
    origin: "https://www.linkedin.com",
    referer: `https://www.linkedin.com${refererPath}`,
    "user-agent": config.userAgent,
    "x-li-anchor-page-key": pageKey,
    "x-li-application-instance": config.applicationInstance ?? "",
    "x-li-application-version": config.appVersion,
    "x-li-page-instance": `urn:li:page:${pageKey};${trackingId}`,
    "x-li-page-instance-tracking-id": trackingId,
    "x-li-pageforestid": forestId,
    "x-li-rsc-stream": "true",
    "x-li-traceparent": `00-${forestId}-${spanId}-00`,
    "x-li-tracestate": `LinkedIn=${spanId}`,
    "x-li-track": JSON.stringify({
      clientVersion: config.appVersion,
      mpVersion: config.appVersion,
      osName: "web",
      timezoneOffset: 5.5,
      timezone: "Asia/Calcutta",
      deviceFormFactor: "DESKTOP",
      mpName: "web",
      displayDensity: 1.25,
      displayWidth: 1600,
      displayHeight: 1000,
    }),
  });
}

async function fetchPayload(path: string, pageKey: string, payload: Record<string, unknown>): Promise<string> {
  const response = await fetch(`https://www.linkedin.com${path}`, {
    method: "POST",
    headers: headers(pageKey, path),
    redirect: "manual",
    body: JSON.stringify({
      requestedArguments: {
        payload,
        states: [],
        requestMetadata: { $type: "proto.sdui.common.RequestMetadata" },
        screenId: "",
        knownTemplateIds: [],
      },
      isPrefetch: true,
    }),
  });

  const text = await response.text();
  if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
  if (/^\s*</.test(text)) throw new Error("HTML login or challenge page");
  return text;
}

function sectionsIn(payload: string): string[] {
  const matches = payload.matchAll(/"observabilityIdentifier":"[^"]*profile\.components\.([^"]*)"/g);
  return [...new Set([...matches].map((match) => match[1]))].filter((id) => /detail|section|card/i.test(id));
}

async function save(vanityName: string, label: string, payload: string): Promise<void> {
  const path = `fixtures/raw/${vanityName}/${label}.txt`;
  await Bun.write(path, payload);
  const found = sectionsIn(payload);
  console.log(`  ${label.padEnd(24)} ${String(Math.round(payload.length / 1024)).padStart(4)} KB  ${found.join(", ") || "no profile sections"}`);
}

async function capture(vanityName: string): Promise<void> {
  console.log(`\n${vanityName}`);

  try {
    const page = await fetchPayload(`/flagship-web/in/${encodeURIComponent(vanityName)}/`, "d_flagship3_profile_view_base", {
      vanityName,
      isVanityNameResolved: true,
    });
    await save(vanityName, "page", page);
  } catch (error) {
    console.log(`  page                     FAILED: ${(error as Error).message}`);
    return;
  }

  for (const section of DETAIL_SECTIONS) {
    const path = `/flagship-web/in/${encodeURIComponent(vanityName)}/details/${section}/`;
    try {
      await save(vanityName, `details-${section}`, await fetchPayload(path, "profile_view_base_details", {
        vanityName,
        isVanityNameResolved: true,
        sectionType: section,
      }));
    } catch (error) {
      console.log(`  details-${section.padEnd(15)} FAILED: ${(error as Error).message}`);
    }
  }
}

const names = Bun.argv.slice(2);
if (!names.length) {
  console.error("Usage: bun scripts/capture.ts <vanity-name> [vanity-name ...]");
  process.exit(1);
}

for (const name of names) await capture(name);
