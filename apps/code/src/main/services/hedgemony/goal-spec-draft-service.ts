import { inject, injectable } from "inversify";
import { z } from "zod";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import type { LlmGatewayService } from "../llm-gateway/service";
import {
  type GoalDraftRespondInput,
  type GoalDraftResponse,
  type GoalDraftTranscriptMessage,
  type GoalSpecDraft,
  goalDraftResponse,
} from "./schemas";

const log = logger.scope("goal-spec-draft-service");

const SYSTEM_PROMPT = `You help a PostHog Code operator write a Hedgemony nest goal before the nest exists.

Return JSON only, with exactly one of these shapes:
{"kind":"ask_question","question":"One short clarifying question"}
{"kind":"propose_spec","draft":{"name":"Short nest name","goalPrompt":"Clear operator goal","definitionOfDone":"Concrete definition of done"}}

Rules:
- This is only a bounded goal-writing draft flow. You have no tools, no worktree access, no Task, no hoglet creation, and no autonomous side effects.
- Ask one concise clarifying question when the transcript does not yet explain the desired outcome, useful scope/context, and how the operator will know the goal is done.
- Prefer proposing a spec once the operator has answered at least one clarifying question or the initial prompt is already specific.
- Keep the name under 120 characters.
- Make definitionOfDone concrete enough that a later hedgehog could judge completion.`;

const parsedGatewayResponse = z.union([
  z.object({
    kind: z.literal("ask_question"),
    question: z.string().min(1),
  }),
  z.object({
    kind: z.literal("propose_spec"),
    draft: z.object({
      name: z.string().min(1),
      goalPrompt: z.string().min(1),
      definitionOfDone: z.string().min(1),
    }),
  }),
]);

@injectable()
export class GoalSpecDraftService {
  constructor(
    @inject(MAIN_TOKENS.LlmGatewayService)
    private readonly llmGateway: LlmGatewayService,
  ) {}

  async respond(input: GoalDraftRespondInput): Promise<GoalDraftResponse> {
    const response = await this.llmGateway.prompt(
      [
        {
          role: "user",
          content: this.buildPrompt(input),
        },
      ],
      {
        system: SYSTEM_PROMPT,
        maxTokens: 900,
      },
    );

    const parsed = this.parseResponse(response.content);
    const normalized = goalDraftResponse.parse(parsed);

    if (
      normalized.kind === "propose_spec" &&
      this.needsInitialClarification(input.transcript)
    ) {
      return {
        kind: "ask_question",
        question:
          "What outcome would make this goal clearly done, and are there any scope boundaries the hedgehog should respect?",
      };
    }

    return normalized;
  }

  private buildPrompt(input: GoalDraftRespondInput): string {
    const transcript = input.transcript
      .slice(-12)
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n\n");
    const currentDraft = input.currentDraft
      ? `\n\nCurrent editable draft:\n${formatDraft(input.currentDraft)}`
      : "";
    const mapContext =
      input.mapContext?.mapX !== undefined &&
      input.mapContext?.mapY !== undefined
        ? `\n\nMap placement: (${input.mapContext.mapX}, ${input.mapContext.mapY})`
        : "";

    return `Draft a Hedgemony nest goal from this creation transcript.

Transcript:
${transcript}${currentDraft}${mapContext}`;
  }

  private parseResponse(content: string): GoalDraftResponse {
    try {
      const raw = extractJsonObject(content);
      const parsed = parsedGatewayResponse.parse(JSON.parse(raw));
      if (parsed.kind === "ask_question") {
        return {
          kind: "ask_question",
          question: parsed.question.trim(),
        };
      }

      return {
        kind: "propose_spec",
        draft: {
          name: parsed.draft.name.trim(),
          goalPrompt: parsed.draft.goalPrompt.trim(),
          definitionOfDone: parsed.draft.definitionOfDone.trim(),
        },
      };
    } catch (error) {
      log.error("Failed to parse goal draft response", { error, content });
      throw new Error("Goal draft response was not valid JSON");
    }
  }

  private needsInitialClarification(
    transcript: GoalDraftTranscriptMessage[],
  ): boolean {
    const userMessages = transcript.filter(
      (message) => message.role === "user",
    );
    const assistantMessages = transcript.filter(
      (message) => message.role === "assistant",
    );
    if (userMessages.length !== 1 || assistantMessages.length > 0) {
      return false;
    }

    const initial = userMessages[0].content.trim();
    if (initial.length < 80) {
      return true;
    }

    const lower = initial.toLowerCase();
    const specificitySignals = [
      "definition of done",
      "done when",
      "success",
      "metric",
      "scope",
      "constraint",
      "because",
      "so that",
    ];
    return (
      specificitySignals.filter((signal) => lower.includes(signal)).length < 2
    );
  }
}

function extractJsonObject(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? content;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found");
  }
  return candidate.slice(start, end + 1);
}

function formatDraft(draft: GoalSpecDraft): string {
  return JSON.stringify(
    {
      name: draft.name,
      goalPrompt: draft.goalPrompt,
      definitionOfDone: draft.definitionOfDone,
    },
    null,
    2,
  );
}
