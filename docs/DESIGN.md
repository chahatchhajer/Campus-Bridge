# Design notes

How the design was derived (UI/UX Pro Max design-system search, the Apple design guidance and the dataviz skill were applied) and what was decided.

## Direction

Calm, editorial, precise. Warm off-white surfaces, navy-charcoal ink, one teal accent for progress and positive states. Flat surfaces with hairline borders and very light shadows; depth is reserved for dialogs and the hero preview. Buttons use 8px radii (no pills). No gradients, emoji icons, fake social proof or decorative counters.

- Type: Inter for UI (16px inputs to avoid iOS zoom), Instrument Serif only for landing display headings. Large headings use negative tracking; body stays at default.
- Color tokens live in `client/src/styles/tokens.css`; component CSS contains no raw hex values.
- Motion: 120-200 ms transitions on transform/opacity/colour, active-press feedback on pointer-down, native `<dialog>` for focus management, and a global `prefers-reduced-motion` reset.

## Information architecture

```
/                       public landing (hero preview, features, walkthrough, GDG Edge preview)
/login, /privacy        public
/dashboard              KPIs, upcoming interviews, deadlines, pipeline, recent activity
/applications           table | board, search, filters, sort, pagination
/applications/new       create
/applications/:id       detail, stage track, interview timeline, activity history
/applications/:id/edit  edit
/calendar               month grid + agenda
/resumes                private PDF library
/analytics              GDG Edge
/settings               profile, preferences, export, sample data, account actions
```

Desktop: persistent sidebar. Below 960px: compact top bar plus a 5-item bottom navigation ("More" opens a drawer with the remaining sections). Tables become card lists below 860px; the board is a contained, snap-scrolling region so the page itself never scrolls horizontally.

## Chart colour

Series colours (`--chart-1..4`) were validated with the dataviz palette checker on the chart surface: lightness band, chroma floor, colour-vision-deficiency separation between adjacent series, normal-vision separation, and 3:1 contrast. Every chart has a legend when it has more than one series, direct value labels where there is room, hover tooltips, a plain-language `aria-label`, and a **Table** view with the same numbers.

## Accessibility checks performed

Skip link, visible focus ring, labelled controls with inline errors (`role="alert"`), `aria-sort` on sortable columns, `aria-pressed` toggles, 44px touch targets on coarse pointers, `aria-live` regions for toasts and pagination, keyboard-operable board (select per card) and calendar (buttons), and automated checks for horizontal overflow and console errors at 360, 390, 768, 1024, 1440 and 1920px.
