import { invoke } from "@tauri-apps/api/core";
import type {
  InstallModelPackageResponse,
  ModelPackageTaskStarted,
  ModelStatusResponse,
} from "../types";

export async function preloadModelRuntime() {
  await invoke("preload_model");
}

export async function getModelRuntimeStatus() {
  return invoke<ModelStatusResponse>("get_model_status");
}

export async function openModelInstallDir() {
  await invoke("open_model_install_dir");
}

export async function openExternalUrl(url: string) {
  await invoke("open_external_url", { url });
}

export async function installModelPackage(filePath: string) {
  return invoke<InstallModelPackageResponse>("install_model_package", { filePath });
}

export async function startDownloadAndInstallModelPackage(url: string) {
  return invoke<ModelPackageTaskStarted>("start_download_and_install_model_package", { url });
}
