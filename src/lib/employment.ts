// ============================================================================
// Beschriftungen der Anstellungsarten und Bereiche – an einer Stelle, damit eine
// neue Art nicht in fünf Komponenten einzeln nachgetragen werden muss.
// ============================================================================

import type { EmploymentType, WorkRole } from "../types";
import { ANAN_PROFILE, type StoreProfile } from "./staffing";

/** Volle Bezeichnung in der App-Sprache (Vietnamesisch). */
export function employmentLabelVi(type: EmploymentType): string {
  switch (type) {
    case "VOLLZEIT":
      return "Toàn thời gian";
    case "TEILZEIT":
      return "Bán thời gian";
    case "MINIJOB":
      return "Minijob";
    case "AZUBI":
      return "Azubi (học nghề)";
  }
}

/** Kürzel für die enge Spalte im Dienstplan-Raster. */
export function employmentShortVi(type: EmploymentType): string {
  switch (type) {
    case "VOLLZEIT":
      return "TT";
    case "TEILZEIT":
      return "BT";
    case "MINIJOB":
      return "MJ";
    case "AZUBI":
      return "AZ";
  }
}

/** Deutsche Bezeichnung – so steht sie auf dem Stundenzettel. */
export function employmentLabelDe(type: EmploymentType): string {
  switch (type) {
    case "VOLLZEIT":
      return "Vollzeit";
    case "TEILZEIT":
      return "Teilzeit";
    case "MINIJOB":
      return "Minijob";
    case "AZUBI":
      return "Auszubildende/r";
  }
}

/**
 * Bereich in der App-Sprache; undefined = noch nicht zugeordnet. Die Wörter
 * kommen aus dem Laden (Service heißt bei AnAn „Phục vụ", bei Anji „Bồi").
 */
export function roleLabelVi(role: WorkRole | undefined, profile: StoreProfile = ANAN_PROFILE): string {
  return role ? profile.groupLabels[role] : "Chưa gán";
}
