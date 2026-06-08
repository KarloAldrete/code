# Canvas (Website space) — patterns

Conventions for the channel-scoped Website space: channels, dashboards, and the
gen-UI canvas. Read this before changing breadcrumbs, dashboard naming, or the
canvas generation harness. The root `AGENTS.md` architecture rules still apply.

## Breadcrumbs

- **Breadcrumbs live in the global title bar, not a local bar.** `WebsiteLayout`
  builds the crumb row and pushes it into `HeaderRow` via
  `useSetHeaderContent(node)` (`@hooks/useSetHeaderContent`). There is no second
  breadcrumb bar — that reclaims the vertical space. Interactive crumbs/buttons
  must be `no-drag` islands (the title bar is a window `drag` region); keep the
  gaps draggable.
- **A page does not get its own crumb — its H1 is the title.** The leaf view
  (e.g. a single dashboard) is NOT represented as a breadcrumb segment. The
  breadcrumb stops at the parent index and the page renders its own `<h1>` for
  the name. So on a dashboard the trail is `#channel / Dashboards`, not
  `#channel / Dashboards / #dashboardName` — the big H1 below is the name.
- **The last shown crumb still links to its index.** On a dashboard, the
  `Dashboards` crumb links back to the dashboards grid (`/website/$channelId`)
  rather than being inert text, because it's no longer the current leaf.
- Don't add a crumb per route segment reflexively. Crumbs reflect navigable
  parents; the current leaf is the H1.

## Dashboard naming

- **The dashboard's H1 is its name.** The canvas harness always emits a top-level
  `Heading` (level 1) as the first child of the root `Page`
  (see `CANVAS_SYSTEM_PROMPT` in `genui/catalog.ts`). `dashboardTitleFromSpec`
  (`genui/dashboardTitle.ts`) reads that H1.
- **Editing the H1 renames the dashboard.** On save, the derived title is passed
  as the dashboard `name`; there is no separate name field or rename UI.

## Storage

- Dashboards are **backed by the PostHog desktop file system**, not local files.
  A dashboard is a `dashboard`-typed row nested under its channel folder; its
  name is the last path segment (the H1) and the json-render spec rides in
  `meta.spec`. See `@main/services/dashboards/service.ts`. This keeps dashboard
  and channel names in sync with the backend — the same surface that owns
  channels (top-level `folder` rows, see `hooks/useChannels.ts`).
