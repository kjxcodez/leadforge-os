import { useUIStore } from '../stores/ui-store';

/**
 * useUI exposes sidebar state, command palette, and other UI controls
 * without exposing the raw store dispatch.
 */
export function useUI() {
  const { state, toggleSidebar, setSidebar, toggleCommandPalette, closeCommandPalette } = useUIStore();

  return {
    sidebarCollapsed: state.sidebarCollapsed,
    commandPaletteOpen: state.commandPaletteOpen,
    toggleSidebar,
    setSidebar,
    toggleCommandPalette,
    closeCommandPalette,
  };
}
