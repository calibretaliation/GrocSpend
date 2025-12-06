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
}

const ReceiptsContext = createContext<ReceiptsContextValue | undefined>(
  undefined
);

export const ReceiptsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { token, authorizedFetch, loading: authLoading } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
        return Array.from(map.values()).sort(
          (a, b) => b.createdAt - a.createdAt
        );
      });
      setError(null);
      return saved;
    },
    [authorizedFetch, token]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      await deleteReceipt(id, authorizedFetch);
      setReceipts((prev) => prev.filter((receipt) => receipt.id !== id));
    },
    [authorizedFetch, token]
  );

  const value = useMemo<ReceiptsContextValue>(
    () => ({ receipts, loading, error, refresh, upsert, remove }),
    [receipts, loading, error, refresh, upsert, remove]
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
