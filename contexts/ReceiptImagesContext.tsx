import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";

interface StoredImage {
  data: string;
  updatedAt: number;
}

interface ReceiptImagesContextValue {
  images: Record<string, string>;
  setImage: (receiptId: string, dataUrl: string) => void;
  removeImage: (receiptId: string) => void;
  getImage: (receiptId: string) => string | null;
  clearAll: () => void;
}

const ReceiptImagesContext =
  createContext<ReceiptImagesContextValue | undefined>(undefined);

const STORAGE_PREFIX = "smart_spend_receipt_images";
const MAX_IMAGES = 40;
const isBrowser = typeof window !== "undefined";

interface PersistedImage {
  id: string;
  data: string;
  updatedAt: number;
}

const buildStorageKey = (userId: string) => `${STORAGE_PREFIX}_${userId}`;

const readStoredImages = (userId: string): Record<string, StoredImage> => {
  if (!isBrowser) return {};
  try {
    const raw = window.localStorage.getItem(buildStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedImage[];
    const map: Record<string, StoredImage> = {};
    parsed.forEach((entry) => {
      if (entry.id && entry.data) {
        map[entry.id] = { data: entry.data, updatedAt: entry.updatedAt ?? Date.now() };
      }
    });
    return map;
  } catch (error) {
    console.warn("Failed to parse stored receipt images", error);
    return {};
  }
};

const persistImages = (userId: string, images: Record<string, StoredImage>) => {
  if (!isBrowser) return;
  try {
    const payload: PersistedImage[] = Object.entries(images).map(
      ([id, value]) => ({ id, data: value.data, updatedAt: value.updatedAt })
    );
    window.localStorage.setItem(buildStorageKey(userId), JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist receipt images", error);
  }
};

export const ReceiptImagesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [images, setImages] = useState<Record<string, StoredImage>>({});

  useEffect(() => {
    if (!user?.id) {
      setImages({});
      return;
    }
    setImages(readStoredImages(user.id));
  }, [user?.id]);

  const updateImages = useCallback(
    (updater: (current: Record<string, StoredImage>) => Record<string, StoredImage>) => {
      setImages((current) => {
        const next = updater(current);
        if (user?.id) {
          persistImages(user.id, next);
        }
        return next;
      });
    },
    [user?.id]
  );

  const setImage = useCallback(
    (receiptId: string, dataUrl: string) => {
      if (!user?.id || !dataUrl) return;
      updateImages((current) => {
        const next: Record<string, StoredImage> = {
          ...current,
          [receiptId]: { data: dataUrl, updatedAt: Date.now() },
        };
        const entries = Object.entries(next)
          .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
          .slice(0, MAX_IMAGES);
        const trimmed: Record<string, StoredImage> = {};
        entries.forEach(([id, value]) => {
          trimmed[id] = value;
        });
        return trimmed;
      });
    },
    [updateImages, user?.id]
  );

  const removeImage = useCallback(
    (receiptId: string) => {
      if (!user?.id) return;
      updateImages((current) => {
        if (!current[receiptId]) return current;
        const { [receiptId]: _discard, ...rest } = current;
        return rest;
      });
    },
    [updateImages, user?.id]
  );

  const clearAll = useCallback(() => {
    if (!user?.id) return;
    updateImages(() => ({}));
  }, [updateImages, user?.id]);

  const exposedImages = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(images).forEach(([id, value]) => {
      map[id] = value.data;
    });
    return map;
  }, [images]);

  const getImage = useCallback(
    (receiptId: string) => exposedImages[receiptId] ?? null,
    [exposedImages]
  );

  const value = useMemo<ReceiptImagesContextValue>(
    () => ({ images: exposedImages, setImage, removeImage, getImage, clearAll }),
    [exposedImages, setImage, removeImage, getImage, clearAll]
  );

  return (
    <ReceiptImagesContext.Provider value={value}>
      {children}
    </ReceiptImagesContext.Provider>
  );
};

export const useReceiptImages = (): ReceiptImagesContextValue => {
  const context = useContext(ReceiptImagesContext);
  if (!context) {
    throw new Error("useReceiptImages must be used within ReceiptImagesProvider");
  }
  return context;
};
