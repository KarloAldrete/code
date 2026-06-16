import { ContainerModule } from "inversify";

/**
 * UI module for the agent-applications feature (deployed agent_platform
 * agents). Currently holds no bindings — the chat/agent builder contributions and
 * any view-state slices are added in later milestones. Registered in
 * apps/code/src/renderer/desktop-contributions.ts once it binds a CONTRIBUTION.
 */
export const agentApplicationsUiModule = new ContainerModule(() => {});
