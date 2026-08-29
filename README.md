# LinkedIn internal API POC

This Bun and TypeScript service wraps the LinkedIn web requests found in the supplied HAR captures. It is intended for internal experimentation with an account you control. LinkedIn can change these private endpoints without notice.

## Setup

Copy `.env.example` to `.env`, then add the Cookie header from a signed-in `linkedin.com` request. Wrap the value in quotes so semicolons remain part of the value:

```powershell
Copy-Item .env.example .env
```

```dotenv
LINKEDIN_COOKIE="cookie-name=value; JSESSIONID=\"ajax:example\"; another-cookie=value"
```

`LINKEDIN_CSRF_TOKEN` is optional when the cookie contains `JSESSIONID`. The service derives the token from that cookie.

The POC generates LinkedIn's per-request page and trace headers. `LINKEDIN_APPLICATION_INSTANCE` and `LINKEDIN_X_LI_TRACK` remain optional overrides if LinkedIn changes the values used by the current web build.

Never commit `.env`, HAR files, cookies, or CSRF values.

## Run

```powershell
bun run start
```

Search for profiles:

```powershell
Invoke-RestMethod 'http://localhost:3000/api/search?q=bill%20gates'
```

Use a returned `vanityName` and `profileId` to fetch the profile:

```powershell
Invoke-RestMethod 'http://localhost:3000/api/profile/williamhgates?profileId=PROFILE_ID_FROM_SEARCH'
```

The profile response includes the normalized name, headline, location, About text, profile image, top-card text, and the visible text grouped by profile section.

## Verify against a HAR

The verifier reads response bodies without making network requests:

```powershell
bun run verify:har 'C:\path\to\capture.har'
```

## Tests

```powershell
bun test
```

If LinkedIn returns a login or challenge page, refresh `LINKEDIN_COOKIE`. If the request structure changes, capture a current request and update `LINKEDIN_APP_VERSION` or the request builders.
