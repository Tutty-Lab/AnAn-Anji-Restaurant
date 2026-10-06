// ============================================================================
// Restaurant AnAn: Arbeitszeit (30′ Küchenvorbereitung), harte Regel „immer
// 1 Bếp + 1 Phục vụ", weiche Besetzung je Buổi, Fahrer (abends, So 2),
// Lohnabrechnung 06/2023–12/2024 mit Ein- und Austritt mitten im Monat.
// ============================================================================

import { describe, expect, it } from "vitest";
import { generateSchedule } from "../scheduler";
import { validateSchedule } from "../validation";
import { analyzeSchedule } from "../analyze";
import { DEFAULT_WORK_HOURS, effectiveWeekdayKey, resolveDay } from "../workHours";
import { publicHolidays } from "../holidays";
import { datesOfMonth } from "../demand";
import { monthlyBudgetMinutes, monthlyTargetMinutesFor, weeklyBudgetMinutes } from "../contract";
import { ANAN_MISSING_MONTHS, ANAN_PAYROLL, ANAN_ROLES, ananRoster } from "../ananPayroll";
import { staffGroupOf, workingAt } from "../staffing";
import type { Employee, Shift } from "../../types";

const openDatesOf = (year: number, month: number): string[] => {
  const holidays = publicHolidays(year);
  return datesOfMonth(year, month).filter((d) => !resolveDay(DEFAULT_WORK_HOURS, d, holidays, {}).closed);
};
const paidOf = (shifts: Shift[]) => shifts.reduce((sum, shift) => sum + shift.paidMinutes, 0);

function planMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const employees = ananRoster(monthKey);
  const shifts = generateSchedule({ year, month, workHours: DEFAULT_WORK_HOURS, employees });
  const analysis = analyzeSchedule({ year, month, workHours: DEFAULT_WORK_HOURS, employees, shifts });
  return { year, month, employees, shifts, analysis, openDates: openDatesOf(year, month) };
}

describe("Arbeitszeit", () => {
  const holidays = publicHolidays(2026);
  const blocks = (date: string) =>
    resolveDay(DEFAULT_WORK_HOURS, date, holidays, {}).blocks.map((block) => [block.startMinutes, block.endMinutes]);

  it("Öffnung Mo–Fr geteilt, Sa ab 11, So/Feiertag ab 12 – die Küche beginnt 30 Minuten früher", () => {
    expect(blocks("2026-10-05")).toEqual([[630, 870], [1020, 1350]]); // Montag: 10:30–14:30, 17:00–22:30
    expect(blocks("2026-10-10")).toEqual([[630, 1350]]); // Samstag 10:30–22:30
    expect(blocks("2026-10-11")).toEqual([[690, 1350]]); // Sonntag 11:30–22:30
    expect(blocks("2026-10-03")).toEqual([[690, 1350]]); // Samstag + Feiertag -> wie Sonntag
    expect(effectiveWeekdayKey("2026-10-03", holidays)).toBe("sunday");
    expect(openDatesOf(2026, 10)).toHaveLength(31);
  });
});

describe("Lohnabrechnung", () => {
  it("24 Personen, alle mit Bereich; 12/2023 und 04/2024 fehlen", () => {
    const names = new Set(Object.values(ANAN_PAYROLL).flat().map((entry) => entry.name));
    expect(names.size).toBe(24);
    for (const name of names) expect(ANAN_ROLES[name], name).toBeDefined();
    for (const month of Object.keys(ANAN_MISSING_MONTHS)) expect(ANAN_PAYROLL[month]).toBeUndefined();
  });

  it("Mitarbeiterzahl je Monat wie in der Abrechnung", () => {
    const counts = Object.fromEntries(Object.entries(ANAN_PAYROLL).map(([month, entries]) => [month, entries.length]));
    expect(counts).toEqual({
      "2023-06": 9, "2023-07": 9, "2023-08": 8, "2023-09": 7, "2023-10": 7, "2023-11": 8,
      "2024-01": 8, "2024-02": 9, "2024-03": 6, "2024-05": 8, "2024-06": 9, "2024-07": 9,
      "2024-08": 10, "2024-09": 10, "2024-10": 13, "2024-11": 12, "2024-12": 13,
    });
  });

  it("Azubi bleibt Azubi; Vollzeit ab 150 h; Ein-/Austritt mitten im Monat behält die Art", () => {
    const feb = new Map(ananRoster("2024-02").map((employee) => [employee.name, employee]));
    expect(feb.get("Bao Long Nguyen")).toMatchObject({ employmentType: "AZUBI", endDate: "2024-02-12" });
    expect(feb.get("Thi Ky Duyen Nguyen")).toMatchObject({ employmentType: "AZUBI", startDate: "2024-02-22" });
    const nov = new Map(ananRoster("2023-11").map((employee) => [employee.name, employee]));
    expect(nov.get("Hoa Bang Dao")).toMatchObject({ employmentType: "VOLLZEIT", endDate: "2023-11-05" });
    expect(nov.get("Hiep Doan")).toMatchObject({ employmentType: "TEILZEIT", workRole: "DRIVER" });
    expect(new Map(ananRoster("2024-12").map((e) => [e.name, e])).get("Van Hao Nguyen")!.employmentType).toBe("MINIJOB");
  });
});

