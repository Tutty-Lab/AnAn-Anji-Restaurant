// ============================================================================
// Unterbesetzung muss sichtbar werden statt still zu passieren – egal ob sie
// vom Scheduler kommt oder von einer Änderung im Plan von Hand.
// ============================================================================

import { describe, expect, it } from "vitest";
import { analyzeSchedule } from "../analyze";
import { DEFAULT_WORK_HOURS } from "../workHours";
import type { Employee, Shift } from "../../types";

const emp = (id: string, type: Employee["employmentType"], weeklyHours: number): Employee => ({
  id,
  name: id,
  employmentType: type,
  targetMinutes: 0,
  weeklyHours,
});

describe("Zu wenige Leute am Abend", () => {
  // 2026-08-01 ist ein Samstag: Arbeitszeit 10:30–22:30, offen ab 11:00 durchgehend.
  // Abends (18:00–22:00) T6–CN mindestens 3 Phục vụ. Hier steht nur EINE Person.
  const employees = ["a"].map((id) => emp(id, "TEILZEIT", 30));
  const shifts: Shift[] = [
    {
      id: "s0",
      employeeId: "a",
      date: "2026-08-01",
      startMinutes: 16 * 60 + 30,
      endMinutes: 22 * 60 + 30,
      pauseMinutes: 30,
      paidMinutes: 5 * 60 + 30,
      shiftType: "LATE",
      generated: true,
    },
  ];

  const analysis = analyzeSchedule({
    year: 2026,
    month: 8,
    workHours: DEFAULT_WORK_HOURS,
    employees,
    shifts,
  });

  it("meldet den unterbesetzten Tag, statt ihn zu verschweigen", () => {
    const tag = analysis.peakViolations.find((d) => d.date === "2026-08-01");
    expect(tag).toBeDefined();
    expect(tag!.peaks.some((p) => !p.ok)).toBe(true);
  });

  it("nennt die tatsächliche Personenzahl und die geforderte", () => {
    const abend = analysis.peakViolations
      .find((d) => d.date === "2026-08-01")!
      .peaks.find((p) => p.label === "Phục vụ chiều T6–CN" && !p.ok)!;
    expect(abend.minStaff).toBe(1); // so viele stehen wirklich da
    expect(abend.required).toBe(3);
  });

  it("accepts three service people throughout a Saturday evening", () => {
    const vier = analyzeSchedule({
      year: 2026,
      month: 8,
      workHours: DEFAULT_WORK_HOURS,
      employees: Array.from({ length: 3 }, (_, index) => emp(String(index), "TEILZEIT", 30)),
      shifts: Array.from({ length: 3 }, (_, index) => ({ ...shifts[0], id: `s${index}`, employeeId: String(index) })),
    });
    const tag = vier.days.find((d) => d.date === "2026-08-01")!;
    expect(tag.peaks.find((p) => p.label === "Phục vụ chiều T6–CN")!.ok).toBe(true);
  });

  it("counts a concrete pause as absent", () => {
    const paused = analyzeSchedule({
      year: 2026,
      month: 8,
      workHours: DEFAULT_WORK_HOURS,
      employees: Array.from({ length: 3 }, (_, index) => emp(String(index), "TEILZEIT", 30)),
      shifts: Array.from({ length: 3 }, (_, index) => ({
        ...shifts[0],
        id: `pause-${index}`,
        employeeId: String(index),
        ...(index === 0 ? { pauseStartMinutes: 18 * 60 } : {}),
      })),
    });
    const evening = paused.days.find((day) => day.date === "2026-08-01")!
      .peaks.find((peak) => peak.label === "Phục vụ chiều T6–CN")!;
    expect(evening.minStaff).toBe(2);
    expect(evening.ok).toBe(false);
  });
});

