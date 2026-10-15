import { describe, expect, it } from "vitest";
import { clampScheduleYear, isScheduleYearAllowed, SCHEDULE_YEARS, SCHEDULE_YEAR_RANGE_LABEL } from "../years";

describe("Năm được phép xếp/in lịch (AnAn & Anji: 2023–2027)", () => {
  it("chỉ gồm 2023 đến 2027", () => {
    expect(SCHEDULE_YEARS).toEqual([2023, 2024, 2025, 2026, 2027]);
    expect(SCHEDULE_YEAR_RANGE_LABEL).toBe("2023–2027");
  });

  it("chặn năm ngoài khoảng", () => {
    expect(isScheduleYearAllowed(2023)).toBe(true);
    expect(isScheduleYearAllowed(2027)).toBe(true);
    expect(isScheduleYearAllowed(2022)).toBe(false);
    expect(isScheduleYearAllowed(2028)).toBe(false);
    expect(isScheduleYearAllowed(2024.5)).toBe(false);
  });

  it("đưa năm về khoảng cho phép", () => {
    expect(clampScheduleYear(2020)).toBe(2023);
    expect(clampScheduleYear(2025)).toBe(2025);
    expect(clampScheduleYear(2035)).toBe(2027);
    expect(clampScheduleYear(Number.NaN)).toBe(2023);
  });
});
