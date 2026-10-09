// ============================================================================
// Die zwei Läden dieser App: Restaurant AnAn und Restaurant Anji. Ein Betrieb,
// einige Mitarbeiter arbeiten in beiden Läden (gleicher personKey) – „Tạo lịch"
// plant beide Läden nacheinander und nie dieselbe Person am selben Tag in
// beiden (App.tsx, generateAll).
//
// Regeln, Gewichte und Nachfrage je Laden: staffing.ts (StoreProfile).
// Lohnabrechnung je Laden: ananPayroll.ts, anjiPayroll.ts.
// ============================================================================

import type { Employee, Schedule } from "../types";
import { ANAN_PAYROLL, ananRoster } from "./ananPayroll";
import { ANJI_PAYROLL, anjiRoster } from "./anjiPayroll";
import { ANAN_PROFILE, ANJI_PROFILE, STORE_PROFILES, profileById, type StoreProfile } from "./staffing";
import { DEFAULT_WORK_HOURS } from "./workHours";

export { STORE_PROFILES, profileById, type StoreProfile };

/** Lesbarer Schlüssel aus dem Namen („Hong Son Le" -> "hong-son-le"). */
export function personKeyOf(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const namesOf = (payroll: Record<string, { name: string }[]>) =>
  new Set(Object.values(payroll).flat().map((entry) => entry.name));

/**
 * Wer in beiden Lohnabrechnungen steht, ist dieselbe Person (Angabe des
 * Betriebs: AnAn und Anji teilen sich einige Mitarbeiter).
 */
export const SHARED_PEOPLE: ReadonlySet<string> = (() => {
  const anji = namesOf(ANJI_PAYROLL);
  return new Set([...namesOf(ANAN_PAYROLL)].filter((name) => anji.has(name)));
})();

const withPersonKey = (employees: Employee[]): Employee[] =>
  employees.map((employee) => (SHARED_PEOPLE.has(employee.name) ? { ...employee, personKey: personKeyOf(employee.name) } : employee));

/** Belegschaft eines Ladens laut Lohnabrechnung des Monats ("yyyy-MM"). */
export function storeRoster(storeId: string, monthKey: string): Employee[] {
  return withPersonKey(storeId === ANJI_PROFILE.id ? anjiRoster(monthKey) : ananRoster(monthKey));
}

/** Monate, für die ein Laden eine Lohnabrechnung hat. */
export function payrollMonths(storeId: string): string[] {
  return Object.keys(storeId === ANJI_PROFILE.id ? ANJI_PAYROLL : ANAN_PAYROLL).sort();
}

/** Startbelegschaft beim allerersten Öffnen: letzter Monat der Lohnabrechnung (12/2024). */
export function sampleEmployees(profile: StoreProfile): Employee[] {
  return storeRoster(profile.id, "2024-12");
}

/** Startstand eines Ladens (Oktober 2026). */
export function initialScheduleFor(profile: StoreProfile): Schedule {
  return {
    companyName: profile.name,
    address: profile.address,
    year: 2026,
    month: 10,
    workHours: structuredClone(DEFAULT_WORK_HOURS),
    dateOverrides: [],
    employees: sampleEmployees(profile),
    shifts: [],
  };
}

/**
 * Ältere Stände kennen noch keinen personKey. Fehlt er, bekommt ein Mitarbeiter,
 * der in beiden Lohnabrechnungen steht, ihn hier nachgetragen. "" heißt „im Tab
 * Nhân viên bewusst gelöst" und bleibt so.
 */
export function withSharedPersonDefaults(employees: Employee[]): Employee[] {
  return employees.map((employee) =>
    employee.personKey !== undefined || !SHARED_PEOPLE.has(employee.name)
      ? employee
      : { ...employee, personKey: personKeyOf(employee.name) });
}

export { ANAN_PROFILE, ANJI_PROFILE };
