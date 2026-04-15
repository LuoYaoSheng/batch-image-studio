import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { WorkflowStep, ImportedImage, PreviewTaskEvent, BatchResult, BatchProgressEvent, CleanupMethod, SizeHandlingMode, Region } from "../types";
import { IdleDropZone } from "./IdleDropZone";
import { TemplateBuilderScreen } from "./TemplateBuilderScreen";
import { PreviewScreen } from "./PreviewScreen";
import { BatchScreen } from "./BatchScreen";

type PreviewTaskState = {
  taskId: string;
  stage: PreviewTaskEvent["stage"];
  message: string;
};

export type WorkspaceScreenProps = {
  workflowStep: WorkflowStep;

  // IdleDropZone props
  templates: Parameters<typeof IdleDropZone>[0]["templates"];
  history: Parameters<typeof IdleDropZone>[0]["history"];
  isImporting: boolean;
  hasCheckedModelStatus: boolean;
  isModelAvailable: boolean;
  isModelLoaded: boolean;
  isModelLoading: boolean;
  isModelFailed: boolean;
  preferredModelSource: "local" | "bundled" | null;
  modelLoadProgress: number;

  // Common props for builder/preview/batch
  importedImages: ImportedImage[];
  selectedImage: ImportedImage | null;
  selectedImageId: string | null;
  previewTaskStateByImageId: Record<string, PreviewTaskState | undefined>;
  region: Region;
  cleanupMethod: CleanupMethod;
  sizeHandlingMode: SizeHandlingMode;
  blurSigma: number;
  fillColor: string;
  outputDir: string;
  currentTemplateName: string;
  isTemplateDirty: boolean;
  hasRegionSelection: boolean;
  preview: { processedImagePath: string; processedDisplayDataUrl: string } | null;
  isSelectedImageBusy: boolean;
  canSaveTemplate: boolean;
  canOpenPreview: boolean;
  builderNextActionHint: string;
  previewStatus: string;
  previewCanStartBatch: boolean;
  previewBatchReadyHint: string;
  batchProgress: BatchProgressEvent | null;
  batchStartedAt: number | null;
  lastBatchResult: BatchResult | null;
  isBatchRunning: boolean;

  // Callbacks
  onImportFiles: () => void;
  onImportFolder: () => void;
  onUseTemplate: (id: string) => void;
  onOpenTemplates: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenModelDir: () => void;
  onDownloadModel: () => void;
  onImportModelPackage: () => void;
  onOpenOfficialModelInfo: () => void;
  onRetryModelLoad?: () => void;
  onSelectImage: (id: string) => void;
  onUpdateRegion: (patch: Partial<Region>) => void;
  onSetCleanupMethod: (method: CleanupMethod) => void;
  onSetSizeHandlingMode: (mode: SizeHandlingMode) => void;
  onSetBlurSigma: (sigma: number) => void;
  onSetFillColor: (color: string) => void;
  onSetOutputDir: (path: string) => void;
  onChooseOutputDir: () => void;
  onSetCurrentTemplateName: (name: string) => void;
  onResetRegion: () => void;
  onClearRegionSelection: () => void;
  onResetCurrentRegionSettings: () => void;
  onClearWorkspace: () => void;
  onRemoveSelectedImage: () => void;
  onRemoveImage: (id: string) => void;
  onSaveTemplate: () => void;
  onOpenPreview: () => void;
  onStartBatch: () => void;
  onBackToBuilder: () => void;
  onBackHome: () => void;
  onRetryFailedOnly: () => void;
  onOpenOutputDir: () => void;
  onCancelBatch: () => void;
  onSwitchTemplate: () => void;
  onPreviewSelectImage: (id: string) => void;
};

