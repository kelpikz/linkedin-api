# LinkedIn profile API

This Bun and TypeScript service accepts a LinkedIn profile URL and returns structured JSON. It calls LinkedIn's private web endpoints with a personal session cookie. LinkedIn can change these endpoints without notice.

Live deployment: [https://ajitha.fyi](https://ajitha.fyi)

Source code: [github.com/kelpikz/linkedin-api](https://github.com/kelpikz/linkedin-api)

## Requirements
- Public HTTPS deployment at [https://ajitha.fyi](https://ajitha.fyi)
- A profile endpoint that accepts a LinkedIn profile URL
- Structured profile data for name, headline, location, About, experience,
  education, skills, certifications, languages, and profile images when available
- Backend use of a personal LinkedIn session, without exposing it to clients
- Public source code at [github.com/kelpikz/linkedin-api](https://github.com/kelpikz/linkedin-api)
- Setup, API, approach, and limitation documentation in this README
- No credentials or secrets in the repository

## Tech stack
- **Bun** and **TypeScript**
- **Hono** for the HTTP API
- **React**, **Vite**, and **Tailwind CSS** for the web app
- **Zod** for the shared response contract
- **Docker Compose** and **Caddy** for deployment and automatic TLS
- LinkedIn's private web endpoints and **Flight/RSC** payloads

## Setup

Local setup needs Bun and a signed-in LinkedIn browser session. Docker setup also
needs Docker Compose. Clone the repository and install dependencies:

```bash
git clone https://github.com/kelpikz/linkedin-api.git
cd linkedin-api
bun install
cp .env.example .env
```

Set the full `Cookie` request header copied from a signed-in `linkedin.com`
request. Keep semicolons inside the quoted value. Set one or more private API
keys in `API_KEYS`:

```dotenv
LINKEDIN_COOKIE="cookie-name=value; JSESSIONID=\"ajax:example\"; another-cookie=value"
API_KEYS=$LINKEDIN_API_KEY
```

`LINKEDIN_CSRF_TOKEN` is optional when the cookie contains `JSESSIONID`. The
service derives it from that cookie. The other LinkedIn header values in
`.env.example` are optional overrides for changes in LinkedIn's web client.

Run locally:

```bash
bun run build
bun run start
```

The local service listens on `http://localhost:3000`.

For the HTTPS deployment, point the domain's DNS records at the server, set
`SITE_ADDRESS` in `.env`, and allow inbound TCP ports 80 and 443:

```dotenv
SITE_ADDRESS=ajitha.fyi
```

Start the app and Caddy with:

```bash
docker compose up -d --build
curl https://ajitha.fyi/health
```

Caddy obtains and renews the TLS certificate when `SITE_ADDRESS` is a hostname.
Use `SITE_ADDRESS=:80` only for a local plain-HTTP Compose run.

Never commit `.env`, cookies, CSRF tokens, API keys, HAR files, or captured raw
payloads.

## Architecture

```text
Browser or API client
        |
        v
Hono API + bearer auth
   |-- /api/search ------------> LinkedIn typeahead
   |-- /api/profile -----------> profile-service
   `-- /profile-images/:token -> same-origin image proxy
                                  |
                                  v
                         LinkedIn profile endpoints
                                  |
                                  v
                       Flight decoder + extractors
                                  |
                                  v
                          shared Zod schema -> JSON
```

## API

The deployed base URL is `https://ajitha.fyi`. Local examples use
`http://localhost:3000`. All `/api/*` routes require:

```http
Authorization: Bearer $LINKEDIN_API_KEY
```

| Endpoint | Parameters | Returns |
| --- | --- | --- |
| `GET /health` | None | `{"ok":true}` |
| `GET /api/search` | `q`, 1 to 100 characters | Matching names, vanity names, URLs, and images. One typeahead request only. |
| `GET /api/profile` | `url`; optional `sections` | Normalized profile JSON. Sections are `experience`, `education`, `skills`, `certifications`, and `languages`. |
| `GET /profile-images/:token` | Image URL token | Same-origin image proxy used by the web app. |

Examples:

```bash
curl 'https://ajitha.fyi/api/search?q=bill%20gates' \
  --header "Authorization: Bearer $LINKEDIN_API_KEY"

curl 'https://ajitha.fyi/api/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fwilliamhgates%2F&sections=experience,education' \
  --header "Authorization: Bearer $LINKEDIN_API_KEY"
```

The profile JSON contains `sourceUrl`, identity and About fields, profile image,
the five detail collections, and `meta.extracted` / `meta.missing`. Detail rows
are typed in `src/core/schema.ts`. Recognized empty collections are `[]`.
Unavailable requested sections are `null` and appear in `meta.missing`.

API errors use `400` for invalid input, `401` for missing or invalid bearer
tokens, `404` for unknown routes, and `502` when an image cannot be proxied.

## Approach

The implementation works in these steps:

- Parse the submitted LinkedIn URL and use its `vanityName` for upstream calls.
- Fetch the profile page, authenticated HTML, and selected detail endpoints.
- Limit concurrent LinkedIn requests to four and isolate section failures.
- Decode Flight/RSC payloads with a generic decoder.
- Run section extractors and validate the result with the shared Zod schema.
- Follow `nextPageRequest` for skills and languages, with loop detection and a
  100-page safety limit.
- Prefer the high-priority HTML profile image and use Flight data as a fallback.

## Limitations

- LinkedIn's private endpoints and payloads can change without notice.
- The backend needs a current personal LinkedIn session cookie. Login or
  challenge HTML means the cookie must be refreshed.
- A default uncached profile request makes about ten upstream calls. Skills and
  languages can add paginated calls.
- Profile visibility and the signed-in account affect the returned fields.
- Missing requested sections appear as `null` and in `meta.missing`.
- Volunteering is not in the public response schema. The working LinkedIn route
  is `details/volunteering-experiences/`.
- There is no persistent cache or rate-limit store yet. The service does not
  speculatively fetch unrequested sections.

## Tests

```bash
bun test
bun run typecheck
```

If LinkedIn returns a login or challenge page, refresh `LINKEDIN_COOKIE`. If the request structure changes, capture a current request and update `LINKEDIN_APP_VERSION` or the request builders.
