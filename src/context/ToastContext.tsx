'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface ToastContextType {
  showToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getTypeMeta = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return { borderColor: 'var(--color-accent-2)', Icon: CheckCircle };
      case 'warning':
        return { borderColor: 'var(--color-accent)', Icon: AlertTriangle };
      case 'error':
        return { borderColor: 'var(--color-accent)', Icon: XCircle };
      default:
        return { borderColor: 'var(--color-neutral-400)', Icon: Info };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => {
          const { borderColor, Icon } = getTypeMeta(toast.type);
          return (
            <div
              key={toast.id}
              className="card elev-md flex-row items-center justify-between gap-4"
              style={{ borderLeft: `4px solid ${borderColor}`, minWidth: 280, maxWidth: 380 }}
            >
              <div className="flex items-center gap-2">
                <Icon size={16} style={{ flexShrink: 0, color: borderColor }} />
                <span className="text-sm font-medium">{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="btn btn-ghost btn-icon"
                style={{ width: 24, height: 24 }}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}