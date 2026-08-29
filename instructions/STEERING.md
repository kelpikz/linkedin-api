# Steering log

Corrections Ajitha has given agents on this project. Read this at the start of
every session, before planning or writing code.

## How to use this file

Newest entries go at the top, so the first screen holds the most recent
corrections.

Add an entry when you are redirected in a way that would recur on another day.
A correction about how to work belongs here. A fact about the task at hand does
not.

Keep each entry to a few lines. Say what you did, what Ajitha said, and the rule
that follows.

When a correction becomes a standing project rule, put the rule in `../AGENTS.md`
and leave the entry here as the record of where it came from. Do not write the
same rule into both files twice over.

Delete entries that stop being true. A log nobody trusts gets skipped.

---

## 2026-08-29 Apply the unslop style without being asked

Wrote several replies in default assistant voice. Ajitha invoked `/unslop` three
times in one session, twice asking for the same answer again.

**Rule:** The unslop style is the default for everything a human reads, including
chat replies, commit messages, and any markdown in this repo. Do not wait to be
asked. The global instruction to use Simplified Technical English in documents
applies on top of it.

## 2026-08-29 Set up the full module layout before writing features

Planned to grow the directory structure ticket by ticket as each part was needed.

Ajitha: the scope is known, so set the project up in that shape first.

**Rule:** When the target structure is already decided, create it up front,
placeholders included. Do not restructure incrementally while also building
features. This became T-04.

## 2026-08-29 Make the app work before touching infrastructure

Ordered the plan so a walking skeleton deployed to a VPS came first, to settle the
datacenter IP risk early. Argued for keeping a short version of it when the order
changed.

Ajitha: defer all of it, make sure the app works first.

**Rule:** Build the working thing before Docker, hosting, and deployment
pipelines, even when there is a real risk in deferring. Say the risk once, record
it, then follow the instruction. The record is the amendment in
`../docs/adr/adr-0002-vps-deployment-with-proxy-seam.md`.

## 2026-08-29 Nothing inside docs/ gets committed

Created `docs/adr/` and `docs/TICKETS.md` and planned to commit them.

Ajitha: do not commit anything inside docs.

**Rule:** `docs/` is gitignored. The README is the only documentation that ships.
Anything a reviewer needs must be in `README.md`. Already in `../AGENTS.md`.

## 2026-08-29 Public figures only, never private individuals

Captured fixtures from two private people's LinkedIn profiles and used their names
throughout the docs and examples.

Ajitha: those names leak personal information, use famous people instead.

**Rule:** Fixtures, tests, examples, and documents use public figures only.
`williamhgates` and `satyanadella` are the working set. Already in `../AGENTS.md`.

## 2026-08-29 Do not reach for a heavier tool than the deadline justifies

Raised Effect for typed errors and retry policy, and SQLite for cache persistence
and per-key quotas.

Ajitha: skip Effect, plain token auth is enough, no SQLite for now, add it later
if we want.

**Rule:** Default to the smallest thing that solves the problem in front of us.
Offer the heavier option once with its cost, then drop it. Reasoning is in
`../docs/adr/adr-0003-static-bearer-token-auth.md` and
`../docs/adr/adr-0004-plain-typescript-error-handling.md`.
