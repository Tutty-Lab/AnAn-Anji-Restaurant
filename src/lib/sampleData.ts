// ============================================================================
// Startbelegschaft des Restaurant AnAn laut Lohnabrechnung des Betriebs.
// ============================================================================

import type { Employee, Schedule, WorkRole } from "../types";
import { DEFAULT_WORK_HOURS } from "./workHours";
import { COMPANY_ADDRESS, COMPANY_NAME } from "./company";
import { ananRoster } from "./ananPayroll";

export function makeEmployee(
  id: string,
  name: string,
  employmentType: Employee["employmentType"],
  targetHours: number,
): Employee {
  return { id, name, employmentType, targetMinutes: Math.round(targetHours * 60) };
}

/** Mitarbeiter mit MONATSvertrag (z. B. 92,70 h/Monat). */
export function makeMonthly(
  id: string,
  name: string,
  employmentType: Employee["employmentType"],
  monthlyHours: number,
  workRole?: WorkRole,
): Employee {
  return { id, name, employmentType, targetMinutes: Math.round(monthlyHours * 60), ...(workRole ? { workRole } : {}) };
}

/** Mitarbeiter mit WOCHENvertrag (Azubi: 39 h/Woche). */
export function makeWeekly(
  id: string,
  name: string,
  employmentType: Employee["employmentType"],
  weeklyHours: number,
  workRole?: WorkRole,
): Employee {
  return { id, name, employmentType, targetMinutes: 0, weeklyHours, ...(workRole ? { workRole } : {}) };
}

/**
 * Belegschaft Restaurant AnAn: letzter Monat der Lohnabrechnung (12/2024),
 * Bereiche laut Angabe des Betriebs (ananPayroll.ts, ANAN_ROLES).
 */
export const SAMPLE_EMPLOYEES: Employee[] = ananRoster("2024-12");

export function createSampleSchedule(): Schedule {
  return {
    companyName: COMPANY_NAME,
    address: COMPANY_ADDRESS,
    year: 2026,
    month: 8, // August
    workHours: structuredClone(DEFAULT_WORK_HOURS),
    dateOverrides: [],
    employees: SAMPLE_EMPLOYEES.map((e) => ({ ...e })),
    shifts: [],
  };
}

/** Startbelegschaft, die die App beim allerersten Öffnen zeigt (Oktober 2026). */
export function createInitialSchedule(): Schedule {
  return {
    companyName: COMPANY_NAME,
    address: COMPANY_ADDRESS,
    year: 2026,
    month: 10,
    workHours: structuredClone(DEFAULT_WORK_HOURS),
    dateOverrides: [],
    employees: SAMPLE_EMPLOYEES.map((e) => ({ ...e })),
    shifts: [],
  };
}
