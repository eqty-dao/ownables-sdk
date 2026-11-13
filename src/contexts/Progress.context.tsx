import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { LogProgress as CoreLogProgress } from '@ownables/core';
import {
  Button,
  Dialog,
  DialogActions, DialogClose,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@/components/ui';
import { CircleCheck, AlertCircle, Circle, LoaderCircle } from "lucide-react";
import { cn } from "@/utils/cn"

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

/**
 * The callback exposed by @ownables/core. Core calls it once after a known
 * step completes and does not report a lifecycle state.
 */
export type LogProgress = CoreLogProgress;

type StepLogProgress = (stepId: string, state: 'active' | 'done' | 'error', meta?: unknown) => void;

export interface ProgressContextValue {
  open: (opts: OpenProgressOptions) => [ProgressController, LogProgress];
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
  const currentSessionId = useRef<number | undefined>(undefined);
  const nextSessionId = useRef(0);

  const isCurrentSession = useCallback((sessionId: number) => currentSessionId.current === sessionId, []);

  const closeSession = useCallback((sessionId: number) => {
    if (!isCurrentSession(sessionId)) return;

    currentSessionId.current = undefined;
    setVisible(false);
    setTitle('');
    setSteps([]);
    setCancelLabel(undefined);
    setOnCancel(undefined);
  }, [isCurrentSession]);

  const open = useCallback((opts: OpenProgressOptions): [ProgressController, LogProgress] => {
    const indexMap: Record<string, number> = Object.fromEntries(opts.steps.map((step, i) => [step.id, i]));
    const sessionId = ++nextSessionId.current;
    currentSessionId.current = sessionId;

    const updateSteps = (update: (current: ProgressStep[]) => ProgressStep[]) => {
      if (!isCurrentSession(sessionId)) return;
      setSteps((current) => isCurrentSession(sessionId) ? update(current) : current);
    };

    const controller: ProgressController = {
      setActive: (index) => updateSteps((current) => current.map((step, currentIndex) => ({
        ...step,
        status: currentIndex === index
          ? 'active'
          : (step.status === 'done' || step.status === 'error' ? step.status : 'pending'),
      }))),
      setDone: (index) => updateSteps((current) => current.map((step, currentIndex) => (
        currentIndex === index ? { ...step, status: 'done' } : step
      ))),
      setError: (index, message) => updateSteps((current) => current.map((step, currentIndex) => (
        currentIndex === index ? { ...step, status: 'error', errorMessage: message } : step
      ))),
      updateStep: (index, patch) => updateSteps((current) => current.map((step, currentIndex) => (
        currentIndex === index ? { ...step, ...patch } : step
      ))),
      close: () => closeSession(sessionId),
    };

    const onProgress: LogProgress = (stepId) => {
      const idx = indexMap[stepId];
      if (idx === undefined || !isCurrentSession(sessionId)) return;

      updateSteps((current) => {
        if (current[idx]?.status === 'done') return current;

        const nextPendingIndex = current.findIndex((step, currentIndex) => (
          currentIndex > idx && step.status === 'pending'
        ));

        return current.map((step, currentIndex) => {
          if (currentIndex === idx) return { ...step, status: 'done' };
          if (currentIndex === nextPendingIndex) return { ...step, status: 'active' };
          return step;
        });
      });
    };

    setTitle(opts.title);
    setSteps(opts.steps.map((s, i) => ({ id: s.id, label: s.label, status: i === 0 ? 'active' : 'pending' })));
    setCancelLabel(opts.cancelLabel);
    setOnCancel(() => opts.onCancel);
    setVisible(true);

    return [controller, onProgress];
  }, [closeSession, isCurrentSession]);

  const value = useMemo(() => ({ open }), [open]);

  const isBusy = useMemo(() => steps.some((s) => s.status === 'active'), [steps]);

  return (
    <ProgressContext.Provider value={value}>
      {children}
      <ProgressModal
        title={title}
        steps={steps}
        open={visible}
        onClose={() => {
          if (currentSessionId.current !== undefined) closeSession(currentSessionId.current);
        }}
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        isBusy={isBusy}
      />
    </ProgressContext.Provider>
  );
};

export function withProgress(log?: StepLogProgress) {
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

const ProgressModal: React.FC<{
  title: string;
  steps: ProgressStep[];
  open: boolean;
  onClose: () => void;
  cancelLabel?: string;
  onCancel?: () => void;
  isBusy?: boolean;
}> = ({ title, steps, open, onClose, cancelLabel, onCancel, isBusy }) => {
  return (
    <Dialog
      open={open}
      onClose={isBusy ? undefined : onClose}
      aria-labelledby="progress-dialog-title"
      className="sm:w-[min(420px,calc(100vw-32px))]"
    >
      <div className="flex items-center justify-between">
        <DialogTitle id="progress-dialog-title">{title}</DialogTitle>
        { !isBusy && <DialogClose className="mr-6 mt-6" /> }
      </div>

      <DialogContent>
        <List>
          {steps.map((step) => (
            <ListItem key={step.id} data-progress-step={step.id} data-progress-status={step.status ?? 'pending'}>
              <ListItemIcon style={{ minWidth: 36 }}>
                {step.status === "active" && <LoaderCircle className="animate-spin inline" />}
                {step.status === "done" && <CircleCheck className="text-green-600 inline" />}
                {step.status === "error" && <AlertCircle className="text-red-600 inline" />}
                {(!step.status || step.status === "pending") && <Circle className="text-slate-400 inline" />}
              </ListItemIcon>
              <ListItemText
                className={cn(step.status === "error" && "text-red-600")}
                primary={<span className={cn(step.status === "active" && "font-bold")}>{step.label}</span>}
                secondary={step.status === "error" && step.errorMessage}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      {(cancelLabel || onCancel) && (
        <DialogActions>
          <Button onClick={onCancel} disabled={isBusy}>
            {cancelLabel || "Cancel"}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
