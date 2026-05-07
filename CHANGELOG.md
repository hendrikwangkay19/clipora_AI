# Changelog

## UI Redesign — 2026-05-04

### Added
- `components/clipora/sidebar.tsx` — Persistent dark-sage sidebar (210px) with 6 nav items, workspace card, admin mode toggle, and user section. Active state driven by `usePathname`.
- `components/clipora/top-bar.tsx` — 56px top bar with status badge and user avatar.
- `components/clipora/logo-mark.tsx` — Scalable Clipora logo mark component.

### Changed
- `app/globals.css` — Full palette replacement to match design reference: `--bg #f0ede6`, `--sidebar #2d4a3e`, `--accent #4a7a65`, `--gold #c49a3c`, `--text #2a2820`. Added backwards-compat aliases for existing CSS variable names. Replaced top-bar classes with app-shell layout classes (`.app-shell`, `.main-area`, `.page-content`, `.sidebar-link`). Updated `.primary-button`, `.ghost-button`, `.clipora-card`, `.soft-card` to new palette.
- `app/layout.tsx` — Replaced top-nav layout with full app-shell (sidebar + top-bar + scrollable content). Added `next/font/google` for Plus Jakarta Sans and JetBrains Mono. Removed `<header>` / `<nav>` / `<Link>` top bar.
- `app/page.tsx` — Removed inline `Sidebar` component (now in layout). Removed outer `flex max-w-[1480px]` wrapper. Converted all inline Tailwind class colour references to CSS custom properties via inline styles. All fetch logic, `useEffect` hooks, `useCallback` handlers, polling, and state are preserved exactly.
- `components/autoclip/jobs-dashboard.tsx` — Restyled from dark cinematic (#0a0a0f) to warm sage palette. All fetch/polling logic unchanged.
- `components/autoclip/generate-ui.tsx` — Restyled from dark cinematic to warm sage palette. All fetch/polling logic unchanged.

### Removed
- `components/autoclip/dashboard-ui.tsx` — Orphaned component (never imported by any page).
- `lib/youtube.ts` — Legacy dead code (not imported anywhere; superseded by `lib/autoclip/media/video.ts`).
- `lib/ffmpeg.ts` — Legacy dead code (not imported anywhere; superseded by `lib/autoclip/media/video.ts`).

### Not changed
- `lib/autoclip/**` — Untouched (pipeline, transcription, analysis, config, types).
- `app/api/**` — Untouched (all API routes preserved).
