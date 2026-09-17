# PSA corporate website

Two connected engineering verticals: Enterprise IoT and Rail. Built as a portable, progressively enhanced static website.

**Open the site:** [version catalogue](https://wiktorbukato.github.io/psa-website/).

## No server required

Open `docs/v0.1/index.html` in a browser, or copy the complete `docs/v0.1` directory to any static host. The deployed files use no server-side code, remote runtime dependencies, installation step or special port. Contact actions open an email client or the existing PSA contact page; no leads are stored by this site.

## Development

Node.js 22+ is used only to build and verify releases. `src/site.json` owns shared navigation and contact data. `src/pages` owns page content. `scripts/build.cjs` owns shared templates; it renders the local Lucide subset as inline SVG. The original eIoT reference was imported once; rebuilding does not require it.

```
node scripts/build.cjs v0.2
node scripts/check.cjs v0.2
node scripts/browser-test.cjs v0.2
node scripts/compare.cjs v0.1 v0.2
# Inspect evidence; write the matching visual-review.json only after review.
node scripts/release.cjs v0.2
```

Browser QA and image conversion use Playwright and Sharp as **development-only** tools. Reuse a centralized installation through an ignored `tools.local.json` with `moduleDirectory` and `chromeExecutable`, or make those modules resolvable by Node. The current machine uses installed Chrome; no browser download is needed. Main build and integrity scripts use only Node's standard library.

## Versioning

Each `docs/vX.Y` directory is a complete immutable website with its own assets. `docs/releases.json` records release manifest hashes. The root is an explicit version catalogue. Updates never redirect or replace an old version. See `AGENTS.md` for the complete release and regression gate.

## Content status

This is an English review release for exhibition preparation, with search indexing disabled. Rail design follows the supplied dark/orange concept. Public PSA content is used for the case-study destinations. The exhibition-specific CTA is still a marketing decision; the current contact is the general sales address. The rail hero is a generated illustration, not a customer-project photograph.

Reference files and private marketing/QA reports remain local. Icons are derived from Lucide under ISC; see `THIRD-PARTY-NOTICES.md`.
