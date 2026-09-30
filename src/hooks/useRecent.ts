import { useCallback, useEffect, useState } from "react";
import { addRecent, loadRecent, removeRecent, saveRecent, STORAGE_KEY, type RecentEntry } from "../lib/history";

export function useRecent() {
  const [recent, setRecent] = useState<RecentEntry[]>(() => loadRecent());

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setRecent(loadRecent());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((entry: RecentEntry) => {
    setRecent((list) => saveRecent(addRecent(list, entry)));
  }, []);
  const remove = useCallback((id: string) => {
    setRecent((list) => saveRecent(removeRecent(list, id)));
  }, []);
  const clear = useCallback(() => {
    setRecent(() => saveRecent([]));
  }, []);

  return { recent, add, remove, clear };
}
