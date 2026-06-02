import { useSettingsDialogStore } from "@features/settings/stores/settingsDialogStore";
import { useEffect } from "react";
import { SettingsPanel } from "./SettingsPanel";

// Modal/overlay form of the settings UI. Used in pre-router shells (e.g.
// `AiApprovalScreen`) where the routed `/settings/$category` page isn't
// available because RouterProvider hasn't mounted yet. Inside the main app,
// settings is a real route — `routes/settings/$category.tsx` renders
// `<SettingsPanel/>` directly.
export function SettingsDialog() {
  const isOpen = useSettingsDialogStore((s) => s.isOpen);
  const close = useSettingsDialogStore((s) => s.close);

  useEffect(() => {
    if (!isOpen) return;
    const handlePopState = () => {
      if (!window.history.state?.settingsOpen) {
        useSettingsDialogStore.setState({ isOpen: false });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex bg-(--color-background)"
      data-overlay="settings"
    >
      <SettingsPanel />
    </div>
  );
}
