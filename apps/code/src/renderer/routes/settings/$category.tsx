import { SettingsPanel } from "@features/settings/components/SettingsPanel";
import {
  type SettingsCategory,
  useSettingsDialogStore,
} from "@features/settings/stores/settingsDialogStore";
import { isSettingsCategory } from "@features/settings/types";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/settings/$category")({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { category } = Route.useParams();
  const cat: SettingsCategory = isSettingsCategory(category)
    ? category
    : "general";

  // Sync the settings store's category to the URL param. Components nested in
  // SettingsPanel still read activeCategory from the store; this keeps both in
  // sync when navigation lands here from a deep link or back/forward.
  useEffect(() => {
    const state = useSettingsDialogStore.getState();
    if (state.activeCategory !== cat || !state.isOpen) {
      useSettingsDialogStore.setState({
        isOpen: true,
        activeCategory: cat,
        formMode: false,
      });
    }
    return () => {
      // Clear the open flag when leaving the settings route so legacy
      // consumers reading `isOpen` don't see a stale value.
      useSettingsDialogStore.setState({ isOpen: false, formMode: false });
    };
  }, [cat]);

  return <SettingsPanel />;
}
