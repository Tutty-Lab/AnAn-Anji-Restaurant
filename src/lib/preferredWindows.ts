// ============================================================================
// „Khung giờ ưu tiên" und „Độ dài ca": weiche Wünsche je Mitarbeiter/in
// (Formular wie Thiên Long). Der Planer rechnet sie als Aufschlag in
// styleCostOf (weeklyScheduler.ts) – sie verdrängen nie eine Besetzungsregel.
// ============================================================================

import type { Employee, PreferredWindow, Shift } from "../types";
import type { WeekdayKey } from "./demand";
import { minutesToTime } from "./time";

const DAY_LABELS: Record<WeekdayKey, string> = {
  monday: "T2",
  tuesday: "T3",
  wednesday: "T4",
  thursday: "T5",
  friday: "T6",
  saturday: "T7",
  sunday: "CN",
};
const DAY_ORDER: WeekdayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** Nur gültige Fenster (mind. ein Tag, Ende nach Beginn). */
export function preferredWindowsOf(employee: Employee): PreferredWindow[] {
  return (employee.preferredWindows ?? []).filter((w) => w.days.length > 0 && w.endMinutes > w.startMinutes);
}

/** Fenster, die an diesem Wochentag gelten. */
export function preferredWindowsOn(employee: Employee, weekday: WeekdayKey): PreferredWindow[] {
  return preferredWindowsOf(employee).filter((w) => w.days.includes(weekday));
}

/**
 * Arbeitsminuten außerhalb der Wunschfenster dieses Wochentags (0 ohne
 * Fenster). An einem Tag ganz ohne Fenster zählt jede Minute.
 */
export function minutesOutsidePreferred(employee: Employee, weekday: WeekdayKey, shifts: readonly Shift[]): number {
  if (preferredWindowsOf(employee).length === 0) return 0;
  const windows = preferredWindowsOn(employee, weekday);
  let outside = 0;
  for (const shift of shifts) {
    for (let t = shift.startMinutes; t < shift.endMinutes; t += 30) {
      const end = Math.min(t + 30, shift.endMinutes);
      if (!windows.some((w) => w.startMinutes <= t && end <= w.endMinutes)) outside += end - t;
    }
  }
  return outside;
}

/** Eigene Dienstlänge („Độ dài ca") in Minuten, sonst null. */
export function ownShiftRangeMinutes(employee: Employee): { min: number; max: number } | null {
  const range = employee.shiftHours;
  if (!range || !(range.min > 0) || !(range.max >= range.min)) return null;
  return { min: Math.round(range.min * 60), max: Math.round(range.max * 60) };
}

/** Kurztext für Liste/Hinweise, z.B. „T2–T6 10:30–15:00". */
export function describePreferredWindow(w: PreferredWindow): string {
  return `${describeDays(w.days)} ${minutesToTime(w.startMinutes)}–${minutesToTime(w.endMinutes)}`;
}

function describeDays(days: readonly WeekdayKey[]): string {
  const idx = DAY_ORDER.map((d, i) => (days.includes(d) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 7) return "Cả tuần";
  const runs: string[] = [];
  for (let k = 0; k < idx.length; ) {
    let j = k;
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
    const from = DAY_LABELS[DAY_ORDER[idx[k]]];
    const to = DAY_LABELS[DAY_ORDER[idx[j]]];
    runs.push(j - k >= 2 ? `${from}–${to}` : j > k ? `${from}, ${to}` : from);
    k = j + 1;
  }
  return runs.join(", ");
}
