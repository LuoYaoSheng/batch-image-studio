import type { AppSettings, HistoryEntry, Template } from "../types";

const TEMPLATES_KEY = "batch-image-studio.templates";
const HISTORY_KEY = "batch-image-studio.history";
const APP_SETTINGS_KEY = "batch-image-studio.app-settings";

function loadArray<T>(key: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function saveArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to persist array for key ${key}:`, error);
  }
}

function loadObject<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as Partial<T>) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveObject<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to persist object for key ${key}:`, error);
  }
}

function normalizeTemplatePreviewImage(previewImage?: string) {
  if (!previewImage) {
    return undefined;
  }

  // Drop historical data URLs so template persistence stays small.
  if (previewImage.startsWith("data:")) {
    return undefined;
  }

  return previewImage;
}

function hydrateTemplate(template: Template): Template {
  const now = new Date().toISOString();
  return {
    ...template,
    previewImage: normalizeTemplatePreviewImage(template.previewImage),
    createdAt: template.createdAt ?? now,
    updatedAt: template.updatedAt ?? template.createdAt ?? now,
  };
}

export function createStarterTemplates(): Template[] {
  const now = new Date().toISOString();
  return [
    {
      id: "starter-right-bottom",
      name: "右下角小字清理",
      region: { x: 0.68, y: 0.76, width: 0.22, height: 0.12 },
      cleanupMethod: "blur",
      sizeHandlingMode: "bottomRight",
      blurSigma: 10,
      fillColor: "#f7f9fc",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "starter-bottom-strip",
      name: "底边横条清理",
      region: { x: 0.18, y: 0.86, width: 0.64, height: 0.08 },
      cleanupMethod: "fill",
      sizeHandlingMode: "relative",
      blurSigma: 8,
      fillColor: "#ffffff",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "starter-corner-crop",
      name: "边角裁切模板",
      region: { x: 0.82, y: 0.84, width: 0.14, height: 0.1 },
      cleanupMethod: "crop",
      sizeHandlingMode: "bottomRight",
      blurSigma: 8,
      fillColor: "#f7f9fc",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function loadPersistedTemplates() {
  const rawTemplates = loadArray<Template>(TEMPLATES_KEY);
  const templates = rawTemplates.map(hydrateTemplate);

  if (rawTemplates.some((template, index) => template.previewImage !== templates[index]?.previewImage)) {
    savePersistedTemplates(templates);
  }

  return templates;
}

export function savePersistedTemplates(templates: Template[]) {
  saveArray(TEMPLATES_KEY, templates.map((template) => ({
    ...template,
    previewImage: normalizeTemplatePreviewImage(template.previewImage),
  })));
}

export function loadPersistedHistory() {
  return loadArray<HistoryEntry>(HISTORY_KEY);
}

export function savePersistedHistory(history: HistoryEntry[]) {
  saveArray(HISTORY_KEY, history);
}

export function loadPersistedSettings(defaultSettings: AppSettings) {
  return loadObject(APP_SETTINGS_KEY, defaultSettings);
}

export function savePersistedSettings(settings: AppSettings) {
  saveObject(APP_SETTINGS_KEY, settings);
}
