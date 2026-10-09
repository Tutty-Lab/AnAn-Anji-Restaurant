// ============================================================================
// Restaurant Anji (zweiter Laden der App): Arbeitszeit (30′ Küchenvorbereitung), harte Regel „immer
// 1 Bếp + 1 Bồi", weiche Besetzung je Buổi, Lohnabrechnung 05/2023–12/2024
// mit Ein- und Austritt mitten im Monat.
// ============================================================================

import { describe, expect, it } from "vitest";
import { generateSchedule } from "../scheduler";
import { validateSchedule } from "../validation";
import { analyzeSchedule } from "../analyze";
import { DEFAULT_WORK_HOURS, effectiveWeekdayKey, resolveDay } from "../workHours";
import { publicHolidays } from "../holidays";
import { datesOfMonth } from "../demand";
import { monthlyTargetMinutesFor } from "../contract";
import { ANJI_PAYROLL, anjiRoster } from "../anjiPayroll";
import { ANJI_PROFILE, staffGroupOf } from "../staffing";
import type { Shift } from "../../types";

const openDatesOf = (year: number, month: number): string[] => {
  const holidays = publicHolidays(year);
  return datesOfMonth(year, month).filter((d) => !resolveDay(DEFAULT_WORK_HOURS, d, holidays, {}).closed);
};
const paidOf = (shifts: Shift[]) => shifts.reduce((sum, shift) => sum + shift.paidMinutes, 0);

function planMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const employees = anjiRoster(monthKey);
  const shifts = generateSchedule({ year, month, workHours: DEFAULT_WORK_HOURS, employees, profile: ANJI_PROFILE });
  const analysis = analyzeSchedule({ year, month, workHours: DEFAULT_WORK_HOURS, employees, shifts, profile: ANJI_PROFILE });
  return { year, month, employees, shifts, analysis, openDates: openDatesOf(year, month) };
}

describe("Arbeitszeit", () => {
  const holidays = publicHolidays(2026);
  const blocks = (date: string) =>
    resolveDay(DEFAULT_WORK_HOURS, date, holidays, {}).blocks.map((block) => [block.startMinutes, block.endMinutes]);

  it("Öffnung wie AnAn, die Küche beginnt 30 Minuten früher", () => {
    expect(blocks("2026-10-05")).toEqual([[630, 870], [1020, 1350]]); // Montag: 10:30–14:30, 17:00–22:30
    expect(blocks("2026-10-10")).toEqual([[630, 1350]]); // Samstag 10:30–22:30
    expect(blocks("2026-10-11")).toEqual([[690, 1350]]); // Sonntag 11:30–22:30
    expect(blocks("2026-10-03")).toEqual([[690, 1350]]); // Samstag + Feiertag -> wie Sonntag
    expect(effectiveWeekdayKey("2026-10-03", holidays)).toBe("sunday");
  });
});

describe("Lohnabrechnung", () => {
  it("19 Personen, 07/2024 ohne Daten, Bếp/Bồi in jedem vollen Monat vorhanden", () => {
    const names = new Set(Object.values(ANJI_PAYROLL).flat().map((entry) => entry.name));
    expect(names.size).toBe(19);
    expect(ANJI_PAYROLL["2024-07"]).toBeUndefined();
    for (const [monthKey, entries] of Object.entries(ANJI_PAYROLL)) {
      if (entries.length < 9) continue;
      const groups = anjiRoster(monthKey).map(staffGroupOf);
      expect(groups.filter((group) => group === "KITCHEN").length, monthKey).toBeGreaterThanOrEqual(2);
      expect(groups.filter((group) => group === "SERVICE").length, monthKey).toBeGreaterThanOrEqual(2);
    }
  });

  it("Vollzeit ab 150 h; Ein-/Austritt mitten im Monat behält die Art", () => {
    const april = new Map(anjiRoster("2024-04").map((employee) => [employee.name, employee]));
    expect(april.get("Truong Thai Nguyen")).toMatchObject({ employmentType: "VOLLZEIT", endDate: "2024-04-17" });
    expect(april.get("Duc Thinh Nguyen")).toMatchObject({ employmentType: "VOLLZEIT", startDate: "2024-04-17" });
    expect(april.get("Thi Mo Nguyen")!.employmentType).toBe("TEILZEIT");
    expect(april.get("Ha Phuong Nguyen")).toMatchObject({ employmentType: "AZUBI", workRole: "SERVICE" });
    expect(april.get("Hong Son Le")!.workRole).toBe("KITCHEN");
  });
});

