import React from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface Props {
  isOpen: boolean;
  title?: string;
  message: string;
  cancelText: string;
  confirmText: string;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** A yes/no question over the shared Modal (used for irreversible steps such as final submission). */
export const ConfirmDialog: React.FC<Props> = ({ isOpen, title, message, cancelText, confirmText, isPending = false, onCancel, onConfirm }) => (
  <Modal isOpen={isOpen} onClose={() => !isPending && onCancel()} title={title} maxWidth="sm">
    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
    <div className="flex items-center justify-end gap-3 pt-2">
      <Button variant="outline" size="md" disabled={isPending} onClick={onCancel}>{cancelText}</Button>
      <Button variant="primary" size="md" isLoading={isPending} onClick={onConfirm}>{confirmText}</Button>
    </div>
  </Modal>
);
