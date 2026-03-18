import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography
} from '@/components/ui';
import { CircleCheck as CheckCircleOutlineIcon, AlertCircle as ErrorOutlineIcon, Circle as RadioButtonUncheckedIcon } from "lucide-react";
import { CircularProgress } from "@/components/ui";

export type ProgressStepStatus = 'pending' | 'active' | 'done' | 'error';

export interface ProgressStep {
  id: string;
  label: string;
  status?: ProgressStepStatus;
  errorMessage?: string;
}

export interface OpenProgressOptions {
  title: string;
  steps: Array<Pick<ProgressStep, 'id' | 'label'>>;
  cancelLabel?: string;
  onCancel?: () => void;
}

export interface ProgressController {
  setActive: (index: number) => void;
  setDone: (index: number) => void;
  setError: (index: number, message?: string) => void;
  updateStep: (index: number, patch: Partial<ProgressStep>) => void;
  close: () => void;
}

export type LogProgress = (stepId: string, state: 'active' | 'done' | 'error', meta?: any) => void;

interface ProgressContextValue {
  open: (opts: OpenProgressOptions) => [ProgressController, LogProgress];
  close: () => void;
}

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

export const useProgress = () => {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
};

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState<string>('');
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [cancelLabel, setCancelLabel] = useState<string | undefined>(undefined);
  const [onCancel, setOnCancel] = useState<(() => void) | undefined>(undefined);

  const close = useCallback(() => {
    setVisible(false);
    setTitle('');
    setSteps([]);
    setCancelLabel(undefined);
    setOnCancel(undefined);
  }, []);

  const controller = useMemo<ProgressController>(() => ({
    setActive: (index) => setSteps((prev) => prev.map((s, i) => ({ ...s, status: i === index ? 'active' : (s.status === 'done' ? 'done' : (s.status === 'error' ? 'error' : 'pending')) }))),
    setDone: (index) => setSteps((prev) => prev.map((s, i) => i === index ? { ...s, status: 'done' } : s)),
    setError: (index, message) => setSteps((prev) => prev.map((s, i) => i === index ? { ...s, status: 'error', errorMessage: message } : s)),
    updateStep: (index, patch) => setSteps((prev) => prev.map((s, i) => i === index ? { ...s, ...patch } : s)),
    close,
  }), [close]);

  const open = useCallback((opts: OpenProgressOptions): [ProgressController, LogProgress] => {
    const indexMap: Record<string, number> = Object.fromEntries(opts.steps.map((step, i) => [step.id, i]));

    const onProgress = (stepId: string, state: 'active' | 'done' | 'error') => {
      const idx = indexMap[stepId];
      if (idx === undefined || !controller) return;
      if (state === 'active') controller.setActive(idx);
      if (state === 'done') controller.setDone(idx);
      if (state === 'error') controller.setError(idx, 'Step failed');
    };

    setTitle(opts.title);
    setSteps(opts.steps.map((s, i) => ({ id: s.id, label: s.label, status: i === 0 ? 'active' : 'pending' })));
    setCancelLabel(opts.cancelLabel);
    setOnCancel(() => opts.onCancel);
    setVisible(true);

    return [controller, onProgress];
  }, [controller]);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <ProgressContext.Provider value={value}>
      {children}
      <ProgressModal title={title} steps={steps} open={visible} onClose={close} cancelLabel={cancelLabel} onCancel={onCancel} />
    </ProgressContext.Provider>
  );
};

export function withProgress(log?: LogProgress) {
  return async <T extends any>(stepId: string, callback: () => T | Promise<T>, metaFn?: (res: T) => any): Promise<T> => {
    if (!log) {
      return callback();
    }

    log(stepId, 'active');

    try {
      const ret = await callback();

      const meta = metaFn?.(ret);
      log(stepId, 'done', meta);

      return ret;
    } catch (err) {
      log(stepId, 'error', err);
      throw err;
    }
  }
}

const ProgressModal: React.FC<{ title: string; steps: ProgressStep[]; open: boolean; onClose: () => void; cancelLabel?: string; onCancel?: () => void; }> = ({ title, steps, open, onClose, cancelLabel, onCancel }) => {
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="progress-dialog-title" className="w-[min(420px,calc(100vw-32px))]">
      <DialogTitle id="progress-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <List>
          {steps.map((step) => (
            <ListItem key={step.id} disableGutters>
              <ListItemIcon style={{ minWidth: 36 }}>
                {step.status === 'active' && <CircularProgress size={20} />}
                {step.status === 'done' && <CheckCircleOutlineIcon />}
                {step.status === 'error' && <ErrorOutlineIcon className="text-red-600" />}
                {(!step.status || step.status === 'pending') && <RadioButtonUncheckedIcon className="text-slate-400" />}
              </ListItemIcon>
              <ListItemText
                primary={<span style={{ fontWeight: step.status === 'active' ? 600 : 400 }}>{step.label}</span>}
                secondary={step.status === 'error' && step.errorMessage ? (
                  <Typography className="text-red-600">{step.errorMessage}</Typography>
                ) : undefined}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      {(cancelLabel || onCancel) && (
        <DialogActions>
          <Button onClick={onCancel}>{cancelLabel || 'Cancel'}</Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
