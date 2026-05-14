import { Spinner } from "@phosphor-icons/react";
import { Flex, Text } from "@radix-ui/themes";
import builderHog from "@renderer/assets/images/hedgehogs/builder-hog-03.png";
import type { TaskRunStatus } from "@shared/types";
import type { CSSProperties } from "react";

interface CloudInitializingViewProps {
  cloudStatus: TaskRunStatus | null;
}

function copyFor(cloudStatus: TaskRunStatus | null): {
  heading: string;
  subtitle: string;
} {
  switch (cloudStatus) {
    case "queued":
      return {
        heading: "Building the nest…",
        subtitle: "Waiting in the queue for a cloud sandbox.",
      };
    case "in_progress":
      return {
        heading: "Building the nest…",
        subtitle: "Starting the sandbox and connecting to your cloud runner.",
      };
    default:
      return {
        heading: "Building the nest…",
        subtitle: "Getting things ready.",
      };
  }
}

// Each twig: where it starts (off-center, up high), where it lands
// (settled into the pile), and how it rotates between the two. Staggered
// delays make twigs drop one after another instead of all at once.
const TWIGS: Array<CSSProperties & Record<string, string | number>> = [
  {
    "--twig-x-from": "-40px",
    "--twig-x-to": "-20px",
    "--twig-rot-from": "-30deg",
    "--twig-rot-to": "-18deg",
    width: "60px",
    bottom: "2px",
    animationDelay: "0s",
  },
  {
    "--twig-x-from": "30px",
    "--twig-x-to": "18px",
    "--twig-rot-from": "25deg",
    "--twig-rot-to": "14deg",
    width: "58px",
    bottom: "4px",
    animationDelay: "0.5s",
  },
  {
    "--twig-x-from": "-10px",
    "--twig-x-to": "0px",
    "--twig-rot-from": "10deg",
    "--twig-rot-to": "-4deg",
    width: "52px",
    bottom: "8px",
    animationDelay: "1s",
  },
  {
    "--twig-x-from": "20px",
    "--twig-x-to": "-12px",
    "--twig-rot-from": "-15deg",
    "--twig-rot-to": "8deg",
    width: "46px",
    bottom: "12px",
    animationDelay: "1.5s",
  },
  {
    "--twig-x-from": "-25px",
    "--twig-x-to": "10px",
    "--twig-rot-from": "20deg",
    "--twig-rot-to": "-10deg",
    width: "44px",
    bottom: "16px",
    animationDelay: "2s",
  },
  {
    "--twig-x-from": "0px",
    "--twig-x-to": "-2px",
    "--twig-rot-from": "0deg",
    "--twig-rot-to": "2deg",
    width: "38px",
    bottom: "20px",
    animationDelay: "2.5s",
  },
];

export function CloudInitializingView({
  cloudStatus,
}: CloudInitializingViewProps) {
  const { heading, subtitle } = copyFor(cloudStatus);

  return (
    <Flex
      align="center"
      justify="center"
      direction="column"
      gap="5"
      className="absolute inset-0 bg-background"
    >
      <div className="relative h-[200px] w-[200px]">
        <div className="absolute inset-x-0 bottom-[36px] flex justify-center">
          <div className="nest-builder-bob">
            <img src={builderHog} alt="" className="block w-[140px]" />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[32px]">
          {TWIGS.map((style) => (
            <div
              key={String(style.animationDelay)}
              className="nest-twig"
              style={style}
            />
          ))}
        </div>
      </div>
      <Flex direction="column" align="center" gap="2">
        <Flex align="center" gap="2">
          <Spinner size={16} className="animate-spin text-gray-9" />
          <Text className="font-medium text-base">{heading}</Text>
        </Flex>
        <Text color="gray" className="text-sm">
          {subtitle}
        </Text>
      </Flex>
    </Flex>
  );
}
