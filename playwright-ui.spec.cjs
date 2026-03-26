const { test, expect } = require("playwright/test");

async function seedStore(page, state) {
  await page.waitForFunction(() => Boolean(window.__batchImageStudioStore));
  await page.evaluate((nextState) => {
    window.__batchImageStudioStore.setState(nextState);
  }, state);
}

test("screen shell renders and can switch across all pages", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
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

  await page.getByRole("button", { name: "首页" }).click();
  await page.getByRole("button", { name: "清空并返回首页" }).click();
  await expect(page.getByText("最近模板", { exact: true }).first()).toBeVisible();
});

test("browser preview guards tauri-only actions with notifications", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
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

test("template deletion updates template center list", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "templates", builderMode: "edit", pendingImportDestination: "builder" },
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
  });

  await expect(page.getByText("右下角小字清理")).toBeVisible();
  await page.getByRole("button", { name: "删除" }).first().click();
  await expect(page.getByText("模板已删除。")).toBeVisible();
  await expect(page.getByText("右下角小字清理")).toHaveCount(0);
  await expect(page.getByText("底边小字清理")).toBeVisible();
});

test("settings changes persist after reload", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "settings", builderMode: "new", pendingImportDestination: "builder" },
    appSettings: {
      defaultOutputDir: "/tmp/output",
      defaultFormat: "png",
      defaultCleanupMethod: "blur",
      defaultSizeHandlingMode: "bottomRight",
    },
  });

  await page.locator('select').nth(0).selectOption("fill");
  await page.locator('select').nth(1).selectOption("relative");
  await page.locator('select').nth(2).selectOption("jpg");
  await page.locator('input').nth(0).fill("/tmp/next-output");

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "设置" }).click();

  await expect(page.locator('select').nth(0)).toHaveValue("fill");
  await expect(page.locator('select').nth(1)).toHaveValue("relative");
  await expect(page.locator('select').nth(2)).toHaveValue("jpg");
  await expect(page.locator('input').nth(0)).toHaveValue("/tmp/next-output");
});

test("builder save template persists into template center after reload", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "builder", builderMode: "new", pendingImportDestination: "builder" },
    currentTemplateName: "新保存模板",
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
  });

  await page.getByRole("button", { name: "保存模板" }).click();
  await expect(page.getByText("模板已保存：新保存模板")).toBeVisible();

  await page.getByRole("button", { name: "模板中心" }).click();
  await expect(page.getByText("新保存模板", { exact: true })).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /模板中心/ }).first().click();
  await expect(page.getByText("新保存模板", { exact: true })).toBeVisible();
});

test("template edit action loads template into builder screen", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "templates", builderMode: "new", pendingImportDestination: "builder" },
    templates: [
      {
        id: "tpl-1",
        name: "右下角小字清理",
        region: { x: 0.68, y: 0.76, width: 0.22, height: 0.12 },
        cleanupMethod: "fill",
        sizeHandlingMode: "relative",
        blurSigma: 8,
        fillColor: "#ffffff",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        previewImage: dataUrl,
      },
    ],
  });

  await page.getByRole("button", { name: "编辑" }).click();
  await expect(page.getByText("模板构建", { exact: true }).first()).toBeVisible();
  await expect(page.locator('input[placeholder="例如：右下角小字清理"]')).toHaveValue("右下角小字清理");
  await page.waitForFunction(() => {
    const state = window.__batchImageStudioStore.getState();
    return state.sizeHandlingMode === "relative" && state.cleanupMethod === "fill";
  });
});

test("batch open output directory action is guarded in browser preview", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "batch", builderMode: "edit", pendingImportDestination: "builder" },
    lastBatchResult: {
      outputDir: "/tmp/output",
      processedCount: 12,
      successCount: 10,
      failedCount: 2,
      entries: [],
    },
  });

  await page.getByRole("main").getByRole("button", { name: "打开输出目录" }).click();
  await expect(page.getByText("浏览器预览环境不支持打开系统文件管理器，请在 Tauri 桌面环境中验证。")).toBeVisible();
});

test("history open directory action is guarded in browser preview", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "history", builderMode: "edit", pendingImportDestination: "builder" },
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
  });

  await page.getByRole("button", { name: "打开目录" }).click();
  await expect(page.getByText("浏览器预览环境不支持打开系统文件管理器，请在 Tauri 桌面环境中验证。")).toBeVisible();
});

