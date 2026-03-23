import { create } from "zustand";

type DetectionMode = "fixed" | "auto" | "hybrid";

type WorkspaceState = {
  selectedMode: DetectionMode;
  importedCount: number;
  previewStatus: "idle" | "ready";
  setMode: (mode: DetectionMode) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedMode: "fixed",
  importedCount: 128,
  previewStatus: "ready",
  setMode: (mode: DetectionMode) => set({ selectedMode: mode }),
}));
