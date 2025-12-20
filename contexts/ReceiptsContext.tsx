import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Receipt } from "../types";
import { getReceipts, saveReceipt, deleteReceipt } from "../services/storageService";
import { useAuth } from "./AuthContext";

interface ReceiptsContextValue {
  receipts: Receipt[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  upsert: (receipt: Receipt) => Promise<Receipt>;
  remove: (id: string) => Promise<void>;
  quickAdd: (receipt: Receipt) => Promise<Receipt>;
  saveStates: Record<string, 'pending' | 'failed'>;
  retrySave: (id: string) => Promise<Receipt>;
}

const ReceiptsContext = createContext<ReceiptsContextValue | undefined>(
  undefined
);

const sortByCreatedAtDesc = (items: Receipt[]): Receipt[] =>
  items
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);

export const ReceiptsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { token, authorizedFetch, loading: authLoading } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, 'pending' | 'failed'>>({});
  const [drafts, setDrafts] = useState<Record<string, Receipt>>({});

  const refresh = useCallback(async () => {
    if (!token) {
      setReceipts([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const data = await getReceipts(authorizedFetch);
      setReceipts(data);
      setSaveStates({});
      setDrafts({});
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load receipts.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch, token]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const upsert = useCallback(
    async (receipt: Receipt) => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      const saved = await saveReceipt(receipt, authorizedFetch);
      setReceipts((prev) => {
        const map = new Map(prev.map((item) => [item.id, item] as const));
        map.set(saved.id, saved);
        return sortByCreatedAtDesc(Array.from(map.values()));
      });
      setSaveStates((prev) => {
        if (!(saved.id in prev)) return prev;
        const { [saved.id]: _discard, ...rest } = prev;
        return rest;
      });
      setDrafts((prev) => {
        if (!(saved.id in prev)) return prev;
        const { [saved.id]: _discard, ...rest } = prev;
        return rest;
      });
      setError(null);
      return saved;
    },
    [authorizedFetch, token]
  );

  const quickAdd = useCallback(
    async (receipt: Receipt) => {
      if (!token) {
        throw new Error("Not authenticated");
      }

      setReceipts((prev) => {
        const filtered = prev.filter((item) => item.id !== receipt.id);
        return sortByCreatedAtDesc([receipt, ...filtered]);
      });
      setSaveStates((prev) => ({
        ...prev,
        [receipt.id]: 'pending',
      }));
      setDrafts((prev) => ({
        ...prev,
        [receipt.id]: receipt,
      }));
      setError(null);

      try {
        const saved = await saveReceipt(receipt, authorizedFetch);
        setReceipts((prev) => {
          const map = new Map(prev.map((item) => [item.id, item] as const));
          map.delete(receipt.id);
          map.set(saved.id, saved);
          return sortByCreatedAtDesc(Array.from(map.values()));
        });
        setSaveStates((prev) => {
          const { [saved.id]: _discard, ...rest } = prev;
          return rest;
        });
        setDrafts((prev) => {
          const { [saved.id]: _discard, ...rest } = prev;
          return rest;
        });
        return saved;
      } catch (err) {
        setReceipts((prev) => prev.filter((item) => item.id !== receipt.id));
        setSaveStates((prev) => ({
          ...prev,
          [receipt.id]: 'failed',
        }));
        const message =
          err instanceof Error ? err.message : "Failed to save receipt.";
        setError(message);
        throw err;
      }
    },
    [authorizedFetch, token]
  );

  const retrySave = useCallback(
    async (id: string) => {
      if (!token) {
        throw new Error("Not authenticated");
      }

      const draft = drafts[id];
      if (!draft) {
        throw new Error("No pending receipt to retry");
      }

      const attempt: Receipt = {
        ...draft,
        updatedAt: Date.now(),
      };

      setSaveStates((prev) => ({
        ...prev,
        [id]: 'pending',
      }));

      try {
        const saved = await saveReceipt(attempt, authorizedFetch);
        setReceipts((prev) => {
          const map = new Map(prev.map((item) => [item.id, item] as const));
          map.set(saved.id, saved);
          return sortByCreatedAtDesc(Array.from(map.values()));
        });
        setSaveStates((prev) => {
          const { [saved.id]: _discard, ...rest } = prev;
          return rest;
        });
        setDrafts((prev) => {
          const { [saved.id]: _discard, ...rest } = prev;
          return rest;
        });
        return saved;
      } catch (err) {
        setSaveStates((prev) => ({
          ...prev,
          [id]: 'failed',
        }));
        const message =
          err instanceof Error ? err.message : "Failed to save receipt.";
        setError(message);
        throw err;
      }
    },
    [authorizedFetch, drafts, token]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      await deleteReceipt(id, authorizedFetch);
      setReceipts((prev) => prev.filter((receipt) => receipt.id !== id));
      setSaveStates((prev) => {
        if (!(id in prev)) return prev;
        const { [id]: _discard, ...rest } = prev;
        return rest;
      });
      setDrafts((prev) => {
        if (!(id in prev)) return prev;
        const { [id]: _discard, ...rest } = prev;
        return rest;
      });
    },
    [authorizedFetch, token]
  );

  const value = useMemo<ReceiptsContextValue>(
    () => ({ receipts, loading, error, refresh, upsert, remove, quickAdd, saveStates, retrySave }),
    [receipts, loading, error, refresh, upsert, remove, quickAdd, saveStates, retrySave]
  );

  return (
    <ReceiptsContext.Provider value={value}>
      {children}
    </ReceiptsContext.Provider>
  );
};

export const useReceipts = (): ReceiptsContextValue => {
  const context = useContext(ReceiptsContext);
  if (!context) {
    throw new Error("useReceipts must be used within ReceiptsProvider");
  }
  return context;
};