describe("Verträge", () => {
  it("Monatsvertrag: 30-Minuten-Raster und nie über dem Vertrag", () => {
    for (const hours of [92.7, 73.94, 43.51, 173.81, 39, 28.2]) {
      const employee: Employee = { id: "m", name: "m", employmentType: "TEILZEIT", targetMinutes: Math.round(hours * 60) };
      for (const [year, month] of [[2026, 10], [2026, 11], [2027, 2]] as const) {
        const budgets = [...monthlyBudgetMinutes(employee, openDatesOf(year, month)).values()];
        expect(budgets.every((minutes) => minutes % 30 === 0)).toBe(true);
        expect(budgets.reduce((sum, minutes) => sum + minutes, 0)).toBe(Math.floor(employee.targetMinutes / 30) * 30);
      }
    }
  });

  it("Azubi mit Wochenvertrag: Wochen in der Berufsschule tragen nichts", () => {
    const azubi: Employee = {
      id: "az", name: "az", employmentType: "AZUBI", targetMinutes: 0, weeklyHours: 39,
      schoolPeriods: [{ start: "2026-10-12", end: "2026-10-25" }],
    };
    const openDates = openDatesOf(2026, 10);
    const budgets = weeklyBudgetMinutes(azubi, openDates, { first: "2026-10-01", last: "2026-10-31" });
    expect(budgets.get("2026-10-05")).toBe(39 * 60);
    expect(budgets.get("2026-10-12") ?? 0).toBe(0);
    expect(budgets.get("2026-10-19") ?? 0).toBe(0);
  });
});

describe.each(["2024-01", "2024-02"])("Monat %s: Küche und Service ausreichend besetzt", (monthKey) => {
  const { analysis } = planMonth(monthKey);

  it("harte Regel: immer mindestens 1 Bếp und 1 Phục vụ", () => {
    const gaps = analysis.days.flatMap((day) => day.peaks
      .filter((peak) => peak.label.endsWith("luôn có người") && !peak.ok)
      .map((peak) => `${day.date} ${peak.label}`));
    expect(gaps).toEqual([]);
  });
});

describe.each(["2023-06", "2024-02", "2024-10", "2024-12"])("Monat %s mit der Belegschaft laut Lohnabrechnung", (monthKey) => {
  const { year, employees, shifts, analysis, openDates } = planMonth(monthKey);
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const holidays = publicHolidays(year);

  it("keine harten Fehler; Verträge nie überschritten und höchstens 30 Minuten darunter", () => {
    const result = validateSchedule(employees, shifts, year, openDates, DEFAULT_WORK_HOURS);
    expect(result.errors.filter((error) => error.severity !== "warning")).toEqual([]);
    for (const employee of employees) {
      const own = shifts.filter((shift) => shift.employeeId === employee.id);
      expect(paidOf(own), employee.name).toBeLessThanOrEqual(employee.targetMinutes);
      const soll = monthlyTargetMinutesFor(employee, openDates, DEFAULT_WORK_HOURS);
      // Unter dem kürzesten Dienst (Fahrer 2 h) ist kein Dienst möglich.
      if (soll >= 120) expect(soll - paidOf(own), employee.name).toBeLessThan(30);
      if (employee.startDate) expect(own.filter((shift) => shift.date < employee.startDate!)).toEqual([]);
      if (employee.endDate) expect(own.filter((shift) => shift.date > employee.endDate!)).toEqual([]);
    }
  });

  it("Phục vụ und Lái xe erst ab Öffnung; in der Vorbereitung meist genau 1 Bếp", () => {
    for (const shift of shifts) {
      if (staffGroupOf(byId.get(shift.employeeId)) === "KITCHEN") continue;
      const open = resolveDay(DEFAULT_WORK_HOURS, shift.date, holidays, {}).blocks[0].startMinutes + 30;
      expect(shift.startMinutes, `${shift.date} ${byId.get(shift.employeeId)!.name}`).toBeGreaterThanOrEqual(open);
    }
    const prep = analysis.days.flatMap((day) => day.peaks.filter((peak) => peak.label === "Bếp chuẩn bị"));
    expect(prep.filter((peak) => peak.ok).length / prep.length).toBeGreaterThanOrEqual(0.8);
  });

  it("Fahrer: fast jeden Abend 18–21 Uhr, sonntags meist zu zweit", () => {
    const drivers = shifts.filter((shift) => staffGroupOf(byId.get(shift.employeeId)) === "DRIVER");
    const at = (date: string, minute: number) => drivers.filter((shift) => shift.date === date && workingAt(shift, minute)).length;
    const withDriver = openDates.filter((date) => at(date, 19 * 60) >= 1).length;
    expect(withDriver / openDates.length).toBeGreaterThanOrEqual(0.9);
    const sundays = openDates.filter((date) => effectiveWeekdayKey(date, holidays) === "sunday");
    expect(sundays.filter((date) => at(date, 19 * 60) >= 2).length / sundays.length).toBeGreaterThanOrEqual(0.75);
  });
});

describe("Monat ohne genug Service (12/2024: 2 Personen, ~217 h)", () => {
  it("meldet die harte Service-Regel rot statt sie zu überspringen", () => {
    const { analysis } = planMonth("2024-12");
    const red = analysis.days.filter((day) => day.peaks.some((peak) => peak.label === "Phục vụ luôn có người" && !peak.ok));
    expect(red.length).toBeGreaterThan(0);
  });
});
