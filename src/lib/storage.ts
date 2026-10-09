// ============================================================================
// Persistenz via LocalStorage – je Laden ein eigener Schlüssel. Speichert Firma,
// Mitarbeiter, Monat, den generierten Plan sowie den ursprünglich generierten
// Plan (für "Zurücksetzen").
// ============================================================================

import type { Schedule, Shift } from "../types";

const keyFor = (storeId: string) => `stundenzettel-app:v1:${storeId}`;
/**
 * Schlüssel aus der Zeit, als die App nur AnAn kannte. Er wird beim ersten Laden
 * von AnAn übernommen, damit kein Gerät seinen Stand verliert.
 */
const LEGACY_KEY = "stundenzettel-app:v1";
const LEGACY_STORE = "anan";

export type PersistedState = {
  schedule: Schedule;
  /**
   * SHA-256 des Filial-Passworts. Fehlt es, gilt das Startpasswort.
   * Liegt hier und nicht im Schedule, weil es zum LADEN gehört und nicht zu
   * einem einzelnen Monat – beim Monatswechsel darf es nicht verschwinden.
   */
  passwordHash?: string;
  /** Snapshot des zuletzt generierten Plans (für Reset). */
  originalShifts: Shift[];
};

function read(key: string): PersistedState | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as PersistedState;
  return parsed?.schedule ? parsed : null;
}

export function loadState(storeId: string): PersistedState | null {
  try {
    return read(keyFor(storeId)) ?? (storeId === LEGACY_STORE ? read(LEGACY_KEY) : null);
  } catch {
    return null;
  }
}

export function saveState(storeId: string, state: PersistedState): void {
  try {
    localStorage.setItem(keyFor(storeId), JSON.stringify(state));
  } catch {
    // Speicher voll / nicht verfügbar – im MVP still ignorieren.
  }
}

export function clearState(storeId: string): void {
  try {
    localStorage.removeItem(keyFor(storeId));
    if (storeId === LEGACY_STORE) localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignorieren
  }
}
