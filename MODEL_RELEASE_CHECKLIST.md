# 兼容模型包发布清单

这份清单解决的是一个很实际的问题：

`应用已经支持“下载并安装兼容模型包”，但如果 release 上没有兼容模型包资产，应用内下载就一定会 404。`

所以你后续每次想让用户“一键下载并安装”可用，都必须先把兼容模型包发布出去。

---

## 目标产物

应用内下载和导入逻辑要求的模型包格式是：

```text
batch-image-studio-model-lama-v1-1.0.0.zip
  manifest.json
  model.onnx
```

注意：

- 这里不是官方原始 `big-lama.zip`
- 这里也不是 `best.ckpt`
- 必须是当前应用可直接使用的 ONNX 模型包

---

## 目录要求

打包前请先确认本地有下面文件：

```text
resources/models/lama-v1/
  manifest.json
  model.onnx
```

其中：

- `manifest.json` 必须可被应用读取
- `model.onnx` 必须是当前运行链路可直接使用的模型文件

---

## manifest 最低要求

建议 `manifest.json` 至少包含：

```json
{
  "profileId": "lama-v1",
  "displayName": "LaMa v1",
  "version": "1.0.0",
  "modelFile": "model.onnx",
  "inputWidth": 512,
  "inputHeight": 512,
  "sha256": "<model.onnx sha256>",
  "minAppVersion": "0.1.1"
}
```

当前应用已经会检查：

- `modelFile` 是否存在
- `sha256`
- `minAppVersion`

---

## 推荐打包流程

### 1. 生成 sha256

在 `resources/models/lama-v1/` 目录下执行：

```bash
shasum -a 256 model.onnx
```

把输出写回 `manifest.json` 的 `sha256` 字段。

### 2. 确认版本

把 `manifest.json` 的 `version` 和准备发布的模型版本保持一致，例如：

- `1.0.0`

同时确认 `minAppVersion` 与当前应用兼容。

### 3. 生成 zip

在 `resources/models/lama-v1/` 目录下执行：

```bash
zip -j batch-image-studio-model-lama-v1-1.0.0.zip manifest.json model.onnx
```

要求：

- zip 内部是平铺结构
- 不要把上层目录一起打进去

### 4. 本地回归验证

建议先在本地做一次验证：

1. 删除 `AppLocalData/models/` 里的旧模型
2. 启动应用
3. 用“导入模型包”选择刚生成的 zip
4. 确认安装成功
5. 确认可正常预览

---

## 上传位置

应用当前默认会尝试的兼容模型包源是：

- GitHub release 资产

因此你至少需要把同一个 zip 上传到：

1. `v0.1.1` 对应的 GitHub release

建议资产文件名保持一致：

```text
batch-image-studio-model-lama-v1-1.0.0.zip
```

---

## 上传后必须验证

上传后请手动验证：

### GitHub

```bash
curl -I https://github.com/LuoYaoSheng/batch-image-studio/releases/download/v0.1.1/batch-image-studio-model-lama-v1-1.0.0.zip
```

返回不是 `404` 才算可用。

---

## 应用内测试清单

上传 release 资产后，再在应用中测试：

1. 首页点击 `下载并安装`
2. 是否先尝试主源
3. 是否能安装成功
4. 安装成功后是否可立即预览

---

## 常见错误

### 1. 下载 404

原因通常是：

- release 没有上传资产
- tag 名不对
- 文件名不对

### 2. 导入失败：模型包缺少模型文件

原因通常是：

- zip 里放的是 `best.ckpt`
- zip 里目录层级不对
- `manifest.json` 的 `modelFile` 名称不匹配

### 3. 导入失败：模型文件校验失败

原因通常是：

- `sha256` 没更新
- 上传时文件损坏
- zip 里的 `model.onnx` 和 `manifest.json` 对不上

### 4. 导入失败：模型包要求应用版本至少为 X

原因通常是：

- `minAppVersion` 高于当前应用版本

---

## 结论

只有在 release 上真实存在兼容模型包资产时，应用内“下载并安装”才会真正可用。

所以后续你要记住这条顺序：

1. 先生成兼容模型包
2. 先上传到 GitHub release
3. 再让应用走“下载并安装”
