import {
  ArrowCounterClockwise,
  Check,
  DotsThree,
  MagnifyingGlass,
  Plus,
  SortAscending,
  X,
} from "@phosphor-icons/react";
import { Box, Dialog, Flex, Text } from "@radix-ui/themes";
import { useNavigationStore } from "@stores/navigationStore";
import { useProjectEditsStore } from "@stores/projectEditsStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getProjectIcon,
  PROJECT_ICONS,
  type ProjectIconId,
} from "../data/projectIcons";
import { PROJECTS, type Project } from "../data/projects";

function useResolvedProject(project: Project): Project {
  const edit = useProjectEditsStore((s) => s.editsByProjectId[project.id]);
  return useMemo(() => ({ ...project, ...(edit ?? {}) }), [project, edit]);
}

function ProjectCardView({
  project,
  onEdit,
}: {
  project: Project;
  onEdit: () => void;
}) {
  const navigateToWorkProjectDetail = useNavigationStore(
    (s) => s.navigateToWorkProjectDetail,
  );

  const Icon = getProjectIcon(project.iconId);
  const clickable = !project.isPlaceholder;
  const handleClick = clickable
    ? () => navigateToWorkProjectDetail(project.id)
    : undefined;

  return (
    <Box className="group relative h-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={!clickable}
        className={`flex h-full w-full flex-col gap-3 rounded-(--radius-3) border border-(--gray-4) bg-(--gray-1) p-4 text-left transition-colors ${
          clickable
            ? "cursor-pointer hover:border-(--gray-6) hover:bg-(--gray-2)"
            : "cursor-default opacity-60"
        }`}
      >
        <Flex
          align="center"
          justify="center"
          className="h-9 w-9 shrink-0 rounded-(--radius-2) bg-(--gray-3) text-(--gray-11)"
        >
          <Icon size={18} weight="regular" />
        </Flex>

        <Box>
          <Text
            as="div"
            weight="medium"
            className="truncate text-(--gray-12) text-[14px]"
          >
            {project.name}
          </Text>
          <Text as="div" className="text-(--gray-10) text-[12px]">
            {project.tagline}
          </Text>
        </Box>

        <Text as="div" className="mt-auto text-(--gray-9) text-[11px]">
          {project.updatedLabel}
        </Text>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        title="Edit project"
        aria-label="Edit project"
        className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1) text-(--gray-11) opacity-0 transition-[opacity,colors] focus-within:opacity-100 hover:border-(--gray-7) hover:bg-(--gray-3) hover:text-(--gray-12) group-hover:opacity-100"
      >
        <DotsThree size={14} weight="bold" />
      </button>
    </Box>
  );
}

