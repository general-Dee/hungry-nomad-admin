'use client';

import { ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export default function Dialog({ open, onClose, title, children, className }: DialogProps) {
  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      onClick={onClose}
    >
      <div
        className={`dialog${className ? ` ${className}` : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
