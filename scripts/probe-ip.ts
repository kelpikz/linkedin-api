/**
 * T-20: does LinkedIn answer a call from this machine?
 *
 * Run this on the VPS before deploying anything. It uses the real request
 * path, so a pass here means the app will work from this IP.
 *
 *   bun scripts/probe-ip.ts [vanityName]
 */
import { loadLinkedInConfig, createLinkedInHttp } from "../src/core/linkedin/http.ts";
import { fetchProfilePage } from "../src/core/linkedin/endpoints/profile.ts";
import { LinkedInRequestError } from "../src/core/errors.ts";

const vanityName = process.argv[2] || "williamhgates";

const egress = await fetch("https://api.ipify.org").then((r) => r.text()).catch(() => "unknown");
console.log(`egress IP:   ${egress}`);
console.log(`proxy:       ${Bun.env.LINKEDIN_PROXY_URL || "none"}`);
console.log(`profile:     ${vanityName}`);
console.log("");

try {
  const http = createLinkedInHttp(loadLinkedInConfig());
  const payload = await fetchProfilePage(http, vanityName);
  const chunks = payload.split(/\r?\n/).filter((line) => /^[0-9a-f]+:/i.test(line)).length;
  console.log(`PASS. ${payload.length} bytes, ${chunks} Flight chunks.`);
  console.log("LinkedIn answers from this IP. Deploy here.");
} catch (error) {
  if (error instanceof LinkedInRequestError && error.status === 401) {
    console.log(`FAIL. ${error.message}`);
    console.log("");
    console.log("This is the challenge page, not an expired cookie, if the same");
    console.log("cookie still works from your laptop. Buy the residential proxy,");
    console.log("set LINKEDIN_PROXY_URL, and run this again.");
    process.exit(1);
  }
  console.log(`FAIL. ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
