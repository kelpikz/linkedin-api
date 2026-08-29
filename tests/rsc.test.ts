import { describe, expect, test } from "bun:test";
import { parseProfile, parseSearchSuggestions } from "../src/linkedin/rsc.ts";

describe("RSC parser", () => {
  test("extracts search suggestions from navigation payloads", () => {
    const payload = [
      '1:["$","div",null,{"action":{"payload":{"vanityName":"satyanadella","searchTerm":"Satya Nadella","vieweeProfileId":"abc123"}}}]',
    ].join("\n");
    expect(parseSearchSuggestions(payload)).toEqual([
      {
        name: "Satya Nadella",
        vanityName: "satyanadella",
        profileId: "abc123",
        url: "https://www.linkedin.com/in/satyanadella/",
      },
    ]);
  });

  test("extracts profile name, top card, and about section", () => {
    const payload = [
      '0:[["$","title",null,{"children":"Satya Nadella | LinkedIn"}]]',
      '1:["$","div",null,{"observabilityIdentifier":"com.linkedin.sdui.impl.profile.components.aboutSection","child":{"initialContent":"$L2"}}]',
      '2:["$","section",null,{"children":["$L3","$L4"]}]',
      '3:["$","h2",null,{"children":["About"]}]',
      '4:["$","p",null,{"children":["Chairman and Chief Executive Officer at Microsoft."]}]',
      '5:["$","section",null,{"viewTrackingSpecs":{"viewName":"profile-top-card"},"children":["$L6","$L7","$L8"]}]',
      '6:["$","h1",null,{"children":["Satya Nadella"]}]',
      '7:["$","p",null,{"children":["Chairman and Chief Executive Officer at Microsoft"]}]',
      '8:["$","p",null,{"children":["Redmond, Washington, United States"]}]',
    ].join("\n");

    const profile = parseProfile(payload, "satyanadella", "abc123");
    expect(profile.name).toBe("Satya Nadella");
    expect(profile.headline).toBe("Chairman and Chief Executive Officer at Microsoft");
    expect(profile.location).toBe("Redmond, Washington, United States");
    expect(profile.about).toBe("Chairman and Chief Executive Officer at Microsoft.");
  });
});
