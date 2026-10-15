// ============================================================================
// Năm được phép xếp và in lịch – checklist nghiệm thu mục G:
// AnAn & Anji: 2023–2027 (chủ quán yêu cầu – gồm cả 2023/2024 của bảng lương).
// Dùng chung cho popup Tạo lịch, ô Năm trong Cài đặt, hàm generate và nút Xuất PDF.
// ============================================================================

export const FIRST_SCHEDULE_YEAR = 2023;
export const LAST_SCHEDULE_YEAR = 2027;

export const SCHEDULE_YEARS: readonly number[] = Array.from(
  { length: LAST_SCHEDULE_YEAR - FIRST_SCHEDULE_YEAR + 1 },
  (_, index) => FIRST_SCHEDULE_YEAR + index,
);

export const SCHEDULE_YEAR_RANGE_LABEL = `${FIRST_SCHEDULE_YEAR}–${LAST_SCHEDULE_YEAR}`;

export function isScheduleYearAllowed(year: number): boolean {
  return Number.isInteger(year) && year >= FIRST_SCHEDULE_YEAR && year <= LAST_SCHEDULE_YEAR;
}

/** Năm gần nhất trong khoảng cho phép – giá trị mặc định của popup. */
export function clampScheduleYear(year: number): number {
  if (!Number.isFinite(year)) return FIRST_SCHEDULE_YEAR;
  return Math.min(LAST_SCHEDULE_YEAR, Math.max(FIRST_SCHEDULE_YEAR, Math.trunc(year)));
}
