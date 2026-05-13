import { useAuthenticatedMutation } from "@hooks/useAuthenticatedMutation";
import { Plus } from "@phosphor-icons/react";
import { Box, Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@utils/toast";
import { useState } from "react";

export function AddFolderButton() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState("");

  const createFolder = useAuthenticatedMutation(
    (client, { path }: { path: string }) =>
      client.createFileSystem({ path, type: "folder" }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["file-system"] });
        setAddOpen(false);
        setNewFolderPath("");
        toast.success("Folder added");
      },
      onError: (err: Error) => {
        toast.error("Could not add folder", {
          description: err.message,
        });
      },
    },
  );

  const handleAddSubmit = () => {
    const trimmed = newFolderPath.trim().replace(/^\/+|\/+$/g, "");
    if (!trimmed) {
      toast.error("Folder path is required");
      return;
    }
    createFolder.mutate({ path: trimmed });
  };

  return (
    <>
      <Box className="shrink-0 border-gray-6 border-t">
        <button
          type="button"
          className="flex w-full items-center gap-1 bg-transparent px-2 py-1.5 text-left text-[13px] text-gray-11 transition-colors hover:bg-gray-3"
          onClick={() => setAddOpen(true)}
        >
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-gray-10">
            <Plus size={14} />
          </span>
          <span className="text-gray-11">Add folder</span>
        </button>
      </Box>

      <Dialog.Root
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setNewFolderPath("");
        }}
      >
        <Dialog.Content maxWidth="400px" size="2">
          <Dialog.Title className="text-base">Add folder</Dialog.Title>
          <Dialog.Description size="2" mb="3" color="gray">
            Enter a folder path. Use "/" for nested folders (e.g.{" "}
            <Text className="font-mono">marketing/blog</Text>).
          </Dialog.Description>
          <TextField.Root
            value={newFolderPath}
            onChange={(e) => setNewFolderPath(e.target.value)}
            placeholder="marketing/blog"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSubmit();
              }
            }}
          />
          <Flex justify="end" gap="2" mt="4">
            <Dialog.Close>
              <Button
                variant="soft"
                color="gray"
                size="1"
                disabled={createFolder.isPending}
              >
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="solid"
              size="1"
              onClick={handleAddSubmit}
              loading={createFolder.isPending}
              disabled={!newFolderPath.trim()}
            >
              Add folder
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}
