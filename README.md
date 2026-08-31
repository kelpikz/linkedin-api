# LinkedIn profile API

This Bun and TypeScript service accepts a LinkedIn profile URL and returns structured JSON. It calls LinkedIn's private web endpoints with a personal session cookie. LinkedIn can change these endpoints without notice.

## Setup

Copy `.env.example` to `.env`, then add the Cookie header from a signed-in `linkedin.com` request. Wrap the value in quotes so semicolons remain part of the value:

```powershell
Copy-Item .env.example .env
```

```dotenv
LINKEDIN_COOKIE="cookie-name=value; JSESSIONID=\"ajax:example\"; another-cookie=value"
```

`LINKEDIN_CSRF_TOKEN` is optional when the cookie contains `JSESSIONID`. The service derives the token from that cookie.

The service generates LinkedIn's per-request page and trace headers. `LINKEDIN_APPLICATION_INSTANCE` and `LINKEDIN_X_LI_TRACK` remain optional overrides if LinkedIn changes the values used by the current web build.

Never commit `.env`, HAR files, cookies, or CSRF values.

## Run

```powershell
bun run start
```

Search for profiles:

```powershell
Invoke-RestMethod 'http://localhost:3000/api/search?q=bill%20gates'
```

Search returns each matching profile's name, vanity name, LinkedIn URL, and
profile image when LinkedIn supplies one. It makes one LinkedIn typeahead call
and does not fetch the matching profiles.

The web app loads LinkedIn profile images through its own `/api/profile-image/`
route. This avoids browser extensions blocking the CDN as a third-party request.

Request a profile:

```powershell
Invoke-RestMethod 'http://localhost:3000/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fwilliamhgates%2F'
```

Profile requests do not depend on search results or `profileId`.

By default, a request fetches identity, About, experience, education, skills,
certifications, and languages. Use `sections` to limit the upstream calls:

```powershell
Invoke-RestMethod 'http://localhost:3000/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fwilliamhgates%2F&sections=experience,education'
```

The response includes `meta.extracted` and `meta.missing`. An empty array means
LinkedIn returned a recognized empty section. A section is `null` and appears in
`meta.missing` when its request fails or its current payload cannot be recognized.

## Known limitations

- LinkedIn's web endpoints and Flight component shapes are undocumented and can
  change without notice.
- A default uncached profile request makes about ten upstream calls. The service
  caps concurrency at four and lets one failed section return as missing without
  failing the rest of the profile.
- Skills and languages come from `details/skills/` and `details/languages/`.
  Their initial responses contain pagers rather than the complete rows, so the
  service follows every `nextPageRequest` until LinkedIn returns no next page.
  The corresponding profile-card components are previews and are incomplete.
- The profile image comes from the authenticated profile HTML's high-priority
  image tag. The profile Flight payload also contains unrelated member images.
- The previously failing volunteering route is
  `details/volunteering-experiences/`. Volunteering is not part of the current
  public response schema.
- A LinkedIn login or challenge page means the personal session cookie must be
  refreshed.

## Verify against a HAR

The verifier reads response bodies and reports decoded Flight chunk counts. It does not make network requests:

```powershell
bun run verify:har 'C:\path\to\capture.har'
```

## Tests

```powershell
bun test
```

If LinkedIn returns a login or challenge page, refresh `LINKEDIN_COOKIE`. If the request structure changes, capture a current request and update `LINKEDIN_APP_VERSION` or the request builders.
