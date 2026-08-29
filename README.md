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

Search returns each matching profile's name, vanity name, and LinkedIn URL. It
makes one LinkedIn typeahead call and does not fetch the matching profiles.

Request a profile:

```powershell
Invoke-RestMethod 'http://localhost:3000/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fwilliamhgates%2F'
```

Profile requests do not depend on search results or `profileId`.

The current foundation returns the requested URL and schema-valid null values. Later extraction tickets fill the name, headline, location, About text, profile image, experience, education, skills, certifications, and languages.

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
