# Veyrix documentation frontend

Standalone React + TypeScript + Vite frontend in the root `web` folder. The backend remains in `main_setup`; this site does not call it or require credentials.

## Run

From `web`:

```sh
npm install
npm run dev
```

## Verify and build

```sh
npm run typecheck
npm run build
npm run preview
```

Deploy the generated `dist` directory on a static host. No server or environment secrets are required. For a subdirectory deployment, set Vite's `base` to that directory before building.

## Structure

- `src/components/ui/dimensional-workflow-hero.tsx`: supplied animated component, including its scoped styles, responsive behavior, reduced-motion fallback and cleanup.
- `src/content/hero.ts`: Veyrix-specific chapter copy and diagram data.
- `src/App.tsx`: navigation, architecture, quickstart and project status.
- `src/styles.css`: page styling, theme tokens and responsive layouts.
- `src/lib/utils.ts` and `components.json`: shadcn-compatible utilities and aliases. Add future UI components under `src/components/ui` so the `@/components/ui` imports remain consistent.

Tailwind CSS v4 is configured through the Vite plugin. The hero uses GSAP, @gsap/react, and Lucide. Artwork consists of the supplied component's diagrams, so no stock photography or remote image dependencies are needed.

The three hero chapter buttons and intro CTA navigate through the scroll timeline. Reduced-motion preferences show the content in reading order. The skip link bypasses the animated tour. Documentation commands use the renamed `main_setup/python` path and assume the repository root on Windows.

Public integration APIs and customer authentication are explicitly marked as planned. This frontend has not been published automatically.

## Pages and routing

The frontend uses React Router with separate pages:

- `/`: homepage with the animated product tour, a short feature overview, and documentation CTA.
- `/docs`: product orientation, shopping concepts, catalog choices, vocabulary, and a reading map.
- `/docs/quickstart`: interactive prerequisites, exact setup commands, configuration reference, sample conversation, verification, and troubleshooting.
- `/architecture`: pipeline illustration, interactive runtime layers, tool contracts, transaction design, data lifetimes, and source map. The legacy `/docs/architecture` address redirects here.
- `/status`: searchable capability register with state/area filters, expandable evidence, verification coverage, and milestone acceptance criteria.
- Unrecognized paths display a 404 page with a home link.

Page components live in `src/pages`. `src/App.tsx` owns the routes, shared header/footer, page titles, route focus/scroll reset, and documentation navigation. The site uses black surfaces with restrained blue, violet, and mint accents. Documentation navigation contains only Overview and Quickstart; Architecture is a separate top-level route.

For direct URL visits and refreshes, configure the static host to serve `index.html` for application routes. `public/_redirects` provides the Netlify/Cloudflare Pages fallback; `vercel.json` provides the Vercel rewrite. Vite handles route fallback locally. Other static hosts need an equivalent rule.

### Homepage and architecture visualization

Home uses the supplied DimensionalWorkflowHero with its GSAP scroll timeline, chapter navigation, node lifts, and animated connections restored. Window frames and canvases are black; inner nodes and connections remain blue, violet, and mint. Architecture uses the supplied `src/components/ui/ai-agent-pipeline.tsx` component, adapted to Veyrix, with no dimensional hero or pinned scroll scene. Its illustrated sequence can be paused or advanced manually, and system reduced-motion preferences disable automatic updates and animated signals. The diagram scrolls horizontally on small screens to preserve legibility. Example messages are not live backend telemetry.

### Route loading and playback controls

Page modules load on demand through `src/components/route-page.tsx`. Each navigation shows a route-shaped skeleton for at least 220 ms (no minimum delay with reduced motion), and continues showing it while the module loads. Headers remain available, failed loads offer a reload action, and content fades in without transforming the homepage's pinned scroll container.

Architecture playback uses conventional Play/Pause and Step Forward icons, with no expanding arrow overlay. Next step still pauses automatic playback before advancing.

### Dot-field homepage finale

The old “Start with your data” overlay is replaced by the supplied `src/components/ui/dot-field.tsx` canvas component immediately after the workflow chapters. It uses the bundled Inter font, a black background, white particles, a subtle violet glow, and the existing quickstart link. The sticky section provides 160 viewport-height percentage units of additional travel, with a short gathered hold before scatter and frame-rate-adjusted interpolation. Rendering begins on intersection and pauses offscreen; reduced motion presents static text. The original workflow chapters and their buttons remain intact.

### Homepage footer

The closing invitation now leads to Quickstart and Documentation. Only the homepage uses the supplied `src/components/ui/halftone-wordmark-footer.tsx`: a large cropped Veyrix wordmark, spring-based pointer interaction, click ripples, and real internal route links. It uses the bundled Inter font, a black/silver palette, and violet interaction accents. The back-to-top control respects reduced motion and returns keyboard focus to the header. Other routes retain the compact footer.

### Animated command examples

`src/components/ui/terminal.tsx` adapts the supplied terminal design for the PowerShell examples. The shared `Code` renderer now displays it in both Quickstart command blocks. It includes syntax colors, viewport-triggered typing, pause/resume/replay, Show all, and Copy commands. Copy always uses the complete original command strings, without visual prompts. The preview does not execute commands or invent successful outputs. Animation pauses offscreen, respects reduced motion, and uses silent playback without external audio assets.


### Expanded reading layouts

The inner pages share centered responsive containers from `src/documentation.css`. Overview uses an editorial concept guide; Quickstart uses a task checklist and animated command blocks; Architecture uses a full-width pipeline and selectable runtime layers; Project Status uses a delivery dashboard. Their detailed content has separate purposes rather than repeating the homepage.

The reading rail follows the visible section while scrolling and supports smooth anchor jumps, keyboard focus, and reduced-motion preferences. Reference tables scroll within their own containers on narrow screens. Disclosures expose expanded state and keep collapsed content out of keyboard navigation. Route skeletons and the existing homepage scenes remain in place.

Project Status is a documented repository snapshot, not live monitoring. Its counts are derived from 14 entries (6 implemented, 2 requiring live validation, 6 planned), not estimated completion percentages. The default Python suite was rerun on 9 November 2026: 31 passed and 1 opt-in PostgreSQL test skipped. Prior PostgreSQL verification is labeled separately from current tests; live Groq and MySQL validation remain outstanding.
