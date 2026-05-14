import {
  Compass,
  type IconProps,
  Lightbulb,
  Megaphone,
  Microphone,
  Rocket,
  Target,
  TestTube,
} from "@phosphor-icons/react";
import type { ProjectIconId } from "@shared/types/work-projects";
import type { ComponentType } from "react";

export const PROJECT_ICON_MAP: Record<
  ProjectIconId,
  ComponentType<IconProps>
> = {
  rocket: Rocket,
  microphone: Microphone,
  megaphone: Megaphone,
  lightbulb: Lightbulb,
  compass: Compass,
  target: Target,
  flask: TestTube,
};

export const PROJECT_ICON_OPTIONS: ProjectIconId[] = [
  "rocket",
  "microphone",
  "megaphone",
  "lightbulb",
  "compass",
  "target",
  "flask",
];
