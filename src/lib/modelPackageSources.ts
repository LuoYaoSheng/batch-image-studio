export type CompatibleModelPackageSource = {
  id: "compatible-github";
  label: string;
  url: string;
  description: string;
};

export type ModelInfoSource = {
  id: "official-github";
  label: string;
  url: string;
  description: string;
};

const COMPATIBLE_MODEL_PACKAGE_SOURCES: CompatibleModelPackageSource[] = [
  {
    id: "compatible-github",
    label: "兼容模型包（GitHub）",
    url: "https://github.com/LuoYaoSheng/batch-image-studio/releases/download/v0.1.1/batch-image-studio-model-lama-v1-1.0.0.zip",
    description: "本应用可直接安装的兼容模型包。",
  },
];

const MODEL_INFO_SOURCE: ModelInfoSource = {
  id: "official-github",
  label: "官方 GitHub",
  url: "https://github.com/advimman/lama",
  description: "查看 LaMa 官方项目说明与原始来源。",
};

export function getPreferredCompatibleModelPackageSource() {
  return COMPATIBLE_MODEL_PACKAGE_SOURCES[0];
}

export function getCompatibleModelPackageSources() {
  return COMPATIBLE_MODEL_PACKAGE_SOURCES;
}

export function getOfficialModelInfoSource() {
  return MODEL_INFO_SOURCE;
}
