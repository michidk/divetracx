# Read-only demo mode

The public demo at <https://divetracx.vercel.app/> is a separate **edition** of
the application, selected at build time rather than through a runtime flag.

## How it is built

```bash
bun run build:demo
```

This runs three steps:

1. `scripts/generate-demo-snapshot.ts` creates an in-memory PGlite database,
   applies every committed migration from `drizzle/`, seeds the fictional
   dataset, and dumps the result as a gzipped data directory.
2. `DIVETRACX_EDITION=demo vite build` compiles the application with the demo
   edition baked into the bundles.
3. `scripts/copy-pglite-assets.ts` copies the PGlite runtime and the snapshot
   into the Vercel Build Output.

At runtime the demo restores the snapshot into an ephemeral PGlite instance, so
there is no external database and nothing persists between requests.

## What the demo edition changes

- Server middleware rejects every non-`GET`/`HEAD` request, so nothing can be
  created, edited, imported, or exported.
- The UI shows a persistent read-only banner and a demo landing page.
- Integrations, export, and MCP are unavailable.

Because `DIVETRACX_EDITION` is read only by `vite.config.ts`, no runtime
environment variable can turn a production build into a demo or a demo build
into a production instance.

## The fixture

The demo holds seven dives with real-shaped but fully anonymized profiles, five
fictional sites, three fictional buddies, and no contact, insurance,
certification-number, or provenance data. `bun run db:seed` loads exactly the
same dataset into a regular PostgreSQL database for local development.