describe("Bereiche: Bếp, Phục vụ", () => {
  // 2026-09-01 ist ein Dienstag: Arbeitszeit 10:30–14:30 und 17:00–22:30, offen ab 11:00.
  const lunch = (id: string, start = 11 * 60): Shift => ({
    id: `l-${id}`, employeeId: id, date: "2026-09-01",
    startMinutes: start, endMinutes: 14 * 60 + 30, pauseMinutes: 0, paidMinutes: 14 * 60 + 30 - start,
    shiftType: "EARLY", generated: true,
  });
  const staff = (id: string, workRole?: Employee["workRole"]): Employee => ({ ...emp(id, "TEILZEIT", 20), workRole });
  const peaksOf = (employees: Employee[], shifts: Shift[]) =>
    analyzeSchedule({ year: 2026, month: 9, workHours: DEFAULT_WORK_HOURS, employees, shifts })
      .days.find((day) => day.date === "2026-09-01")!.peaks;

  it("Küche ab 10:30 (Vorbereitung, genau 1 Person), Service ab Öffnung 11:00", () => {
    const employees = [staff("k1", "KITCHEN"), staff("k2", "KITCHEN"), staff("s1", "SERVICE")];
    const peaks = peaksOf(employees, [lunch("k1", 10 * 60 + 30), lunch("k2", 10 * 60 + 30), lunch("s1")]);
    const kitchen = peaks.find((peak) => peak.label === "Bếp luôn có người" && peak.startMinutes < 15 * 60)!;
    expect(kitchen.startMinutes).toBe(10 * 60 + 30);
    expect(kitchen.ok).toBe(true);
    const service = peaks.find((peak) => peak.label === "Phục vụ luôn có người" && peak.startMinutes < 15 * 60)!;
    expect(service.startMinutes).toBe(11 * 60);
    expect(service.ok).toBe(true);
    const prep = peaks.find((peak) => peak.label === "Bếp chuẩn bị")!;
    expect([prep.startMinutes, prep.endMinutes]).toEqual([10 * 60 + 30, 11 * 60]);
    expect(prep.ok).toBe(false); // zwei statt einer Person
    const onePrep = peaksOf(employees, [lunch("k1", 10 * 60 + 30), lunch("k2"), lunch("s1")]);
    expect(onePrep.find((peak) => peak.label === "Bếp chuẩn bị")!.ok).toBe(true);
  });

  it("mittags 2 Phục vụ und 2 Bếp als weiche Vorgabe", () => {
    const employees = [staff("k1", "KITCHEN"), staff("s1", "SERVICE")];
    const peaks = peaksOf(employees, employees.map((e) => lunch(e.id)));
    const service = peaks.find((peak) => peak.label === "Phục vụ trưa T2–T5")!;
    expect([service.startMinutes, service.endMinutes]).toEqual([12 * 60, 14 * 60]);
    expect(service.required).toBe(2);
    expect(service.minStaff).toBe(1);
    expect(service.ok).toBe(false);
    expect(peaks.find((peak) => peak.label === "Bếp sáng")!.required).toBe(2);
  });

  it("zählt Personen ohne Bereich wie Phục vụ, aber nie wie Bếp", () => {
    const employees = [staff("k1", "KITCHEN"), staff("x")];
    const peaks = peaksOf(employees, employees.map((e) => lunch(e.id)));
    expect(peaks.find((peak) => peak.label === "Phục vụ luôn có người" && peak.startMinutes === 11 * 60)!.ok).toBe(true);
    expect(peaks.find((peak) => peak.label === "Bếp sáng")!.minStaff).toBe(1);
  });

  it("ohne Küchenpersonal bleibt die harte Küchenregel rot (Bếp luôn có người)", () => {
    const employees = [staff("s1", "SERVICE"), staff("s2")];
    const peaks = peaksOf(employees, employees.map((e) => lunch(e.id)));
    const kitchen = peaks.find((peak) => peak.label === "Bếp luôn có người" && peak.startMinutes < 15 * 60)!;
    expect(kitchen.ok).toBe(false);
    expect(peaks.some((peak) => peak.label === "Bếp sáng")).toBe(false);
  });
});
