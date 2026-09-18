# PSA corporate website

Two connected engineering verticals: Enterprise IoT and Rail. Built as a portable, progressively enhanced static website.

**Open the site:** [version catalogue](https://wiktorbukato.github.io/psa-website/).

## No server required

Open `docs/v0.4.1/index.html` in a browser, or copy the complete `docs/v0.4.1` directory to any static host. The deployed files use no server-side code, remote runtime dependencies, installation step or special port. Contact actions open an email client or the existing PSA contact page; no leads are stored by this site.

## Development

Node.js 22+ is used only to build and verify releases. `src/site.json` owns shared navigation, contact data and the current development version. `src/pages` owns page content; `src/styles` owns the vertical styles. `scripts/build.cjs` owns shared templates; it renders local Lucide and reference-matched line icons as inline SVG. The original eIoT reference was imported once; rebuilding does not require it. `scripts/import-reference-design.cjs` is an explicit one-time restoration tool, not part of the build.

```
node scripts/build.cjs v0.4.1
node scripts/check.cjs v0.4.1
node scripts/browser-test.cjs v0.4.1
node scripts/rail-motion-test.cjs v0.4.1
node scripts/rail-visual-motion.cjs v0.4.1
node scripts/rail-light-debug-test.cjs v0.4.1
node scripts/rail-preservation.cjs v0.4.1 v0.4
node scripts/shell-regression.cjs
node scripts/compare.cjs v0.4 v0.4.1
# Inspect evidence; write the matching visual-review.json only after review.
node scripts/release.cjs v0.4.1
```

Browser QA and image conversion use Playwright and Sharp as **development-only** tools. Reuse a centralized installation through an ignored `tools.local.json` with `moduleDirectory` and `chromeExecutable`, or make those modules resolvable by Node. The current machine uses installed Chrome; no browser download is needed. Main build and integrity scripts use only Node's standard library.

## Versioning

Each `docs/vX.Y` directory is a complete immutable website with its own assets. `docs/releases.json` records release manifest hashes. The root is an explicit version catalogue. Updates never redirect or replace an old version. See `AGENTS.md` for the complete release and regression gate.

## Content status

This is an English review release for exhibition preparation, with search indexing disabled. v0.2 restores the owner's eIoT source and Rail image 1, retaining the approved shared header/footer, generated Rail hero and restrained gradient lines. Rail case photography is displayed directly from the unchanged reference bitmap through CSS windows; higher-resolution source photographs are still needed for a later asset upgrade. Rail case titles and claims reproduce the supplied design; missing case pages open an email inquiry instead of an unrelated case. The exhibition-specific CTA is still a marketing decision. The rail hero is a generated illustration, not a customer-project photograph.

The fidelity check requires the owner's local reference and compares eIoT main content at 390, 1440 and 1920 pixels. The shell check compares desktop/mobile header, footer and gateway against v0.1. These checks supplement the full responsive/functional matrix and manually reviewed comparisons. The original references and screenshots are not required to view or build a release.

Reference files and private marketing/QA reports remain local. Icons are derived from Lucide under ISC; see `THIRD-PARTY-NOTICES.md`.

## Rail interaction layer (v0.4.1)

Rail adds interaction-triggered capability icons, parallel ecosystem rails with converging sleepers, and a subtle animated hero. `src/rail-scene.json` owns the source-image coordinates, illustrative object identifiers, descriptions, light positions and ambient timing. `scripts/rail-components.cjs` emits the inline SVG; `src/scripts/rail.js` registers it against the responsive image crop. No image processing or request is needed at runtime. Existing copy and destinations are unchanged.

Hover an outlined object or use **Explore scene** with touch/keyboard to inspect it. Labels are an illustrative asset map, not live telemetry or actual equipment identification. **Pause motion** stops ambient effects; OS reduced-motion preferences are honored. Ambient timers/animations stop when the hero is offscreen or the document is hidden. With JavaScript disabled the page retains its photograph and content. The Rail interaction script and styles are not loaded by eIoT or the gateway.

**Light debug** in the Rail hero shows all ambient-light cores and halos continuously in lime, at their original coordinates and radii. It stops only light shimmer, is available during Pause/reduced motion, and restores the previous motion preference when switched off. Debug starts off on each page load.

The owner-authorized v0.4.1 light amendment expands the ambient map across lit building/train windows, station arches and lamps, with brightness grouped in `src/rail-scene.json`. Two illustrative signal heads cycle through red, dark, green and dark phases independently. They return to the original photograph when motion is paused/reduced, and become stationary lime markers in Light debug. The original v0.4.1 remains recoverable at commit d2990cf; `scripts/release-amendments.json` records the exact allowed file/hash transition. Run `node scripts/rail-light-amendment-test.cjs v0.4.1` for the additional signal-cycle checks.
