import { invoke } from "@tauri-apps/api/core";
import type { ModelStatusResponse } from "../types";

export async function preloadModelRuntime() {
  await invoke("preload_model");
}

export async function getModelRuntimeStatus() {
  return invoke<ModelStatusResponse>("get_model_status");
}
