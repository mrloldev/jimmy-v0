"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const MODELS = [
  { id: "llama3.1-8b", label: "Llama 3.1 8B" },
  { id: "llama3.1-70b", label: "Llama 3.1 70B" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

const STORAGE_KEY = "jimmy-model";
const COT_STORAGE_KEY = "jimmy-use-cot";
const DEFAULT_MODEL: ModelId = "llama3.1-70b";

interface ModelContextType {
  model: ModelId;
  setModel: (model: ModelId) => void;
  useCoT: boolean;
  setUseCoT: (value: boolean) => void;
}

const ModelContext = createContext<ModelContextType | null>(null);

export function useModel(): ModelContextType {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error("useModel must be used within a <ModelProvider />");
  }
  return context;
}

interface ModelProviderProps {
  readonly children: ReactNode;
}

export function ModelProvider({ children }: ModelProviderProps) {
  const [model, setModelState] = useState<ModelId>(DEFAULT_MODEL);
  const [useCoT, setUseCoTState] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && MODELS.some((m) => m.id === stored)) {
        setModelState(stored as ModelId);
      }
      const cotStored = localStorage.getItem(COT_STORAGE_KEY);
      if (cotStored === "false") setUseCoTState(false);
    } catch {
      // ignore
    }
  }, []);

  const setModel = useCallback((value: ModelId) => {
    setModelState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
  }, []);

  const setUseCoT = useCallback((value: boolean) => {
    setUseCoTState(value);
    try {
      localStorage.setItem(COT_STORAGE_KEY, value ? "true" : "false");
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ model, setModel, useCoT, setUseCoT }),
    [model, setModel, useCoT, setUseCoT],
  );

  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
}