function IconPickerDialog({
  open,
  onOpenChange,
  value,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ProjectIconId;
  onSelect: (id: ProjectIconId) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="360px" size="1">
        <Flex direction="column" gap="3">
          <Text
            as="div"
            weight="medium"
            className="text-(--gray-12) text-[14px]"
          >
            Choose an icon
          </Text>
          <Box className="grid grid-cols-6 gap-2">
            {PROJECT_ICONS.map((opt) => {
              const Icon = opt.Icon;
              const selected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelect(opt.id);
                    onOpenChange(false);
                  }}
                  title={opt.label}
                  aria-label={opt.label}
                  aria-pressed={selected}
                  className={`flex aspect-square w-full items-center justify-center rounded-(--radius-2) border transition-colors ${
                    selected
                      ? "border-(--accent-7) bg-(--accent-3) text-(--accent-11)"
                      : "border-(--gray-5) bg-(--gray-1) text-(--gray-11) hover:border-(--gray-7) hover:bg-(--gray-3) hover:text-(--gray-12)"
                  }`}
                >
                  <Icon size={16} weight="regular" />
                </button>
              );
            })}
          </Box>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function ProjectCardEditForm({
  project,
  hasEdits,
  onCancel,
  onSave,
  onReset,
}: {
  project: Project;
  hasEdits: boolean;
  onCancel: () => void;
  onSave: (next: {
    name: string;
    description: string;
    iconId: ProjectIconId;
  }) => void;
  onReset: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [iconId, setIconId] = useState<ProjectIconId>(project.iconId);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const SelectedIcon = getProjectIcon(iconId);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  const save = useCallback(() => {
    onSave({
      name: name.trim() || project.name,
      description: description.trim(),
      iconId,
    });
  }, [name, description, iconId, onSave, project.name]);

  return (
    <Box className="flex h-full flex-col gap-2 rounded-(--radius-3) border border-(--accent-7) bg-(--gray-1) p-3">
      <Flex align="center" justify="between" gap="2">
        <Text
          as="span"
          className="text-(--gray-11) text-[11px] uppercase tracking-wide"
        >
          Edit project
        </Text>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close editor"
          className="flex h-5 w-5 items-center justify-center rounded-(--radius-1) text-(--gray-10) hover:bg-(--gray-3) hover:text-(--gray-12)"
        >
          <X size={11} weight="bold" />
        </button>
      </Flex>

      <Flex align="center" gap="2">
        <button
          type="button"
          onClick={() => setIconPickerOpen(true)}
          title="Change icon"
          aria-label="Change icon"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-2) border border-(--gray-5) bg-(--gray-3) text-(--gray-11) transition-colors hover:border-(--gray-7) hover:bg-(--gray-4) hover:text-(--gray-12)"
        >
          <SelectedIcon size={16} weight="regular" />
        </button>
        <Text as="span" className="text-(--gray-10) text-[11px]">
          Click to change icon
        </Text>
      </Flex>

      <IconPickerDialog
        open={iconPickerOpen}
        onOpenChange={setIconPickerOpen}
        value={iconId}
        onSelect={setIconId}
      />

      <input
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Project name"
        className="block w-full rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1) px-2 py-1 text-(--gray-12) text-[13px] outline-none focus:border-(--accent-7) focus:ring-(--accent-7) focus:ring-1"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        rows={2}
        placeholder="Description"
        className="block w-full resize-none rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1) px-2 py-1 text-(--gray-12) text-[12px] outline-none focus:border-(--accent-7) focus:ring-(--accent-7) focus:ring-1"
      />

      <Flex align="center" gap="2" className="mt-auto pt-1">
        {hasEdits && (
          <button
            type="button"
            onClick={onReset}
            title="Reset to default"
            className="flex items-center gap-1 text-(--gray-10) text-[11px] hover:text-(--gray-12)"
          >
            <ArrowCounterClockwise size={10} weight="bold" />
            Reset
          </button>
        )}
        <Box className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-7 items-center rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1) px-2 text-(--gray-11) text-[12px] hover:border-(--gray-7) hover:bg-(--gray-3) hover:text-(--gray-12)"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="flex h-7 items-center gap-1 rounded-(--radius-2) bg-(--gray-12) px-2 text-(--gray-1) text-[12px] hover:bg-(--gray-11)"
          >
            <Check size={11} weight="bold" />
            Save
          </button>
        </Box>
      </Flex>
    </Box>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const resolved = useResolvedProject(project);
  const edit = useProjectEditsStore((s) => s.editsByProjectId[project.id]);
  const patchEdit = useProjectEditsStore((s) => s.patchEdit);
  const clearEdit = useProjectEditsStore((s) => s.clearEdit);

  const [editing, setEditing] = useState(false);
  const hasEdits = !!edit && Object.keys(edit).length > 0;

  if (editing) {
    return (
      <ProjectCardEditForm
        project={resolved}
        hasEdits={hasEdits}
        onCancel={() => setEditing(false)}
        onReset={() => {
          clearEdit(project.id);
          setEditing(false);
        }}
        onSave={(next) => {
          const patch: Partial<{
            name: string;
            description: string;
            iconId: ProjectIconId;
          }> = {};
          if (next.name !== project.name) patch.name = next.name;
          if (next.description !== project.description)
            patch.description = next.description;
          if (next.iconId !== project.iconId) patch.iconId = next.iconId;
          if (Object.keys(patch).length > 0) patchEdit(project.id, patch);
          setEditing(false);
        }}
      />
    );
  }

  return <ProjectCardView project={resolved} onEdit={() => setEditing(true)} />;
}

export function WorkProjectsView() {
  return (
    <Box className="scrollbar-overlay-y h-full w-full overflow-y-auto">
      <Flex
        direction="column"
        gap="6"
        className="mx-auto w-full max-w-[960px] px-8 pt-12 pb-12"
      >
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Flex direction="column" gap="1">
            <Text
              as="div"
              weight="medium"
              className="text-(--gray-12) text-[22px]"
            >
              Projects
            </Text>
            <Text as="div" className="text-(--gray-11) text-[13px]">
              A home for related dashboards, automations, files, and skills.
            </Text>
          </Flex>

          <Flex align="center" gap="2">
            <button
              type="button"
              title="Sort"
              className="flex h-8 w-8 items-center justify-center rounded-(--radius-2) text-(--gray-10) transition-colors hover:bg-(--gray-3) hover:text-(--gray-12)"
            >
              <SortAscending size={14} weight="regular" />
            </button>
            <button
              type="button"
              title="Search"
              className="flex h-8 w-8 items-center justify-center rounded-(--radius-2) text-(--gray-10) transition-colors hover:bg-(--gray-3) hover:text-(--gray-12)"
            >
              <MagnifyingGlass size={14} weight="regular" />
            </button>
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-(--radius-2) bg-(--gray-12) px-3 text-(--gray-1) text-[13px] transition-colors hover:bg-(--gray-11)"
            >
              <Plus size={13} weight="bold" />
              New project
            </button>
          </Flex>
        </Flex>

        <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </Box>
      </Flex>
    </Box>
  );
}
