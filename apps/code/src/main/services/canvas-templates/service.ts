import { injectable } from "inversify";
import type { CanvasTemplateSummary } from "./schemas";
import {
  BUILT_IN_TEMPLATES,
  type CanvasTemplate,
  DEFAULT_TEMPLATE_ID,
} from "./templates";

// Owns the canvas templates — the per-template agent context (system prompt)
// that anchors how the gen-UI agent builds. Built-ins are seeded here; the
// registry is a Map so user-defined templates can be added later (the store
// would back them; built-ins stay read-only).
@injectable()
export class CanvasTemplatesService {
  private readonly templates = new Map<string, CanvasTemplate>(
    BUILT_IN_TEMPLATES.map((t) => [t.id, t]),
  );

  list(): CanvasTemplateSummary[] {
    return [...this.templates.values()].map(
      ({ systemPrompt: _p, ...rest }) => ({
        ...rest,
      }),
    );
  }

  get(id: string): CanvasTemplate | undefined {
    return this.templates.get(id);
  }

  /** The system prompt for a template, falling back to the default template. */
  systemPromptFor(id: string | undefined): string {
    const template =
      (id && this.templates.get(id)) ?? this.templates.get(DEFAULT_TEMPLATE_ID);
    if (!template) {
      throw new Error("No canvas templates registered");
    }
    return template.systemPrompt;
  }
}
