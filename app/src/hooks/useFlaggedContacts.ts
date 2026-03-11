import React from "react";

const STORAGE_KEY = "flaggedContacts";

export interface FlaggedContact {
  id: string;
  name: string;
  phoneNumber: string;
  dateAdded: number;
}

function load(): FlaggedContact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(contacts: FlaggedContact[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

export function useFlaggedContacts(): [
  FlaggedContact[],
  (contacts: FlaggedContact[]) => void
] {
  const [contacts, setContacts] = React.useState<FlaggedContact[]>(() => load());

  React.useEffect(() => {
    const stored = load();
    if (JSON.stringify(stored) !== JSON.stringify(contacts)) {
      setContacts(stored);
    }
  }, []);

  const setAndPersist = React.useCallback((next: FlaggedContact[]) => {
    setContacts(next);
    save(next);
  }, []);

  return [contacts, setAndPersist];
}

// For non-React usage (e.g. reading in Main for redirect)
export function getFlaggedContacts(): FlaggedContact[] {
  return load();
}

