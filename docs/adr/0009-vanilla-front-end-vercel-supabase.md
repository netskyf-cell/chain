# ADR-0009: Vanilla front end on Vercel and Supabase

- **Status:** accepted
- **Date:** 2026-10-01
- **Deciders:** Product owner
- **Related:** architecture §9. Restates decisions of 2026-08-31.

## Context

Chain is read-heavy and has a small number of views. It is built with Claude Code by one person first, and published as a showcase, so a low-ceremony stack that anyone can read matters. The first design export from Claude Design runs on a React-based runtime. That export is a reference for look and behaviour, not production code.

## Decision

We will build the front end with vanilla HTML, CSS variables, ES modules and hash routing (`/#/route`), with no build step. The API is Vercel serverless functions. Data and authentication are a dedicated Supabase project with row-level security on every table. Chain shares no infrastructure with any other product.

## Consequences

- Fast to build and easy to read. A visitor to the public repository can follow it.
- No framework conventions to lean on; the team writes small view modules and a router.
- Hash routing avoids refresh 404s on static hosting. Every internal link is `/#/…`.
- The Claude Design export is rebuilt in vanilla, taking only its tokens and layout.
- **Revisit trigger:** more than 8 views, or state shared across views that needs a store. If either happens, a new ADR decides whether to adopt a framework.

## Alternatives considered

| Option | Why not (now) |
|---|---|
| React or similar with a build step | More setup than the problem needs today; revisit by the trigger above |
| Use the Claude Design runtime directly | Loads a runtime from a CDN; not a production foundation |
| Server-rendered pages | Needs a different hosting model; hash-routed static pages are enough |
