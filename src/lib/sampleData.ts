// ============================================================================
// Startbelegschaft des Restaurant AnAn laut Lohnabrechnung des Betriebs.
// ============================================================================

import type { Employee, Schedule, WorkRole } from "../types";
import { DEFAULT_WORK_HOURS } from "./workHours";
import { ANAN_PROFILE } from "./staffing";
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
 * Bereiche laut Angabe des Betriebs (ananPayroll.ts, ANAN_ROLES). Startstand der
 * App je Laden: stores.ts (initialScheduleFor).
 */
export const SAMPLE_EMPLOYEES: Employee[] = ananRoster("2024-12");

export function createSampleSchedule(): Schedule {
  return {
    companyName: ANAN_PROFILE.name,
    address: ANAN_PROFILE.address,
    year: 2026,
    month: 8, // August
    workHours: structuredClone(DEFAULT_WORK_HOURS),
    dateOverrides: [],
    employees: SAMPLE_EMPLOYEES.map((e) => ({ ...e })),
    shifts: [],
  };
}
