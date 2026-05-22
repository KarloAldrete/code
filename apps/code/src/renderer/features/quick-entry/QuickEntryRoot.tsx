import { ErrorBoundary } from "@components/ErrorBoundary";
import { useThemeStore } from "@renderer/stores/themeStore";
import { useEffect } from "react";
import { QuickEntryView } from "./QuickEntryView";

export function QuickEntryRoot() {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    document.documentElement.style.backgroundColor = "transparent";
    document.body.style.backgroundColor = "transparent";
  }, [isDarkMode]);

  return (
    <ErrorBoundary name="QuickEntry">
      <div className="h-screen w-screen overflow-hidden bg-transparent">
        <QuickEntryView />
      </div>
    </ErrorBoundary>
  );
}
