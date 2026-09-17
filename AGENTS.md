# PSA website working agreement

## Product and visual authority
- Work in Russian with the owner; public website content is English unless requested otherwise.
- The site is one corporate website, initially Enterprise IoT and Rail. Future verticals extend this structure.
- eIoT authority: the supplied `psa-landing-source.zip` (preserved locally in `reference/eiot`). Rail visual authority: root `image 1.png`. The other two images are alternatives, not the baseline.
- Preserve the light/blue eIoT and dark/petrol/orange Rail contrast. Navigation composition, logo, contact data and interaction conventions are shared.
- Never silently redesign an unaffected section. First record intended changes and affected shared components in `reports/<version>-changes.md`.

## Architecture
- Deliver plain HTML/CSS/JS/resources. Every version must work by opening its `index.html` directly using file://; no backend, dev server, port, package installation or build is required to VIEW it.
- Node is development tooling only. The build uses the standard library. Use the existing centralized Playwright/Sharp installations via ignored `tools.local.json` for QA/asset processing. Read the shared ENVIRONMENT.md before installing tools.
- Edit `src/` and `scripts/`, never published output. Shared site identity/contact/navigation lives in `src/site.json`; the shared header/footer/contact templates in `scripts/build.cjs`; tokens and shared components in `src/site.css`.
- Icons are pre-rendered from a local Lucide subset (`src/icons.json`). No runtime CDN, external fonts, analytics, cookie storage or remote JS.
- All vertical-to-vertical links are version-relative and use explicit index.html for file:// compatibility.
- Prefer HTML/SVG for interface graphics; maintain accessible native details, headings, labels, keyboard controls, focus indicators and reduced-motion support. Do not hide content permanently when JS is unavailable.

## Git and immutable publication
- Repository: https://github.com/WiktorBukato/psa-website . Pages base: https://wiktorbukato.github.io/psa-website/ . Verify remote before pushing.
- `docs/` is the only GitHub Pages public web root, branch main. No DNS/custom-domain/corporate production changes are authorized by the initial task.
- Each release is self-contained under `docs/vX.Y/` (patch versions also allowed): `index.html`, `eiot/index.html`, `rail/index.html`, `assets/`, `manifest.json`.
- NEVER edit, overwrite, delete or reuse a published version directory. Corrections get a new version. Older CSS, JS, images and links must remain byte-identical.
- `docs/index.html` is a version catalogue, not an auto-redirect. Adding a version may update this catalogue and `docs/releases.json`; no older default destination is silently replaced.
- `node scripts/build.cjs vX.Y` only writes `.staging/vX.Y/`. `node scripts/release.cjs vX.Y` refuses an existing release and requires matching successful browser QA evidence plus a visual-review record.
- `docs/releases.json` locks the SHA-256 of each release manifest. Before/after a release verify all old files and manifest hashes. The GitHub integrity workflow rejects changes to old release directories, even if someone regenerated a manifest.
- Publish only intentionally staged files. Reference ZIPs/mockups, internal reports and screenshots stay local/ignored. Never commit credentials or machine-specific config.

## Required regression gate for EVERY version
1. Write scope and expected visual/behavior changes. Enumerate all affected verticals for changes to shared code.
2. Build and run static validation: `node scripts/check.cjs vX.Y`.
3. Run `node scripts/browser-test.cjs vX.Y`. It opens actual files, checks 320/390/768/844-landscape/1440/1920/2560, links, images, mobile menu/Escape, disclosures, rail selectors and keyboard, contact/copy fallback, no-JS and enlarged text; saves full-page screenshots under `evidence/vX.Y/local/`.
4. Inspect desktop/mobile screenshots for BOTH verticals and the gateway, including below-fold sections. Automated checks alone do not establish visual quality.
5. For the second and later releases run `node scripts/compare.cjs OLD NEW`; inspect the side-by-side/diff evidence. Document why every changed region is intended, and explicitly record unchanged-section results. Never auto-approve a pixel mismatch.
6. Save `evidence/vX.Y/visual-review.json` with matching manifestSha256, reviewed: true, reviewer, scope, findings and (when applicable) comparison report path. Do this only after actual visual inspection.
7. Freeze, commit and push. Wait for successful Pages deployment. Re-run browser QA with the public version URL, and `node scripts/verify-live.cjs vX.Y` for HTTP and SHA-256 verification of every file.
8. Report exact evidence and limits. Browser emulation is not a physical phone test; installed Chrome is not Safari/Firefox. External mail clients and third-party forms are outside local E2E proof.

## Content and marketing
- Do not invent customer results, names, certifications, event participation, booth numbers or booked meetings. Reference imagery is not factual evidence.
- Approved factual source for this iteration: supplied eIoT copy/assets plus currently verified public PSA pages. Source/claim log and unresolved ownership are in local `reports/`.
- CTA currently uses general sales@psa.inc and the existing PSA contacts page; the owner said the exhibition CTA is not yet defined. Never implement a pretend form or pretend success.
- APTA TRANSform & EXPO 2026 is October 4–7, Chicago; EXPO floor October 5–7, McCormick Place. These dates were verified 2026-09-17. Owner has not confirmed exact event participation/booth. Keep event promotion off the site until confirmed.
- Maintain `reports/MARKETING-BACKLOG.md` with gaps, exact destination or interim behavior, owner, priority and acceptance criteria. Keep review deployment noindex until a production indexing decision.

## Coding standards
- Prefer architectural fixes, shared components and single sources of truth over local workarounds, duplicated strings and magic values. Check analogous behavior across pages.
- User prefers C#/.NET where technically sound; plain HTML/CSS/JS with a small Node build is the native choice for this explicitly static site.
- Do not delegate to subagents unless the user explicitly requests delegation.
