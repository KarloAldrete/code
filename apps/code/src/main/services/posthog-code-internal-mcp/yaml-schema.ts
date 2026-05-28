import { z } from "zod";

const ParamOverride = z
  .object({
    description: z.string().optional(),
  })
  .strict();

const ToolAnnotations = z
  .object({
    readOnly: z.boolean(),
    destructive: z.boolean(),
    idempotent: z.boolean(),
  })
  .strict();

const ToolConfig = z
  .object({
    operation: z.string().min(1),
    enabled: z.boolean(),
    title: z.string().optional(),
    description: z.string().optional(),
    description_file: z.string().optional(),
    annotations: ToolAnnotations.optional(),
    param_overrides: z.record(z.string(), ParamOverride).optional(),
    exclude_params: z.array(z.string()).optional(),
    rename_params: z.record(z.string(), z.string()).optional(),
  })
  .strict()
  .refine((d) => !(d.description && d.description_file), {
    message: "description and description_file are mutually exclusive",
  })
  .refine((d) => !d.enabled || d.annotations, {
    message: "enabled tools must declare annotations",
  });

export type ToolConfig = z.infer<typeof ToolConfig>;

export const McpToolsYamlSchema = z
  .object({
    tools: z.record(z.string(), ToolConfig),
  })
  .strict();

export type McpToolsYaml = z.infer<typeof McpToolsYamlSchema>;
