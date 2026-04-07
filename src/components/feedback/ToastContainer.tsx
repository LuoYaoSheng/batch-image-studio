import type { Toast } from "../../types";
import { ToastItem } from "./ToastItem";

interface ToastContainerProps {
  toasts: Toast[];
  onRemoveToast: (id: string) => void;
}

export function ToastContainer({ toasts, onRemoveToast }: ToastContainerProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem
            id={toast.id}
            kind={toast.kind}
            message={toast.message}
            action={toast.action}
            onDismiss={() => onRemoveToast(toast.id)}
            isVisible={true}
          />
        </div>
      ))}
    </div>
  );
}
