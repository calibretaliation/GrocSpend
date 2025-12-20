import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ReceiptItem, ReceiptPreset } from "../types";
import { useAuth } from "./AuthContext";

interface ReceiptPresetsContextValue {
  presets: ReceiptPreset[];
  addPreset: (preset: Omit<ReceiptPreset, "id">) => ReceiptPreset;
  removePreset: (id: string) => void;
  updatePreset: (preset: ReceiptPreset) => void;
}

const ReceiptPresetsContext =
  createContext<ReceiptPresetsContextValue | undefined>(undefined);

const STORAGE_PREFIX = "smart_spend_presets";

const isBrowser = typeof window !== "undefined";

const buildStorageKey = (userId: string) => `${STORAGE_PREFIX}_${userId}`;

const ensureItemIds = (items: ReceiptItem[]): ReceiptItem[] =>
  items.map((item, index) => {
    const fallbackId = `${Date.now()}-${index}`;
    return {
      ...item,
      id:
        item.id ||
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : fallbackId),
      tags: Array.isArray(item.tags) ? item.tags : [],
    };
  });

const normalizePreset = (preset: ReceiptPreset): ReceiptPreset => {
  const note = preset.notes?.trim();
  return {
    ...preset,
    totalAmount: Number.isFinite(preset.totalAmount)
      ? preset.totalAmount
      : Number(preset.totalAmount) || 0,
    tags: Array.isArray(preset.tags) ? preset.tags : [],
    items: ensureItemIds(preset.items),
    notes: note && note.length ? note : undefined,
  };
};

const readStoredPresets = (userId: string): ReceiptPreset[] => {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(buildStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReceiptPreset[];
    return parsed.map((preset) => normalizePreset(preset));
  } catch (error) {
    console.warn("Failed to parse stored receipt presets", error);
    return [];
  }
};

const persistPresets = (userId: string, presets: ReceiptPreset[]) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(
      buildStorageKey(userId),
      JSON.stringify(presets)
    );
  } catch (error) {
    console.warn("Failed to persist receipt presets", error);
  }
};

export const ReceiptPresetsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [presets, setPresets] = useState<ReceiptPreset[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setPresets([]);
      return;
    }
    setPresets(readStoredPresets(user.id));
  }, [user?.id]);

  const updatePresets = useCallback(
    (updater: (current: ReceiptPreset[]) => ReceiptPreset[]) => {
      setPresets((current) => {
        const next = updater(current);
        if (user?.id) {
          persistPresets(user.id, next);
        }
        return next;
      });
    },
    [user?.id]
  );

  const addPreset = useCallback(
    (preset: Omit<ReceiptPreset, "id">) => {
      if (!user?.id) {
        throw new Error("Cannot add preset without an authenticated user");
      }

      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const normalized = normalizePreset({ ...preset, id });

      updatePresets((current) => [...current, normalized]);
      return normalized;
    },
    [updatePresets, user?.id]
  );

  const removePreset = useCallback(
    (id: string) => {
      if (!user?.id) return;
      updatePresets((current) => current.filter((preset) => preset.id !== id));
    },
    [updatePresets, user?.id]
  );

  const updatePreset = useCallback(
    (preset: ReceiptPreset) => {
      if (!user?.id) {
        throw new Error("Cannot update preset without an authenticated user");
      }
      const normalized = normalizePreset(preset);
      updatePresets((current) =>
        current.map((existing) =>
          existing.id === preset.id ? normalized : existing
        )
      );
    },
    [updatePresets, user?.id]
  );

  const value = useMemo<ReceiptPresetsContextValue>(
    () => ({ presets, addPreset, removePreset, updatePreset }),
    [presets, addPreset, removePreset, updatePreset]
  );

  return (
    <ReceiptPresetsContext.Provider value={value}>
      {children}
    </ReceiptPresetsContext.Provider>
  );
};

export const useReceiptPresets = (): ReceiptPresetsContextValue => {
  const context = useContext(ReceiptPresetsContext);
  if (!context) {
    throw new Error("useReceiptPresets must be used within ReceiptPresetsProvider");
  }
  return context;
};
