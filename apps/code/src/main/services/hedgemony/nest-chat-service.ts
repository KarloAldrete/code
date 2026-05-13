import { inject, injectable } from "inversify";
import type { NestMessageRepository } from "../../db/repositories/nest-message-repository";
import { MAIN_TOKENS } from "../../di/tokens";
import type {
  CreateNestInput,
  ListNestChatInput,
  Nest,
  NestMessage,
} from "./schemas";

@injectable()
export class NestChatService {
  constructor(
    @inject(MAIN_TOKENS.NestMessageRepository)
    private readonly messages: NestMessageRepository,
  ) {}

  list(input: ListNestChatInput): NestMessage[] {
    const messages = this.messages.listByNestId(input.nestId);
    if (input.detail) {
      return messages;
    }
    return messages.filter((message) => message.visibility === "summary");
  }

  recordCreationContext(nest: Nest, input: CreateNestInput): void {
    const goalLines = [
      `Goal: ${input.goalPrompt}`,
      input.definitionOfDone
        ? `Definition of done: ${input.definitionOfDone}`
        : "Definition of done: not set yet",
    ];

    this.messages.create({
      nestId: nest.id,
      kind: "user_message",
      body: goalLines.join("\n\n"),
      payloadJson: JSON.stringify({
        creationMode: input.creationMode ?? "guided",
        goalPrompt: input.goalPrompt,
        definitionOfDone: input.definitionOfDone ?? null,
      }),
    });

    this.messages.create({
      nestId: nest.id,
      kind: "audit",
      body: `Nest created at (${nest.mapX}, ${nest.mapY}).`,
      payloadJson: JSON.stringify({
        mapX: nest.mapX,
        mapY: nest.mapY,
        status: nest.status,
      }),
    });
  }
}
