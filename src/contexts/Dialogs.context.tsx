import React, { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { AlertColor } from "@/components/ui";
import AlertDialog from "../components/AlertDialog";
import ConfirmDialog from "../components/ConfirmDialog";

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  severity?: AlertColor;
  ok?: string;
  onConfirm: () => void;
}

interface DialogsContextValue {
  showAlert: (title: string, message: ReactNode, severity?: AlertColor) => void;
  showError: (title: string, message: ReactNode) => void;
  showConfirm: (opts: ConfirmOptions) => void;
}

const DialogsContext = createContext<DialogsContextValue | undefined>(undefined);

export const useDialogs = () => {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error("useDialogs must be used within DialogsProvider");
  return ctx;
};

export const DialogsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<{ title: string; message: ReactNode; severity: AlertColor } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);

  const showAlert = useCallback((title: string, message: ReactNode, severity: AlertColor = "info") => {
    setAlert({ title, message, severity });
  }, []);

  const showError = useCallback((title: string, message: ReactNode) => {
    setAlert({ severity: "error", title, message });
  }, []);

  const showConfirm = useCallback((opts: ConfirmOptions) => {
    setConfirm(opts);
  }, []);

  return (
    <DialogsContext.Provider value={{ showAlert, showError, showConfirm }}>
      {children}
      <AlertDialog open={alert !== null} onClose={() => setAlert(null)} severity={alert?.severity} title={alert?.title}>
        {alert?.message}
      </AlertDialog>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ""}
        severity={confirm?.severity}
        ok={confirm?.ok}
        onConfirm={confirm?.onConfirm ?? (() => {})}
      >
        {confirm?.message}
      </ConfirmDialog>
    </DialogsContext.Provider>
  );
};
