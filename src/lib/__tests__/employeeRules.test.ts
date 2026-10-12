// Luật riêng (mềm) aus dem Tab Nhân viên: Khung giờ ưu tiên und Độ dài ca.
import { describe, expect, it } from "vitest";
import { generateSchedule } from "../scheduler";
import { DEFAULT_WORK_HOURS } from "../workHours";
import { ananRoster } from "../ananPayroll";
import { minutesOutsidePreferred } from "../preferredWindows";
import { parseIsoDate, weekdayKeyOf, type WeekdayKey } from "../demand";
import type { Employee } from "../../types";

const plan = (employees: Employee[]) =>
  generateSchedule({ year: 2026, month: 10, workHours: DEFAULT_WORK_HOURS, employees });

describe("Luật riêng (mềm)", () => {
  const base = ananRoster("2024-12");
  const minijob = base.find((e) => e.employmentType === "MINIJOB" && e.workRole === "KITCHEN")!;

  it("Khung giờ ưu tiên: mehr Arbeit im Wunschfenster als ohne", () => {
    const windows = [{ days: ["monday", "tuesday", "wednesday", "thursday", "friday"] as WeekdayKey[], startMinutes: 11 * 60, endMinutes: 14 * 60 + 30 }];
    const withWish = { ...minijob, preferredWindows: windows };
    const outside = (employees: Employee[]) =>
      plan(employees).filter((s) => s.employeeId === minijob.id)
        .reduce((sum, s) => sum + minutesOutsidePreferred(withWish, weekdayKeyOf(parseIsoDate(s.date)), [s]), 0);
    const before = outside(base);
    const after = outside(base.map((e) => (e.id === minijob.id ? withWish : e)));
    expect(after).toBeLessThan(before);
  });

  it("Độ dài ca: Dienste liegen in der eigenen Spanne", () => {
    const cook = base.find((e) => e.employmentType === "VOLLZEIT" && e.workRole === "KITCHEN")!;
    const ranged = { ...cook, shiftHours: { min: 7, max: 8 } };
    const shifts = plan(base.map((e) => (e.id === cook.id ? ranged : e))).filter((s) => s.employeeId === cook.id);
    const perDay = new Map<string, number>();
    for (const s of shifts) perDay.set(s.date, (perDay.get(s.date) ?? 0) + s.paidMinutes);
    // Ein Arbeitstag = ein Einsatz (geteilter Dienst zählt zusammen).
    const inRange = [...perDay.values()].filter((paid) => paid >= 7 * 60 && paid <= 8 * 60).length;
    expect(inRange / perDay.size).toBeGreaterThan(0.5);
  });
});
