import {
  Brain,
  Briefcase,
  ChartLineUp,
  Code,
  Compass,
  Flask,
  type IconProps,
  Lightbulb,
  Megaphone,
  Microphone,
  Rocket,
  Sparkle,
  Target,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";

export type ProjectIconId =
  | "rocket"
  | "microphone"
  | "megaphone"
  | "sparkle"
  | "lightbulb"
  | "flask"
  | "code"
  | "target"
  | "chartLineUp"
  | "briefcase"
  | "compass"
  | "brain";

export interface ProjectIconOption {
  id: ProjectIconId;
  label: string;
  Icon: ComponentType<IconProps>;
}

export const PROJECT_ICONS: ProjectIconOption[] = [
  { id: "rocket", label: "Rocket", Icon: Rocket },
  { id: "microphone", label: "Microphone", Icon: Microphone },
  { id: "megaphone", label: "Megaphone", Icon: Megaphone },
  { id: "sparkle", label: "Sparkle", Icon: Sparkle },
  { id: "lightbulb", label: "Lightbulb", Icon: Lightbulb },
  { id: "flask", label: "Flask", Icon: Flask },
  { id: "code", label: "Code", Icon: Code },
  { id: "target", label: "Target", Icon: Target },
  { id: "chartLineUp", label: "Chart", Icon: ChartLineUp },
  { id: "briefcase", label: "Briefcase", Icon: Briefcase },
  { id: "compass", label: "Compass", Icon: Compass },
  { id: "brain", label: "Brain", Icon: Brain },
];

export const PROJECT_ICON_MAP: Record<
  ProjectIconId,
  ComponentType<IconProps>
> = Object.fromEntries(PROJECT_ICONS.map((o) => [o.id, o.Icon])) as Record<
  ProjectIconId,
  ComponentType<IconProps>
>;

export function getProjectIcon(id: ProjectIconId): ComponentType<IconProps> {
  return PROJECT_ICON_MAP[id] ?? Rocket;
}
