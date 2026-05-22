import { describe, expect, it } from "vitest";
import { getNewTaskTarget } from "./getNewTaskTarget";

describe("getNewTaskTarget", () => {
  it.each([
    {
      name: "returns the folder id when the group has a matching local folder",
      args: { groupFolderId: "folder-1", groupId: "posthog/code" },
      expected: "folder-1",
    },
    {
      name: "returns initialCloudRepository for a cloud-only group with no local folder",
      args: { groupFolderId: undefined, groupId: "posthog/code" },
      expected: { initialCloudRepository: "posthog/code" },
    },
    {
      name: "returns undefined for the catch-all 'other' group with no folder id",
      args: { groupFolderId: undefined, groupId: "other" },
      expected: undefined,
    },
    {
      name: "returns undefined when groupId is empty and no folder id is set",
      args: { groupFolderId: undefined, groupId: "" },
      expected: undefined,
    },
    {
      name: "prefers the folder id even when groupId looks like a cloud repo",
      args: { groupFolderId: "folder-7", groupId: "posthog/posthog" },
      expected: "folder-7",
    },
  ])("$name", ({ args, expected }) => {
    expect(getNewTaskTarget(args)).toEqual(expected);
  });
});
