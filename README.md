# JIGZO

Turn a photo and a hidden message into a puzzle someone has to solve before they can read your words. Upload a photo, write a message, and JIGZO delivers a jigsaw over WhatsApp; the message unlocks only when the final piece is placed.

This repository is the current front end: static HTML pages sharing one stylesheet and one puzzle-geometry script, with no build step. Open the pages directly (or via `serve.ps1`) and they run as-is in the browser.

## Running locally

```
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 -Port 5501
```

Then open `http://localhost:5501/index.html`. A static file server is used (rather than opening files directly) so the self-hosted fonts and the shared `js/puzzle-shape.js` script load over HTTP.

## Files and folders

| Path | What it is |
| --- | --- |
| `index.html` | Marketing landing page. Loads `css/styles.css`; two self-contained puzzle mockup cards (hero + reveal) animate inline. |
| `create.html` | Sender flow (React via in-browser Babel). Upload photo, choose difficulty, add sender/receiver, write the message, preview the WhatsApp notification, checkout. Loads `css/styles.css` and `js/puzzle-shape.js`. |
| `receive.html` | Receiver experience (React via in-browser Babel). The live jigsaw board the recipient solves; the message reveals on the final piece. Loads `css/styles.css` and `js/puzzle-shape.js`. |
| `css/styles.css` | The single shared stylesheet. Holds brand tokens (CSS custom properties), the self-hosted Archia `@font-face` rules, shared components, and the homepage mockup card styles. Font URLs are relative to this file (`../assets/fonts/...`). |
| `js/puzzle-shape.js` | Shared jigsaw geometry (`mulberry32`, `buildEdgeMap`, `edgeWithTab`, `piecePath`). Single source of truth so the sender preview in `create.html` and the live board in `receive.html` render identical piece shapes. Loaded as a plain global `<script>`. |
| `assets/` | Logos, icons, the demo photo, and `assets/fonts/` (self-hosted Archia `.otf` weights). |
| `design-exports/` | Archived, standalone design references. Not loaded by the live pages. See below. |
| `serve.ps1` | Local static file server used for previewing the pages. |

### `design-exports/` contents

These are frozen exports kept for reference only; nothing in the live site links to them.

- `JIGZO Website.html` — standalone marketing site export.
- `jigzo-identity-application.html` — brand identity / application export.
- `Jigzo Social Profile & Covers (standalone).html` — social profile and cover art export.
- `Puzzle Reveal Transition (standalone).html` — the reveal-transition animation study.
- `JigzoSenderFlow.jsx` — the original single-file source the `create.html` sender flow was generated from.

## Difficulty tiers

The sender picks one of four tiers in `create.html` (defined in the `TIERS` array). More pieces mean more anticipation before the reveal.

| Tier | Pieces | Grid | Note |
| --- | --- | --- | --- |
| Extra Easy | 6 | 2 × 3 | Perfect for a quick surprise. |
| Easy | 15 | 3 × 5 | A light challenge with a quick reveal. |
| Classic | 18 | 3 × 6 | Just the right balance of fun and anticipation. (Recommended) |
| Challenging | 28 | 4 × 7 | For those who enjoy making the moment last. |

## Brand colors

Defined as CSS custom properties in `css/styles.css` (`:root`).

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#F4EDDF` | Warm cream page background |
| `--card` | `#FBF7EE` | Light card surface |
| `--ink` / `--dark` | `#1C1913` | Warm near-black text and dark sections |
| `--dark-card` | `#241F16` | Dark card surface (reveal) |
| `--gold` | `#B8935A` | Primary gold accent |
| `--gold-deep` | `#8A6D3A` | Deep gold (eyebrows, links) |
| `--gold-c` | `#C6A15C` | Mid gold |
| `--gold-warm` | `#E6C67F` | Warm gold (gold buttons) |
| `--gold-bright` | `#D0A036` | Bright gold highlight |

Ink and cream tints (`--ink-08` through `--ink-74`, `--cream-42` through `--cream-72`) are opacity steps of ink and cream for borders, muted text, and scrims.

Type: **Archia** (headings and body, self-hosted), **JetBrains Mono** (labels), **Playfair Display italic** (the reveal message).

## Future structure

This project is intentionally build-free today: plain HTML, one CSS file, one JS file, React loaded from a CDN and compiled in the browser by Babel standalone. When the app grows enough to warrant a bundler (e.g. Vite), the plan is to adopt a modular `src/` layout and precompile the React pages instead of shipping in-browser Babel:

```
src/
  components/   Shared UI (buttons, cards, the WhatsApp preview, reveal face)
  pages/        create, receive, and landing entry points
  lib/          puzzle-shape geometry and other shared logic
  styles/       styles.css split into tokens + component partials
assets/         unchanged (logos, fonts, images)
design-exports/ unchanged (archived references)
```

Until that build step exists, keep the current flat layout: shared styles in `css/`, shared scripts in `js/`, and the three top-level HTML pages loading them directly. Do not split or refactor `js/puzzle-shape.js`; it must stay a single shared source of truth for piece geometry.
