import { create } from "zustand";

export interface CopilotMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
}

interface CopilotState {
  messages: CopilotMessage[];
}

interface CopilotActions {
  sendUserMessage: (text: string) => void;
  reset: () => void;
}

type CopilotStore = CopilotState & CopilotActions;

export const useCopilotStore = create<CopilotStore>((set) => ({
  messages: [],
  sendUserMessage: (text) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { id: `u-${Date.now()}`, role: "user", text },
        {
          id: `a-${Date.now() + 1}`,
          role: "assistant",
          text: "Got it — I'm on it. (Copilot answers coming soon.)",
        },
      ],
    })),
  reset: () => set({ messages: [] }),
}));
