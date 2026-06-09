import { defineCatalog } from "@json-render/core";
import { canvasSchema } from "@shared/canvas/schema";
import { z } from "zod";

// The component catalog the canvas agent may emit — the single source of truth
// shared by the renderer (which maps these names to React bodies in
// genui/registry.tsx) and the main process (which builds each template's system
// prompt from `canvasCatalog.prompt(...)`). Keep components small and composable.
export const CANVAS_COMPONENTS = {
  Page: {
    props: z.object({ title: z.string().optional() }),
    slots: ["default"],
    description: "Top-level page container; a vertical stack of sections.",
  },
  Grid: {
    props: z.object({ columns: z.number().int().min(1).max(4).optional() }),
    slots: ["default"],
    description: "Responsive grid. Place Cards or Stats inside.",
  },
  Card: {
    props: z.object({ title: z.string().optional() }),
    slots: ["default"],
    description: "Bordered surface grouping related content.",
  },
  Heading: {
    props: z.object({
      text: z.string(),
      level: z.number().int().min(1).max(3).optional(),
    }),
    description: "A section heading (level 1 largest).",
  },
  Text: {
    props: z.object({ text: z.string(), muted: z.boolean().optional() }),
    description: "A paragraph of text.",
  },
  Stat: {
    props: z.object({
      label: z.string(),
      value: z.union([z.string(), z.number()]),
      delta: z.string().optional(),
    }),
    description: "A single big metric with a label and optional delta.",
  },
  Table: {
    props: z.object({
      columns: z.array(z.string()),
      rows: z.array(z.array(z.union([z.string(), z.number()]))),
    }),
    description: "A data table with column headers and rows.",
  },
  BarList: {
    props: z.object({
      items: z.array(z.object({ label: z.string(), value: z.number() })),
    }),
    description: "Horizontal bar list for ranked breakdowns.",
  },
  LineChart: {
    props: z.object({
      labels: z.array(z.string()),
      series: z.array(
        z.object({ label: z.string(), data: z.array(z.number()) }),
      ),
    }),
    description:
      "A line chart for trends over time. `labels` are the x-axis points; each series has a label and one value per label (data length MUST equal labels length).",
  },
  BarChart: {
    props: z.object({
      labels: z.array(z.string()),
      series: z.array(
        z.object({ label: z.string(), data: z.array(z.number()) }),
      ),
    }),
    description:
      "A bar chart (grouped when multiple series). `labels` are the x-axis categories; each series has a label and one value per label (data length MUST equal labels length).",
  },
  Sparkline: {
    props: z.object({ data: z.array(z.number()) }),
    description: "A tiny inline trend line — a row of numbers, no axes.",
  },
  Badge: {
    props: z.object({
      text: z.string(),
      color: z.enum(["gray", "green", "red", "amber", "blue"]).optional(),
    }),
    description: "A small status pill.",
  },
  Divider: {
    props: z.object({}),
    description: "A horizontal divider.",
  },
};

// Catalog built on the core-only schema, usable from both main and renderer.
export const canvasCatalog = defineCatalog(canvasSchema, {
  components: CANVAS_COMPONENTS,
  actions: {},
});
