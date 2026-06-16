import {
  ChatCircleIcon,
  ChatTextIcon,
  ClockIcon,
  CodeIcon,
  GaugeIcon,
  GlobeIcon,
  HardDrivesIcon,
  InfoIcon,
  KeyIcon,
  LightningIcon,
  LinkIcon,
  LockKeyIcon,
  PuzzlePieceIcon,
  ScrollIcon,
  SparkleIcon,
  UserIcon,
  WebhooksLogoIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import type {
  AgentSpec,
  BundleFile,
} from "@posthog/shared/agent-platform-types";
import { MarkdownRenderer } from "@posthog/ui/features/editor/components/MarkdownRenderer";
import { Badge } from "@posthog/ui/primitives/Badge";
import { CodeBlock } from "@posthog/ui/primitives/CodeBlock";
import { Flex, Text } from "@radix-ui/themes";
import { type ReactNode, useMemo, useState } from "react";
import { useAgentApplication } from "../hooks/useAgentApplication";
import { useAgentEnvKeys } from "../hooks/useAgentEnvKeys";
import { useAgentRevision } from "../hooks/useAgentRevision";
import { useAgentRevisionBundle } from "../hooks/useAgentRevisionBundle";
import { AgentDetailEmptyState, AgentDetailLayout } from "./AgentDetailLayout";
import { FileExplorer, type FileTreeNode } from "./FileExplorer";

// --- value readers (spec items are loosely typed on the wire) ---------------
function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

const ICON = { size: 14, className: "shrink-0 text-gray-10" } as const;

function triggerType(t: unknown): string {
  return str(rec(t).type) ?? "trigger";
}
function triggerIcon(type: string): ReactNode {
  switch (type) {
    case "cron":
      return <ClockIcon {...ICON} />;
    case "slack":
      return <ChatCircleIcon {...ICON} />;
    case "webhook":
      return <WebhooksLogoIcon {...ICON} />;
    case "chat":
      return <ChatTextIcon {...ICON} />;
    case "mcp":
      return <HardDrivesIcon {...ICON} />;
    default:
      return <GlobeIcon {...ICON} />;
  }
}
function toolId(t: unknown): string {
  return str(rec(t).id) ?? "tool";
}
function toolIcon(kind: string | undefined): ReactNode {
  if (kind === "client") return <UserIcon {...ICON} />;
  if (kind === "custom") return <CodeIcon {...ICON} />;
  return <SparkleIcon {...ICON} />;
}
/** Strip a leading namespace from a tool id for display (`@a/b` → `b`). */
function shortName(id: string): string {
  const slash = id.lastIndexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

/** All secret keys the agent reads: spec.secrets[] plus any already-set keys. */
function allSecretKeys(spec: AgentSpec, setKeys: string[]): string[] {
  const set = new Set<string>(
    arr(spec.secrets).filter((s): s is string => typeof s === "string"),
  );
  for (const k of setKeys) set.add(k);
  return [...set].sort();
}

// --- tree -------------------------------------------------------------------

function buildTree(spec: AgentSpec, setKeys: string[]): FileTreeNode {
  const children: FileTreeNode[] = [
    {
      type: "file",
      name: "model",
      path: "cfg:model",
      icon: <SparkleIcon {...ICON} />,
    },
    {
      type: "file",
      name: "instructions",
      path: "cfg:instructions",
      icon: <ScrollIcon {...ICON} />,
    },
  ];

  const triggers = arr(spec.triggers);
  if (triggers.length > 0) {
    children.push({
      type: "folder",
      name: "triggers",
      path: "cfg:triggers",
      icon: <LightningIcon {...ICON} />,
      children: triggers.map((t, i) => {
        const type = triggerType(t);
        return {
          type: "file" as const,
          name: type,
          path: `cfg:trigger/${i}`,
          icon: triggerIcon(type),
        };
      }),
    });
  }

  const tools = arr(spec.tools);
  if (tools.length > 0) {
    children.push({
      type: "folder",
      name: "tools",
      path: "cfg:tools",
      icon: <WrenchIcon {...ICON} />,
      children: tools.map((t) => {
        const r = rec(t);
        const id = toolId(t);
        return {
          type: "file" as const,
          name: shortName(id),
          path: `cfg:tool/${id}`,
          icon: toolIcon(str(r.kind)),
          trailing:
            r.requires_approval === true ? (
              <LockKeyIcon size={11} className="text-amber-10" />
            ) : undefined,
        };
      }),
    });
  }

  const skills = arr(spec.skills);
  if (skills.length > 0) {
    children.push({
      type: "folder",
      name: "skills",
      path: "cfg:skills",
      icon: <PuzzlePieceIcon {...ICON} />,
      children: skills.map((s) => {
        const r = rec(s);
        const id = str(r.id) ?? str(r.path) ?? "skill";
        return {
          type: "file" as const,
          name: id,
          path: `cfg:skill/${id}`,
          description: str(r.description),
          icon: <PuzzlePieceIcon {...ICON} />,
        };
      }),
    });
  }

  const mcps = arr(spec.mcps);
  if (mcps.length > 0) {
    children.push({
      type: "folder",
      name: "mcps",
      path: "cfg:mcps",
      icon: <HardDrivesIcon {...ICON} />,
      children: mcps.map((m) => {
        const id = str(rec(m).id) ?? "mcp";
        return {
          type: "file" as const,
          name: id,
          path: `cfg:mcp/${id}`,
          icon: <HardDrivesIcon {...ICON} />,
        };
      }),
    });
  }

  const integrations = arr(spec.integrations).filter(
    (s): s is string => typeof s === "string",
  );
  if (integrations.length > 0) {
    children.push({
      type: "folder",
      name: "integrations",
      path: "cfg:integrations",
      icon: <LinkIcon {...ICON} />,
      children: integrations.map((name) => ({
        type: "file" as const,
        name,
        path: `cfg:integration/${name}`,
        icon: <LinkIcon {...ICON} />,
      })),
    });
  }

  const secretKeys = allSecretKeys(spec, setKeys);
  if (secretKeys.length > 0) {
    children.push({
      type: "folder",
      name: "secrets",
      path: "cfg:secrets",
      icon: <KeyIcon {...ICON} />,
      children: secretKeys.map((key) => ({
        type: "file" as const,
        name: key,
        path: `cfg:secret/${key}`,
        icon: <KeyIcon {...ICON} />,
        trailing: setKeys.includes(key) ? undefined : (
          <Badge color="amber">not set</Badge>
        ),
      })),
    });
  }

  children.push({
    type: "file",
    name: "limits",
    path: "cfg:limits",
    icon: <GaugeIcon {...ICON} />,
  });

  return { type: "folder", name: "root", children };
}

// --- pane -------------------------------------------------------------------

export function AgentConfigurationPane({
  idOrSlug,
  selectedNode,
  onSelectNode,
}: {
  idOrSlug: string;
  selectedNode: string | null;
  onSelectNode: (node: string) => void;
}) {
  const { data: application } = useAgentApplication(idOrSlug);
  const liveRevisionId = application?.live_revision ?? null;
  const { data: revision, isLoading } = useAgentRevision(
    idOrSlug,
    liveRevisionId,
  );
  const { data: bundle } = useAgentRevisionBundle(idOrSlug, liveRevisionId);
  const { data: envKeys } = useAgentEnvKeys(idOrSlug);

  const spec = revision?.spec ?? null;
  const setKeys = useMemo(() => envKeys ?? [], [envKeys]);
  const files = useMemo(() => bundle ?? [], [bundle]);
  const tree = useMemo(
    () => (spec ? buildTree(spec, setKeys) : null),
    [spec, setKeys],
  );
  const node = selectedNode ?? "cfg:model";

  return (
    <AgentDetailLayout idOrSlug={idOrSlug} activeTab="configuration" fill>
      {!liveRevisionId ? (
        <div className="p-6">
          <AgentDetailEmptyState
            title="No live revision"
            description="This agent has no promoted revision yet, so there's no live configuration to show."
          />
        </div>
      ) : !spec ? (
        <div className="p-6">
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-(--radius-2) border border-border bg-(--gray-2)" />
          ) : (
            <AgentDetailEmptyState
              title="Couldn't load configuration"
              description="The live revision's spec could not be loaded."
            />
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <FileExplorer
            tree={tree}
            selectedPath={node}
            onSelectPath={onSelectNode}
            storageKey="agent-config-explorer"
          >
            <DetailPane
              node={node}
              spec={spec}
              files={files}
              setKeys={setKeys}
              onSelect={onSelectNode}
            />
          </FileExplorer>
        </div>
      )}
    </AgentDetailLayout>
  );
}

// --- detail dispatch --------------------------------------------------------

const SECTION_INFO: Record<string, string> = {
  "cfg:model":
    "The model every request goes to. `reasoning` sets the extended-thinking budget; limits cap a run's turns, tool calls and wall time.",
  "cfg:instructions":
    "The agent's entrypoint prompt (agent.md) — the always-on system instructions.",
  "cfg:triggers": "What can start a session — chat, webhook, mcp, slack, cron.",
  "cfg:tools": "The callable functions this agent has, by where they run.",
  "cfg:skills":
    "Markdown playbooks the agent loads on demand. Only the description is in the prompt until loaded.",
  "cfg:mcps": "Remote MCP servers the agent connects to at session start.",
  "cfg:integrations":
    "Team-level integrations the agent reuses (configured once at the project level).",
  "cfg:secrets": "Env keys this agent reads. Values are never shown.",
  "cfg:limits": "Hard caps on a single run.",
};

function DetailPane({
  node,
  spec,
  files,
  setKeys,
  onSelect,
}: {
  node: string;
  spec: AgentSpec;
  files: BundleFile[];
  setKeys: string[];
  onSelect: (node: string) => void;
}) {
  const [section, ...idParts] = node.replace(/^cfg:/, "").split("/");
  const id = idParts.join("/");
  const meta = nodeHeader(section, id, spec);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DetailHeader
        icon={meta.icon}
        title={meta.title}
        node={node}
        info={SECTION_INFO[`cfg:${section}`]}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <DetailBody
          section={section}
          id={id}
          spec={spec}
          files={files}
          setKeys={setKeys}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

function nodeHeader(
  section: string,
  id: string,
  spec: AgentSpec,
): { icon: ReactNode; title: string } {
  switch (section) {
    case "model":
      return { icon: <SparkleIcon {...ICON} />, title: "Model" };
    case "instructions":
      return { icon: <ScrollIcon {...ICON} />, title: "Instructions" };
    case "triggers":
      return { icon: <LightningIcon {...ICON} />, title: "Triggers" };
    case "trigger": {
      const t = arr(spec.triggers)[Number(id)];
      const type = triggerType(t);
      return { icon: triggerIcon(type), title: `${type} trigger` };
    }
    case "tools":
      return { icon: <WrenchIcon {...ICON} />, title: "Tools" };
    case "tool":
      return { icon: <WrenchIcon {...ICON} />, title: shortName(id) };
    case "skills":
      return { icon: <PuzzlePieceIcon {...ICON} />, title: "Skills" };
    case "skill":
      return { icon: <PuzzlePieceIcon {...ICON} />, title: id };
    case "mcps":
      return { icon: <HardDrivesIcon {...ICON} />, title: "MCP servers" };
    case "mcp":
      return { icon: <HardDrivesIcon {...ICON} />, title: id };
    case "integrations":
      return { icon: <LinkIcon {...ICON} />, title: "Integrations" };
    case "integration":
      return { icon: <LinkIcon {...ICON} />, title: id };
    case "secrets":
      return { icon: <KeyIcon {...ICON} />, title: "Secrets" };
    case "secret":
      return { icon: <KeyIcon {...ICON} />, title: id };
    case "limits":
      return { icon: <GaugeIcon {...ICON} />, title: "Limits" };
    default:
      return { icon: <SparkleIcon {...ICON} />, title: section };
  }
}

function DetailHeader({
  icon,
  title,
  node,
  info,
}: {
  icon: ReactNode;
  title: string;
  node: string;
  info?: string;
}) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="shrink-0 border-(--gray-5) border-b px-5 py-3">
      <Flex align="center" gap="2">
        {icon}
        <Text className="font-semibold text-[14px] text-gray-12">{title}</Text>
        {info ? (
          <button
            type="button"
            onClick={() => setShowInfo((s) => !s)}
            className="text-gray-10 hover:text-gray-12"
            aria-label="About this section"
          >
            <InfoIcon size={14} />
          </button>
        ) : null}
        <span className="ml-auto truncate rounded-(--radius-1) border border-border bg-(--gray-2) px-1.5 py-0.5 text-[10.5px] text-gray-10 [font-family:var(--font-mono)]">
          {node}
        </span>
      </Flex>
      {showInfo && info ? (
        <Text className="mt-2 block text-[12px] text-gray-11 leading-snug">
          {info}
        </Text>
      ) : null}
    </div>
  );
}

function DetailBody({
  section,
  id,
  spec,
  files,
  setKeys,
  onSelect,
}: {
  section: string;
  id: string;
  spec: AgentSpec;
  files: BundleFile[];
  setKeys: string[];
  onSelect: (node: string) => void;
}) {
  switch (section) {
    case "model":
      return <ModelBody spec={spec} />;
    case "instructions":
      return (
        <BundleFileBody
          file={byPath(files, "agent.md")}
          emptyLabel="No agent.md in this revision."
        />
      );
    case "triggers":
      return <TriggersOverview spec={spec} onSelect={onSelect} />;
    case "trigger":
      return <TriggerBody trigger={arr(spec.triggers)[Number(id)]} />;
    case "tools":
      return <ToolsOverview spec={spec} onSelect={onSelect} />;
    case "tool":
      return (
        <ToolBody tool={findById(arr(spec.tools), id)} files={files} id={id} />
      );
    case "skills":
      return <SkillsOverview spec={spec} onSelect={onSelect} />;
    case "skill":
      return (
        <SkillBody
          skill={findById(arr(spec.skills), id)}
          file={byPath(files, `skills/${id}/SKILL.md`)}
        />
      );
    case "mcps":
      return <McpsOverview spec={spec} onSelect={onSelect} />;
    case "mcp":
      return <McpBody mcp={findById(arr(spec.mcps), id)} />;
    case "integrations":
      return <IntegrationsOverview spec={spec} onSelect={onSelect} />;
    case "integration":
      return <IntegrationBody name={id} />;
    case "secrets":
      return (
        <SecretsOverview spec={spec} setKeys={setKeys} onSelect={onSelect} />
      );
    case "secret":
      return <SecretBody keyName={id} setKeys={setKeys} />;
    case "limits":
      return <LimitsBody spec={spec} />;
    default:
      return <Muted>Nothing to show.</Muted>;
  }
}

function findById(items: unknown[], id: string): unknown {
  return items.find((it) => str(rec(it).id) === id);
}
function byPath(files: BundleFile[], path: string): BundleFile | undefined {
  return files.find((f) => f.path === path);
}

// --- bodies -----------------------------------------------------------------

function ModelBody({ spec }: { spec: AgentSpec }) {
  return (
    <Flex direction="column" gap="2">
      <Row label="model" value={spec.model ?? "not set"} mono />
      <Row label="reasoning" value={spec.reasoning ?? "default"} />
      {spec.entrypoint ? (
        <Row label="entrypoint" value={spec.entrypoint} mono />
      ) : null}
    </Flex>
  );
}

function LimitsBody({ spec }: { spec: AgentSpec }) {
  const limits = spec.limits ?? {};
  const entries = Object.entries(limits).filter(([, v]) => v != null);
  if (entries.length === 0) return <Muted>No limits configured.</Muted>;
  return (
    <Flex direction="column" gap="2">
      {entries.map(([k, v]) => (
        <Row key={k} label={k.replace(/_/g, " ")} value={String(v)} />
      ))}
    </Flex>
  );
}

const TRIGGER_EXPLAINER: Record<string, string> = {
  cron: "Fires on a schedule from the scheduler — no inbound endpoint.",
  slack: "Responds to Slack events in workspaces you trust.",
  webhook: "An inbound POST whose body becomes the agent's first message.",
  chat: "An interactive chat session over HTTP + SSE.",
  mcp: "Exposes the agent as an MCP server other clients can call.",
};

function TriggersOverview({
  spec,
  onSelect,
}: {
  spec: AgentSpec;
  onSelect: (node: string) => void;
}) {
  const triggers = arr(spec.triggers);
  if (triggers.length === 0) return <Muted>No triggers configured.</Muted>;
  return (
    <Flex direction="column" gap="3">
      <Muted>What can start a session — {triggers.length} configured.</Muted>
      <Flex direction="column" gap="2">
        {triggers.map((t, i) => {
          const type = triggerType(t);
          const cfg = rec(rec(t).config);
          const disc =
            str(cfg.name) ?? str(cfg.path) ?? str(cfg.channel_id) ?? String(i);
          return (
            <JumpRow
              key={`${type}:${disc}`}
              icon={triggerIcon(type)}
              title={type}
              subtitle={TRIGGER_EXPLAINER[type]}
              onClick={() => onSelect(`cfg:trigger/${i}`)}
            />
          );
        })}
      </Flex>
    </Flex>
  );
}

function TriggerBody({ trigger }: { trigger: unknown }) {
  const r = rec(trigger);
  const type = triggerType(trigger);
  const config = rec(r.config);
  const authModes = arr(rec(r.auth).modes);
  return (
    <Flex direction="column" gap="2">
      {TRIGGER_EXPLAINER[type] ? (
        <Muted>{TRIGGER_EXPLAINER[type]}</Muted>
      ) : null}
      <Row label="type" value={type} mono />
      {Object.entries(config).map(([k, v]) => (
        <Row
          key={k}
          label={k.replace(/_/g, " ")}
          value={typeof v === "string" ? v : JSON.stringify(v)}
        />
      ))}
      {authModes.length > 0 ? (
        <Row
          label="auth"
          value={authModes.map((m) => str(rec(m).type) ?? "?").join(", ")}
          mono
        />
      ) : null}
    </Flex>
  );
}

function ToolsOverview({
  spec,
  onSelect,
}: {
  spec: AgentSpec;
  onSelect: (node: string) => void;
}) {
  const tools = arr(spec.tools);
  if (tools.length === 0) return <Muted>No tools.</Muted>;
  const counts = tools.reduce<Record<string, number>>((acc, t) => {
    const kind = str(rec(t).kind) ?? "native";
    acc[kind] = (acc[kind] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <Flex direction="column" gap="3">
      <Muted>
        {Object.entries(counts)
          .map(([k, n]) => `${n} ${k}`)
          .join(" · ")}
      </Muted>
      <Flex direction="column" gap="2">
        {tools.map((t) => {
          const r = rec(t);
          const id = toolId(t);
          return (
            <JumpRow
              key={id}
              icon={toolIcon(str(r.kind))}
              title={shortName(id)}
              subtitle={str(r.description)}
              trailing={
                r.requires_approval === true ? (
                  <Badge color="amber">approval</Badge>
                ) : undefined
              }
              onClick={() => onSelect(`cfg:tool/${id}`)}
            />
          );
        })}
      </Flex>
    </Flex>
  );
}

function ToolBody({
  tool,
  files,
  id,
}: {
  tool: unknown;
  files: BundleFile[];
  id: string;
}) {
  const r = rec(tool);
  const kind = str(r.kind);
  const source = byPath(files, `tools/${id}/source.ts`);
  return (
    <Flex direction="column" gap="2">
      <Row label="id" value={id} mono />
      {kind ? <Row label="kind" value={kind} /> : null}
      <Row
        label="approval"
        value={
          r.requires_approval === true
            ? "required before each call"
            : "not gated"
        }
      />
      {str(r.description) ? (
        <Text className="text-[12.5px] text-gray-11 leading-snug">
          {str(r.description)}
        </Text>
      ) : null}
      {source ? (
        <div className="mt-2">
          <Subhead>source · {source.path}</Subhead>
          <BundleFileBody file={source} />
        </div>
      ) : null}
    </Flex>
  );
}

function SkillsOverview({
  spec,
  onSelect,
}: {
  spec: AgentSpec;
  onSelect: (node: string) => void;
}) {
  const skills = arr(spec.skills);
  if (skills.length === 0) return <Muted>No skills.</Muted>;
  return (
    <Flex direction="column" gap="3">
      <Muted>
        Markdown playbooks loaded on demand — {skills.length} here. Only the
        description is in the prompt until a skill is loaded.
      </Muted>
      <Flex direction="column" gap="2">
        {skills.map((s) => {
          const r = rec(s);
          const id = str(r.id) ?? str(r.path) ?? "skill";
          return (
            <JumpRow
              key={id}
              icon={<PuzzlePieceIcon {...ICON} />}
              title={id}
              subtitle={str(r.description)}
              onClick={() => onSelect(`cfg:skill/${id}`)}
            />
          );
        })}
      </Flex>
    </Flex>
  );
}

function SkillBody({
  skill,
  file,
}: {
  skill: unknown;
  file: BundleFile | undefined;
}) {
  const r = rec(skill);
  return (
    <Flex direction="column" gap="2">
      <Row label="id" value={str(r.id) ?? "skill"} mono />
      <Text className="text-[12.5px] text-gray-11 leading-snug">
        {str(r.description) ?? "No description."}
      </Text>
      <div className="mt-2">
        <Subhead>body · skills/{str(r.id)}/SKILL.md</Subhead>
        <BundleFileBody
          file={file}
          emptyLabel="Body not in the loaded bundle."
        />
      </div>
    </Flex>
  );
}

function McpsOverview({
  spec,
  onSelect,
}: {
  spec: AgentSpec;
  onSelect: (node: string) => void;
}) {
  const mcps = arr(spec.mcps);
  if (mcps.length === 0) return <Muted>No MCP servers declared.</Muted>;
  return (
    <Flex direction="column" gap="2">
      {mcps.map((m) => {
        const r = rec(m);
        const id = str(r.id) ?? "mcp";
        return (
          <JumpRow
            key={id}
            icon={<HardDrivesIcon {...ICON} />}
            title={id}
            subtitle={str(r.url)}
            onClick={() => onSelect(`cfg:mcp/${id}`)}
          />
        );
      })}
    </Flex>
  );
}

function McpBody({ mcp }: { mcp: unknown }) {
  const r = rec(mcp);
  const tools = arr(r.tools);
  return (
    <Flex direction="column" gap="2">
      {str(r.url) ? (
        <Row label="url" value={str(r.url) as string} mono />
      ) : null}
      <Row label="tools" value={String(tools.length)} />
    </Flex>
  );
}

function IntegrationsOverview({
  spec,
  onSelect,
}: {
  spec: AgentSpec;
  onSelect: (node: string) => void;
}) {
  const integrations = arr(spec.integrations).filter(
    (s): s is string => typeof s === "string",
  );
  if (integrations.length === 0)
    return <Muted>No integrations declared.</Muted>;
  return (
    <Flex direction="column" gap="2">
      {integrations.map((name) => (
        <JumpRow
          key={name}
          icon={<LinkIcon {...ICON} />}
          title={name}
          onClick={() => onSelect(`cfg:integration/${name}`)}
        />
      ))}
    </Flex>
  );
}

function IntegrationBody({ name }: { name: string }) {
  return (
    <Flex direction="column" gap="2">
      <Row label="integration" value={name} />
      <Muted>
        The agent reuses the team's {name} connection. It's configured once at
        the project level — there's no per-agent credential here.
      </Muted>
    </Flex>
  );
}

function SecretsOverview({
  spec,
  setKeys,
  onSelect,
}: {
  spec: AgentSpec;
  setKeys: string[];
  onSelect: (node: string) => void;
}) {
  const keys = allSecretKeys(spec, setKeys);
  if (keys.length === 0) return <Muted>No secrets declared.</Muted>;
  return (
    <Flex direction="column" gap="3">
      <Muted>Env keys this agent reads. Values are never shown.</Muted>
      <Flex direction="column" gap="2">
        {keys.map((key) => (
          <JumpRow
            key={key}
            icon={<KeyIcon {...ICON} />}
            title={key}
            mono
            trailing={
              setKeys.includes(key) ? (
                <Badge color="green">set</Badge>
              ) : (
                <Badge color="amber">not set</Badge>
              )
            }
            onClick={() => onSelect(`cfg:secret/${key}`)}
          />
        ))}
      </Flex>
    </Flex>
  );
}

function SecretBody({
  keyName,
  setKeys,
}: {
  keyName: string;
  setKeys: string[];
}) {
  const isSet = setKeys.includes(keyName);
  return (
    <Flex direction="column" gap="2">
      <Row label="key" value={keyName} mono />
      <Row
        label="status"
        value={isSet ? "set" : "not set"}
        valueColor={isSet ? "var(--green-11)" : "var(--amber-11)"}
      />
      <Muted>
        The value is never shown. Setting and rotating secrets is handled by the
        concierge's interactive secret flow.
      </Muted>
    </Flex>
  );
}

function BundleFileBody({
  file,
  emptyLabel = "Not in the loaded bundle.",
}: {
  file: BundleFile | undefined;
  emptyLabel?: string;
}) {
  if (!file) return <Muted>{emptyLabel}</Muted>;
  if (file.language === "markdown") {
    return (
      <div className="text-[13px]">
        <MarkdownRenderer content={file.content} />
      </div>
    );
  }
  return <CodeBlock>{file.content}</CodeBlock>;
}

// --- shared bits ------------------------------------------------------------

function Row({
  label,
  value,
  mono,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <Flex
      align="center"
      justify="between"
      gap="3"
      className="rounded-(--radius-2) border border-border bg-(--gray-2) px-3 py-2"
    >
      <Text className="shrink-0 text-[11px] text-gray-10 uppercase tracking-wide">
        {label}
      </Text>
      <Text
        className={`truncate text-[12.5px] text-gray-12 ${mono ? "[font-family:var(--font-mono)]" : ""}`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </Text>
    </Flex>
  );
}

function JumpRow({
  icon,
  title,
  subtitle,
  trailing,
  mono,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  mono?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-(--radius-2) border border-border bg-(--color-panel-solid) px-3 py-2.5 text-left hover:border-(--gray-7)"
    >
      {icon}
      <Flex direction="column" gap="0.5" className="min-w-0 flex-1">
        <Text
          className={`truncate text-[12.5px] text-gray-12 ${mono ? "[font-family:var(--font-mono)]" : ""}`}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="truncate text-[11px] text-gray-10">{subtitle}</Text>
        ) : null}
      </Flex>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </button>
  );
}

function Subhead({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-1.5 block text-[11px] text-gray-10 uppercase tracking-wide [font-family:var(--font-mono)]">
      {children}
    </Text>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <Text className="text-[12px] text-gray-10 leading-snug">{children}</Text>
  );
}
