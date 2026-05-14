import type { Proposal } from "@main/services/hedgemony/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@utils/electronStorage", () => ({
  electronStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  selectOpenProposals,
  selectUnreadCount,
  useFederationStore,
} from "./federationStore";

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  const now = "2026-05-14T00:00:00.000Z";
  return {
    id: "proposal-1",
    kind: "bridge",
    primaryNestId: "nest-a",
    secondaryNestId: "nest-b",
    hogletId: null,
    signalReportId: null,
    evidenceJson: "{}",
    status: "open",
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    ...overrides,
  };
}

describe("federationStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useFederationStore.setState({
      proposalsById: {},
      overlapsById: {},
      bridgesById: {},
      overlayVisible: false,
      lastReadAt: 0,
    });
  });

  describe("selectUnreadCount", () => {
    it("counts only open proposals created after lastReadAt", () => {
      const cutoff = Date.parse("2026-05-14T12:00:00.000Z");
      useFederationStore.setState({ lastReadAt: cutoff });

      const newOpen = makeProposal({
        id: "p-new-open",
        status: "open",
        createdAt: "2026-05-14T13:00:00.000Z",
      });
      const oldOpen = makeProposal({
        id: "p-old-open",
        status: "open",
        createdAt: "2026-05-14T10:00:00.000Z",
      });
      const newDismissed = makeProposal({
        id: "p-new-dismissed",
        status: "dismissed",
        createdAt: "2026-05-14T14:00:00.000Z",
      });
      const newAccepted = makeProposal({
        id: "p-new-accepted",
        status: "accepted",
        createdAt: "2026-05-14T15:00:00.000Z",
      });
      const newSnoozed = makeProposal({
        id: "p-new-snoozed",
        status: "snoozed",
        createdAt: "2026-05-14T16:00:00.000Z",
      });

      useFederationStore
        .getState()
        .setProposals([
          newOpen,
          oldOpen,
          newDismissed,
          newAccepted,
          newSnoozed,
        ]);

      expect(selectUnreadCount(useFederationStore.getState())).toBe(1);
    });

    it("counts zero when no proposals are after lastReadAt", () => {
      useFederationStore.setState({ lastReadAt: Date.now() + 60_000 });
      useFederationStore.getState().setProposals([
        makeProposal({
          id: "p-old",
          status: "open",
          createdAt: "2026-05-13T00:00:00.000Z",
        }),
      ]);

      expect(selectUnreadCount(useFederationStore.getState())).toBe(0);
    });

    it("counts all open proposals when lastReadAt is 0", () => {
      useFederationStore.getState().setProposals([
        makeProposal({
          id: "p-a",
          status: "open",
          createdAt: "2026-05-14T00:00:00.000Z",
        }),
        makeProposal({
          id: "p-b",
          status: "open",
          createdAt: "2026-05-14T01:00:00.000Z",
        }),
        makeProposal({
          id: "p-c",
          status: "auto_executed",
          createdAt: "2026-05-14T02:00:00.000Z",
        }),
      ]);

      expect(selectUnreadCount(useFederationStore.getState())).toBe(2);
    });

    it("drops to zero after markNoticesRead", () => {
      useFederationStore.getState().setProposals([
        makeProposal({
          id: "p-recent",
          status: "open",
          createdAt: new Date(Date.now() - 1_000).toISOString(),
        }),
      ]);
      expect(selectUnreadCount(useFederationStore.getState())).toBe(1);

      useFederationStore.getState().markNoticesRead();

      expect(selectUnreadCount(useFederationStore.getState())).toBe(0);
    });
  });

  describe("selectOpenProposals", () => {
    it("returns only open proposals, newest first", () => {
      const older = makeProposal({
        id: "older",
        status: "open",
        createdAt: "2026-05-14T00:00:00.000Z",
      });
      const newer = makeProposal({
        id: "newer",
        status: "open",
        createdAt: "2026-05-14T05:00:00.000Z",
      });
      const dismissed = makeProposal({ id: "dismissed", status: "dismissed" });

      useFederationStore.getState().setProposals([older, newer, dismissed]);

      const open = selectOpenProposals(useFederationStore.getState());
      expect(open.map((p) => p.id)).toEqual(["newer", "older"]);
    });
  });
});
