import { Spinner } from "@phosphor-icons/react";
import { Flex, Text } from "@radix-ui/themes";
import zenHedgehog from "@renderer/assets/images/zen.png";
import { useEffect, useState } from "react";

interface InitializingSplashProps {
  heading: string;
  subtitle: string;
}

const REVEAL_DELAY_MS = 2000;

export function InitializingSplash({
  heading,
  subtitle,
}: InitializingSplashProps) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!revealed) {
    return (
      <Flex
        align="center"
        justify="center"
        className="absolute inset-0 bg-background"
      >
        <Spinner size={32} className="animate-spin text-gray-9" />
      </Flex>
    );
  }

  return (
    <Flex
      align="center"
      justify="center"
      direction="column"
      gap="5"
      className="absolute inset-0 bg-background"
    >
      <div className="zen-float">
        <img src={zenHedgehog} alt="" className="block w-[160px]" />
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