describe.each(["2023-07", "2024-04", "2024-12"])("Monat %s mit der Belegschaft laut Lohnabrechnung", (monthKey) => {
  const { year, employees, shifts, analysis, openDates } = planMonth(monthKey);

  it("harte Regel: immer mindestens 1 Bếp und 1 Bồi", () => {
    const gaps = analysis.days.flatMap((day) => day.peaks
      .filter((peak) => peak.label.endsWith("luôn có người") && !peak.ok)
      .map((peak) => `${day.date} ${peak.label}`));
    expect(gaps).toEqual([]);
  });

  it("keine harten Fehler; Verträge nie überschritten und höchstens 30 Minuten darunter", () => {
    const result = validateSchedule(employees, shifts, year, openDates, DEFAULT_WORK_HOURS, ANJI_PROFILE.dayWeights);
    expect(result.errors.filter((error) => error.severity !== "warning")).toEqual([]);
    for (const employee of employees) {
      const own = shifts.filter((shift) => shift.employeeId === employee.id);
      expect(paidOf(own), employee.name).toBeLessThanOrEqual(employee.targetMinutes);
      expect(monthlyTargetMinutesFor(employee, openDates, DEFAULT_WORK_HOURS) - paidOf(own), employee.name).toBeLessThan(30);
      if (employee.startDate) expect(own.filter((shift) => shift.date < employee.startDate!)).toEqual([]);
      if (employee.endDate) expect(own.filter((shift) => shift.date > employee.endDate!)).toEqual([]);
    }
  });

  it("Bồi erst ab Öffnung; in der Vorbereitung meist genau 1 Bếp", () => {
    const byId = new Map(employees.map((employee) => [employee.id, employee]));
    const holidays = publicHolidays(year);
    for (const shift of shifts) {
      if (staffGroupOf(byId.get(shift.employeeId)) !== "SERVICE") continue;
      const open = resolveDay(DEFAULT_WORK_HOURS, shift.date, holidays, {}).blocks[0].startMinutes + 30;
      expect(shift.startMinutes, `${shift.date} ${byId.get(shift.employeeId)!.name}`).toBeGreaterThanOrEqual(open);
    }
    const prep = analysis.days.flatMap((day) => day.peaks.filter((peak) => peak.label === "Bếp chuẩn bị"));
    expect(prep.filter((peak) => peak.ok).length / prep.length).toBeGreaterThanOrEqual(0.9);
  });
});

describe("Randwoche mit einem einzigen Tag (31.07.2023, Montag)", () => {
  it("mittags sind Küche und Service besetzt, obwohl je Person nur ~4,5 h übrig sind", () => {
    const { shifts, employees } = planMonth("2023-07");
    const byId = new Map(employees.map((employee) => [employee.id, employee]));
    const lunch = shifts.filter((shift) => shift.date === "2023-07-31" && shift.startMinutes < 14 * 60 + 30);
    expect(lunch.some((shift) => staffGroupOf(byId.get(shift.employeeId)) === "KITCHEN" && shift.startMinutes === 10 * 60 + 30)).toBe(true);
    expect(lunch.some((shift) => staffGroupOf(byId.get(shift.employeeId)) === "SERVICE")).toBe(true);
  });
});

describe("Monat ohne Küche (05/2024: nur 1 Person in der Abrechnung)", () => {
  it("meldet die harte Küchenregel jeden Tag rot statt sie zu überspringen", () => {
    const { analysis } = planMonth("2024-05");
    const red = analysis.days.filter((day) => day.peaks.some((peak) => peak.label === "Bếp luôn có người" && !peak.ok));
    expect(red).toHaveLength(31);
  });
});