// 步骤渲染组件：带有淡入淡出动画
function StepContent({
  step,
  isVisible,
  children,
}: {
  step: string;
  isVisible: boolean;
  children: React.ReactNode;
}) {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      // 下一帧触发动画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimating(true);
        });
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div
      key={step}
      className={`transition-all duration-300 ease-in-out ${
        animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      {children}
    </div>
  );
}

export function WorkspaceScreen(props: WorkspaceScreenProps) {
  const { workflowStep } = props;
  const prevStepRef = useRef<WorkflowStep>(workflowStep);

  const processedPreviewSrc = props.preview?.processedImagePath ?? null;
  const processedPreviewDisplaySrc = props.preview?.processedDisplayDataUrl ?? processedPreviewSrc;

  useEffect(() => {
    prevStepRef.current = workflowStep;
  }, [workflowStep]);

  const renderIdle = () => (
    <IdleDropZone
      templates={props.templates}
      history={props.history}
      isImporting={props.isImporting}
      hasCheckedModelStatus={props.hasCheckedModelStatus}
      isModelAvailable={props.isModelAvailable}
      isModelLoaded={props.isModelLoaded}
      isModelLoading={props.isModelLoading}
      isModelFailed={props.isModelFailed}
      preferredModelSource={props.preferredModelSource}
      modelLoadProgress={props.modelLoadProgress}
      onImportFiles={props.onImportFiles}
      onImportFolder={props.onImportFolder}
      onUseTemplate={props.onUseTemplate}
      onOpenTemplates={props.onOpenTemplates}
      onOpenHistory={props.onOpenHistory}
      onOpenModelDir={props.onOpenModelDir}
      onDownloadModel={props.onDownloadModel}
      onImportModelPackage={props.onImportModelPackage}
      onOpenOfficialModelInfo={props.onOpenOfficialModelInfo}
      onRetryModelLoad={props.onRetryModelLoad}
      onOpenSettings={props.onOpenSettings}
    />
  );

  const renderSelect = () => (
    <TemplateBuilderScreen
      importedImages={props.importedImages}
      selectedImage={props.selectedImage}
      selectedImageId={props.selectedImageId}
      previewTaskStateByImageId={props.previewTaskStateByImageId}
      region={props.region}
      cleanupMethod={props.cleanupMethod}
      sizeHandlingMode={props.sizeHandlingMode}
      blurSigma={props.blurSigma}
      fillColor={props.fillColor}
      outputDir={props.outputDir}
      currentTemplateName={props.currentTemplateName}
      isTemplateDirty={props.isTemplateDirty}
      hasRegionSelection={props.hasRegionSelection}
      previewReady={Boolean(props.preview)}
      isPreviewBusy={props.isSelectedImageBusy}
      canSaveTemplate={props.canSaveTemplate}
      canOpenPreview={props.canOpenPreview}
      nextActionLabel={props.preview ? "查看预览" : "生成预览"}
      nextActionHint={props.builderNextActionHint}
      onSelectImage={props.onSelectImage}
      onUpdateRegion={props.onUpdateRegion}
      onSetCleanupMethod={props.onSetCleanupMethod}
      onSetSizeHandlingMode={props.onSetSizeHandlingMode}
      onSetBlurSigma={props.onSetBlurSigma}
      onSetFillColor={props.onSetFillColor}
      onSetOutputDir={props.onSetOutputDir}
      onChooseOutputDir={props.onChooseOutputDir}
      onSetCurrentTemplateName={props.onSetCurrentTemplateName}
      onResetRegion={props.onResetRegion}
      onClearRegionSelection={props.onClearRegionSelection}
      onResetCurrentRegionSettings={props.onResetCurrentRegionSettings}
      onImportFiles={props.onImportFiles}
      onImportFolder={props.onImportFolder}
      onClearWorkspace={props.onClearWorkspace}
      onRemoveSelectedImage={props.onRemoveSelectedImage}
      onRemoveImage={props.onRemoveImage}
      onOpenTemplates={props.onOpenTemplates}
      onSaveTemplate={props.onSaveTemplate}
      onOpenPreview={props.onOpenPreview}
    />
  );

  const renderPreview = () => (
    <PreviewScreen
      importedImages={props.importedImages}
      selectedImageId={props.selectedImageId}
      selectedImage={props.selectedImage}
      previewTaskStateByImageId={props.previewTaskStateByImageId}
      beforeSrc={props.selectedImage?.thumbnailDataUrl ?? null}
      afterSrc={processedPreviewDisplaySrc}
      currentTemplateName={props.currentTemplateName}
      cleanupMethod={props.cleanupMethod}
      sizeHandlingMode={props.sizeHandlingMode}
      previewStatus={props.previewStatus}
      loadingMessage={props.previewTaskStateByImageId[props.selectedImageId ?? ""]?.message}
      isPreviewLoading={props.isSelectedImageBusy}
      canStartBatch={props.previewCanStartBatch}
      batchReadyHint={props.previewBatchReadyHint}
      onSelectImage={props.onPreviewSelectImage}
      onOpenTemplates={props.onSwitchTemplate}
      onStartBatch={props.onStartBatch}
      onBackToBuilder={props.onBackToBuilder}
    />
  );

  const renderProcess = () => (
    <BatchScreen
      importedImages={props.importedImages}
      progress={props.batchProgress}
      startedAt={props.batchStartedAt}
      result={props.lastBatchResult}
      isBatchRunning={props.isBatchRunning}
      onRetryFailedOnly={props.onRetryFailedOnly}
      onBackHome={props.onBackHome}
      onOpenOutputDir={props.onOpenOutputDir}
      onCancelBatch={props.onCancelBatch}
      onSwitchTemplate={props.onSwitchTemplate}
    />
  );

  return (
    <div className="relative">
      <StepContent step="idle" isVisible={workflowStep === "idle"}>
        {renderIdle()}
      </StepContent>
      <StepContent step="select" isVisible={workflowStep === "select"}>
        {renderSelect()}
      </StepContent>
      <StepContent step="preview" isVisible={workflowStep === "preview"}>
        {renderPreview()}
      </StepContent>
      <StepContent step="process" isVisible={workflowStep === "process"}>
        {renderProcess()}
      </StepContent>
    </div>
  );
}
