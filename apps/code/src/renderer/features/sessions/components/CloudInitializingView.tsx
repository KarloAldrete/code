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
        subtitle: "Weaving twigs into a cozy sandbox.",
      };
    default:
      return {
        heading: "Building the nest…",
        subtitle: "Getting things ready.",
      };
  }
}

type TwigStyle = CSSProperties & Record<string, string | number>;

// Foundation twigs are always visible — they form the base bowl shape of the
// nest so the user reads "nest" immediately, not "empty stage". Layered back
// (zIndex 0) → middle (1) → front (2) with the back/front rows slightly wider.
const FOUNDATION_TWIGS: TwigStyle[] = [
  {
    "--twig-x": "-44px",
    "--twig-y": "-16px",
    "--twig-rot": "-14deg",
    width: "60px",
    zIndex: 0,
  },
  {
    "--twig-x": "32px",
    "--twig-y": "-14px",
    "--twig-rot": "16deg",
    width: "62px",
    zIndex: 0,
  },
  {
    "--twig-x": "-10px",
    "--twig-y": "-20px",
    "--twig-rot": "-4deg",
    width: "54px",
    zIndex: 0,
  },
  {
    "--twig-x": "-32px",
    "--twig-y": "-6px",
    "--twig-rot": "8deg",
    width: "56px",
    zIndex: 1,
  },
  {
    "--twig-x": "22px",
    "--twig-y": "-4px",
    "--twig-rot": "-10deg",
    width: "52px",
    zIndex: 1,
  },
  {
    "--twig-x": "-2px",
    "--twig-y": "0px",
    "--twig-rot": "2deg",
    width: "72px",
    zIndex: 2,
  },
];

// Active twigs cycle in every 0.8s (one per "beat" of the hedgehog's
// placement gesture). Each has a from-position (above, rotated) and a
// to-position (its slot in the nest). Animation duration is 3.2s with 4
// staggered delays so all 4 share a synchronized loop.
const ACTIVE_TWIGS: TwigStyle[] = [
  {
    "--twig-x": "-24px",
    "--twig-y": "-12px",
    "--twig-rot": "-22deg",
    "--twig-x-from": "-10px",
    "--twig-rot-from": "-60deg",
    width: "48px",
    animationDelay: "0s",
    zIndex: 2,
  },
  {
    "--twig-x": "26px",
    "--twig-y": "-10px",
    "--twig-rot": "18deg",
    "--twig-x-from": "10px",
    "--twig-rot-from": "60deg",
    width: "50px",
    animationDelay: "0.8s",
    zIndex: 2,
  },
  {
    "--twig-x": "0px",
    "--twig-y": "-18px",
    "--twig-rot": "-2deg",
    "--twig-x-from": "0px",
    "--twig-rot-from": "20deg",
    width: "46px",
    animationDelay: "1.6s",
    zIndex: 1,
  },
  {
    "--twig-x": "-14px",
    "--twig-y": "-2px",
    "--twig-rot": "10deg",
    "--twig-x-from": "-4px",
    "--twig-rot-from": "-40deg",
    width: "44px",
    animationDelay: "2.4s",
    zIndex: 2,
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
      <div className="relative h-[220px] w-[260px]">
        <div className="absolute inset-x-0 bottom-[44px] flex justify-center">
          <div className="nest-builder-work">
            <img src={builderHog} alt="" className="block w-[130px]" />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[56px]">
          <div className="absolute inset-x-[28%] bottom-1 h-2 rounded-full bg-(--gray-a4) blur-[3px]" />

          {FOUNDATION_TWIGS.map((style) => (
            <div
              key={`f-${style["--twig-x"]}-${style["--twig-y"]}`}
              className="nest-twig nest-twig-static"
              style={style}
            />
          ))}
          {ACTIVE_TWIGS.map((style) => {
            const key = String(style.animationDelay);
            return (
              <div key={`active-${key}`}>
                <div className="nest-twig nest-twig-active" style={style} />
                <div
                  className="nest-puff"
                  style={
                    {
                      "--twig-x": style["--twig-x"],
                      "--twig-y": style["--twig-y"],
                      animationDelay: style.animationDelay,
                    } as CSSProperties
                  }
                />
              </div>
            );
          })}
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
