# AGENTS.md

## Read first

`instructions/STEERING.md` records every correction Ajitha has given on this project.
Read it before planning or writing code.

When Ajitha redirects you in a way that would recur on another day, add an entry
at the top of that file. If the correction is a standing rule, put the rule in
this file and leave the entry there as the record.

## Project

A Bun and TypeScript service that calls undocumented LinkedIn web endpoints with a
personal session cookie and returns structured JSON.

One profile costs about ten upstream calls on a personal account. Caching,
prefetching, and test rules all follow from that.

## Commands

```bash
bun test                          # all tests
bun test tests/rsc.test.ts        # one file
bun test -t "extracts search"     # one test by name
bunx tsc --noEmit                 # typecheck
bun scripts/capture.ts <vanity>   # refresh fixtures/raw/, hits LinkedIn
```

Do not start a dev server unless asked.

## Never do this

- Never commit `.env`, cookies, CSRF tokens, `*.har`, `fixtures/raw/`, or `docs/`.
- Never name a private individual in an example, test, or document. Use public
  figures. `williamhgates` and `satyanadella` are the working fixtures.
- Never paste a captured payload into a test. They are ~700 KB of real profile
  data.
- Never let a test hit the network.
- Never add speculative prefetching. Each extra section is another call against
  the account.
- Never put an API key in the repo, README examples included. Use
  `$LINKEDIN_API_KEY` as the placeholder.

## Boundaries

Target layout and reasoning are in `docs/adr/adr-0001-shared-core-with-three-surfaces.md`.

- `core` never imports from `api`, `mcp`, or `web`.
- `api`, `mcp`, and `web` all call `profile-service.getProfile()`. Do not
  reimplement fetching or parsing inside one of them.
- `src/core/schema.ts` is the single response contract. Types, MCP tool schemas,
  and the README API docs derive from it. Change it there, not in the consumers.
- Extractors return their section or `null`, and never throw. Missing sections go
  in `meta.missing`.
- The Flight decoder under `core/linkedin/flight/` stays generic. No profile
  knowledge in it.

## LinkedIn gotchas

These look like bugs and are not.

- Every profile endpoint is keyed by `vanityName` alone. `vieweeProfileId` changes
  nothing. The old search-then-profileId flow is dead. Do not reintroduce it.
- Profile data spans about ten endpoints, not one. The page call returns top card,
  about, featured, and an experience summary. Most collections come from
  `POST /flagship-web/in/<vanity>/details/<section>/`.
- `profileCardsActivity` is the posts feed, despite the name.
- The top card can contain several `profile-displayphoto` assets. Use the
  authenticated profile HTML's `<img fetchPriority="high">` and its largest
  `srcSet` rendition. Flight is only a fallback. Do not choose by URL shape or
  largest area alone.
- A challenge or login page arrives as HTTP 200 with an HTML body. Check the body,
  not only the status.
- Skills and languages come from `details/skills/` and `details/languages/`.
  Their rows arrive through `nextPageRequest` pagination, including the first
  batch at `start: 0`; follow pagers until none remains. The profile-card
  components contain previews only. `details/volunteering/` returns 404; use
  `details/volunteering-experiences/` instead.

## Testing

TDD. Write the failing test first.

Test input is handwritten Flight chunk strings, in the style of
`tests/rsc.test.ts`. `fixtures/raw/` is for the capture script and manual
exploration, never for test input. One hand-sanitized fixture is committed.

## Plan and decisions

`instructions/` is committed. `docs/` is gitignored and local only. Put anything
another person needs to read in `instructions/` or `README.md`.

`docs/TICKETS.md` has the build order and `docs/adr/` has the decisions, both
local. `instructions/STEERING.md` has past corrections and ships with the repo.

Read ADR-0001 before changing module structure, ADR-0003 before touching auth, and
ADR-0004 before adding an error-handling library.

## Commits

One short line. Prefix with `feat`, `fix`, `chore`, or `doc`. No co-author line.