test("home applying template routes to builder instead of immediate file import", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "home", builderMode: "new", pendingImportDestination: "builder" },
    templates: [
      {
        id: "tpl-1",
        name: "右下角小字清理",
        region: { x: 0.68, y: 0.76, width: 0.22, height: 0.12 },
        cleanupMethod: "fill",
        sizeHandlingMode: "relative",
        blurSigma: 8,
        fillColor: "#ffffff",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        previewImage: dataUrl,
      },
    ],
  });

  await page.getByRole("button", { name: "右下角小字清理" }).first().click();
  await expect(page.getByText("模板已应用，现在可以导入图片或调整参数。")).toBeVisible();
  await expect(page.getByText("模板构建", { exact: true }).first()).toBeVisible();
});

test("builder clear task uses confirm dialog and returns home", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "builder", builderMode: "edit", pendingImportDestination: "builder" },
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
    currentTemplateName: "测试模板",
    isTemplateDirty: true,
    region: { x: 0.68, y: 0.76, width: 0.22, height: 0.12 },
    cleanupMethod: "blur",
    sizeHandlingMode: "bottomRight",
  });

  await page.getByRole("button", { name: "清空当前任务" }).click();
  await expect(page.getByText("清空当前任务？")).toBeVisible();
  await page.getByRole("button", { name: "清空并返回首页" }).click();
  await expect(page.getByText("最近模板", { exact: true }).first()).toBeVisible();
});

test("builder navigation to home is guarded when task is dirty", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "builder", builderMode: "edit", pendingImportDestination: "builder" },
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
    currentTemplateName: "测试模板",
    isTemplateDirty: true,
  });

  await page.getByRole("button", { name: "首页" }).click();
  await expect(page.getByText("离开当前任务？")).toBeVisible();
  await page.getByRole("button", { name: "继续编辑" }).click();
  await expect(page.getByText("模板构建", { exact: true }).first()).toBeVisible();
});

test("template switching during active task shows decision dialog", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "templates", builderMode: "edit", pendingImportDestination: "builder" },
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
    currentTemplateId: "tpl-current",
    currentTemplateName: "旧模板",
    isTemplateDirty: true,
    templates: [
      {
        id: "tpl-1",
        name: "右下角小字清理",
        region: { x: 0.68, y: 0.76, width: 0.22, height: 0.12 },
        cleanupMethod: "fill",
        sizeHandlingMode: "relative",
        blurSigma: 8,
        fillColor: "#ffffff",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        previewImage: dataUrl,
      },
    ],
  });

  await page.getByRole("button", { name: "应用模板" }).click();
  await expect(page.getByText("应用新模板到当前任务？")).toBeVisible();
  await page.getByRole("button", { name: "应用到当前图片" }).click();
  await expect(page.getByText("已应用新模板，请重新预览效果。")).toBeVisible();
  await expect(page.getByText("模板构建", { exact: true }).first()).toBeVisible();
});

test("builder quick import buttons are guarded in browser preview", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "builder", builderMode: "new", pendingImportDestination: "builder" },
  });

  await page.getByRole("button", { name: "导入图片" }).click();
  await expect(page.getByText("浏览器预览环境不支持系统文件对话框，请在 Tauri 桌面环境中验证导入流程。")).toBeVisible();
});

test("preview discard action clears preview and returns to builder", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "preview", builderMode: "edit", pendingImportDestination: "builder" },
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
    currentTemplateName: "右下角小字清理",
    preview: {
      processedImagePath: "",
      processedDisplayDataUrl: dataUrl,
      outputWidth: 1600,
      outputHeight: 900,
      cachedProcessedPath: "/tmp/cache.png",
    },
  });

  await page.getByRole("button", { name: "放弃当前预览" }).click();
  await expect(page.getByText("放弃当前预览？")).toBeVisible();
  await page.getByRole("button", { name: "放弃预览" }).click();
  await expect(page.getByText("已放弃当前预览，模板配置和图片仍然保留。")).toBeVisible();
  await expect(page.getByText("模板构建", { exact: true }).first()).toBeVisible();
});

test("removing last image confirms and returns home", async ({ page }) => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await seedStore(page, {
    navigation: { currentScreen: "builder", builderMode: "edit", pendingImportDestination: "builder" },
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
    currentTemplateName: "测试模板",
    isTemplateDirty: true,
  });

  await page.getByRole("button", { name: "移除当前图片" }).click();
  await expect(page.getByText("移除最后一张图片？")).toBeVisible();
  await page.getByRole("button", { name: "移除并返回首页" }).click();
  await expect(page.getByText("最近模板", { exact: true }).first()).toBeVisible();
});
