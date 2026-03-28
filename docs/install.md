# 安装指南

Batch Image Studio 目前统一通过 GitHub Releases 分发安装包：

- 下载地址：https://github.com/LuoYaoSheng/batch-image-studio/releases
- 每个版本的安装包都已包含内置 AI 模型，无需额外下载 `model.onnx`

## macOS

推荐下载：

- Apple Silicon Mac：`aarch64` 对应的 `.dmg` 或 `.app.zip`
- Intel Mac：`x86_64` 对应的 `.dmg` 或 `.app.zip`

安装步骤：

1. 从 GitHub Releases 下载对应架构的安装包。
2. 如果是 `.dmg`，双击打开后将 `Batch Image Studio.app` 拖入 `Applications`。
3. 如果是 `.app.zip`，先解压，再将 `Batch Image Studio.app` 拖入 `Applications`。
4. 首次打开如果出现“已损坏”或“无法验证开发者”提示，先执行：

```bash
xattr -dr com.apple.quarantine "/Applications/Batch Image Studio.app"
```

5. 然后在 Finder 中右键应用，选择“打开”。

说明：

- 当前发布包未做 Apple 开发者签名与公证时，macOS 可能会拦截首次启动。
- 只要安装包来自本项目 GitHub Releases，上述处理属于未签名应用的常见安装步骤。

## Windows

推荐下载：

- `x64` 对应的 `.msi` 或安装程序

安装步骤：

1. 从 GitHub Releases 下载 Windows 安装包。
2. 双击运行安装程序。
3. 如果 Windows SmartScreen 提示“已阻止未知应用”，点击“更多信息”后选择“仍要运行”。
4. 安装完成后从开始菜单或桌面快捷方式启动应用。

说明：

- 首次启动时如果杀毒软件或系统安全策略弹出确认，请选择允许。
- 安装包已经内置模型文件，正常情况下无需手动复制额外资源。

## Linux

推荐下载：

- `.AppImage`：适合多数桌面发行版快速运行
- `.deb`：适合 Ubuntu / Debian 系发行版

安装步骤（AppImage）：

```bash
chmod +x Batch-Image-Studio*.AppImage
./Batch-Image-Studio*.AppImage
```

安装步骤（deb）：

```bash
sudo apt install ./batch-image-studio*.deb
```

说明：

- 如果系统缺少 WebKitGTK 等运行库，请按发行版提示安装依赖。
- Linux 桌面环境差异较大，建议优先在 Ubuntu 22.04 或更新版本验证。

## 常见问题

### 1. 提示 AI 模型加载失败

请先确认你下载的是 GitHub Releases 中的正式安装包，而不是早期不完整的测试产物。

### 2. 提示应用已损坏

这通常是系统安全策略拦截，并不表示压缩包真的损坏。macOS 请按上面的 `xattr` 步骤处理。

### 3. 下载后找不到该用哪个包

按平台和架构选择：

- macOS Apple Silicon：`aarch64`
- macOS Intel：`x86_64`
- Windows：通常选择 `x64`
- Linux：优先 `AppImage`，需要系统集成时再选 `deb`
