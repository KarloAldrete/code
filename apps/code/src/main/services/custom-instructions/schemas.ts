import { z } from "zod";

export const readCustomInstructionsOutput = z.object({
  customInstructions: z.string(),
});

export type ReadCustomInstructionsOutput = z.infer<
  typeof readCustomInstructionsOutput
>;

export const writeCustomInstructionsInput = z.object({
  instructions: z
    .string()
    .describe(
      "Full replacement text for the user's custom instructions. Pass empty string to clear.",
    ),
});

export type WriteCustomInstructionsInput = z.infer<
  typeof writeCustomInstructionsInput
>;

export const writeCustomInstructionsOutput = z.object({
  ok: z.literal(true),
});

export type WriteCustomInstructionsOutput = z.infer<
  typeof writeCustomInstructionsOutput
>;

export const customInstructionsChanged = z.object({
  customInstructions: z.string(),
});

export type CustomInstructionsChanged = z.infer<
  typeof customInstructionsChanged
>;

export const CustomInstructionsServiceEvent = {
  Changed: "changed",
} as const;

export interface CustomInstructionsServiceEvents {
  [CustomInstructionsServiceEvent.Changed]: CustomInstructionsChanged;
}
