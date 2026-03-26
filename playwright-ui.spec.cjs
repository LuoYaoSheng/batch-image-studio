const { test, expect } = require("playwright/test");

test("screen shell renders and can switch across all pages", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__batchImageStudioStore));

  await page.evaluate((state) => {
    window.__batchImageStudioStore.setState(state);
  }, {
    navigation: { currentScreen: "builder", builderMode: "edit", pendingImportDestination: "builder" },
    currentTemplateId: "tpl-1",
    currentTemplateName: "右下角小字清理",
    isTemplateDirty: true,
    importedImages: [
      {
        id: "img-1",
        path: "/tmp/a.png",
        name: "IMG_0001.png",
        width: 1600,
        height: 900,
        format: "png",
        fileSize: 102400,
        thumbnailDataUrl: dataUrl,
      },
      {
        id: "img-2",
        path: "/tmp/b.png",
        name: "IMG_0002.png",
        width: 1600,
        height: 900,
        format: "png",
        fileSize: 204800,
        thumbnailDataUrl: dataUrl,
      },
    ],
    selectedImageId: "img-1",
    warnings: [],
    region: { x: 0.68, y: 0.76, width: 0.22, height: 0.12 },
    cleanupMethod: "blur",
    sizeHandlingMode: "bottomRight",
    blurSigma: 10,
    fillColor: "#f7f9fc",
    outputDir: "/tmp/output",
    preview: {
      processedImagePath: "",
      processedDisplayDataUrl: dataUrl,
      outputWidth: 1600,
      outputHeight: 900,
      cachedProcessedPath: "/tmp/cache.png",
    },
    templates: [
      {
        id: "tpl-1",
        name: "右下角小字清理",
        region: { x: 0.68, y: 0.76, width: 0.22, height: 0.12 },
        cleanupMethod: "blur",
        sizeHandlingMode: "bottomRight",
        blurSigma: 10,
        fillColor: "#f7f9fc",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        previewImage: dataUrl,
      },
      {
        id: "tpl-2",
        name: "底边小字清理",
        region: { x: 0.3, y: 0.85, width: 0.4, height: 0.08 },
        cleanupMethod: "fill",
        sizeHandlingMode: "relative",
        blurSigma: 8,
        fillColor: "#ffffff",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        previewImage: dataUrl,
      },
    ],
    history: [
      {
        id: "hist-1",
        createdAt: new Date().toISOString(),
        importedCount: 12,
        successCount: 12,
        failedCount: 0,
        outputDir: "/tmp/output",
        cleanupMethod: "blur",
        templateId: "tpl-1",
        templateName: "右下角小字清理",
      },
    ],
    lastBatchResult: {
      outputDir: "/tmp/output",
      processedCount: 12,
      successCount: 10,
      failedCount: 2,
      entries: [
        { sourcePath: "/tmp/a.png", outputPath: "/tmp/output/a.png", success: true },
        { sourcePath: "/tmp/b.png", outputPath: "/tmp/output/b.png", success: false, error: "模拟失败：读取原图异常" },
      ],
    },
  });

  await expect(page.getByText("模板构建", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "首页" }).click();
  await expect(page.getByText("最近模板", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "效果预览" }).click();
  await expect(page.getByText("模板名称", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "批量执行" }).click();
  await expect(page.getByText("结果摘要", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "模板中心" }).click();
  await expect(page.getByText("搜索模板", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "历史记录" }).click();
  await expect(page.getByText("任务时间", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByText("默认处理方式", { exact: true }).first()).toBeVisible();
});

test("browser preview guards tauri-only actions with notifications", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__batchImageStudioStore));

  await page.evaluate((state) => {
    window.__batchImageStudioStore.setState(state);
  }, {
    navigation: { currentScreen: "preview", builderMode: "edit", pendingImportDestination: "builder" },
    currentTemplateName: "右下角小字清理",
    importedImages: [
      {
        id: "img-1",
        path: "/tmp/a.png",
        name: "IMG_0001.png",
        width: 1600,
        height: 900,
        format: "png",
        fileSize: 102400,
        thumbnailDataUrl: dataUrl,
      },
    ],
    selectedImageId: "img-1",
    region: { x: 0.68, y: 0.76, width: 0.22, height: 0.12 },
    cleanupMethod: "blur",
    sizeHandlingMode: "bottomRight",
    blurSigma: 10,
    fillColor: "#f7f9fc",
    preview: {
      processedImagePath: "",
      processedDisplayDataUrl: dataUrl,
      outputWidth: 1600,
      outputHeight: 900,
      cachedProcessedPath: "/tmp/cache.png",
    },
  });

  await page.getByRole("button", { name: "重新预览" }).click();
  await expect(page.getByText("浏览器预览环境不支持真实预览计算，请在 Tauri 桌面环境中验证。")).toBeVisible();

  await page.getByRole("button", { name: "开始批量处理" }).click();
  await expect(page.getByText("浏览器预览环境不支持真实批量执行，请在 Tauri 桌面环境中验证。")).toBeVisible();
});
