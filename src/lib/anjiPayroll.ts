// Bảng lương Anji (Anw.-Std. = giờ hợp đồng tháng), theo dữ liệu chủ quán gửi.
// Dùng cho đội mẫu (sampleData.ts), test và scripts/export-anji.mts.
import type { Employee } from "../types";
import { payrollDays } from "./payrollDays";

export type PayrollEntry = { name: string; hours: number; startDate?: string; endDate?: string };


const e = (name: string, hours: number, extra: Partial<PayrollEntry> = {}): PayrollEntry => ({ name, hours, ...extra });

/**
 * Khoá "yyyy-MM" – theo „AnAn_Anji_BangLuong_ChamCong_2023_2024.pdf" (Anw.-Std.
 * cuối cùng sau điều chỉnh; tháng bị huỷ = 0 h thì bỏ), đã đối chiếu với từng
 * phiếu lương gốc. Thêm 12/2023 Ha Phuong Nguyen 32,45 h (có phiếu lương, bản
 * tổng hợp thiếu). Tháng thiếu bảng lương không xếp lịch: xem ANJI_MISSING_MONTHS.
 */
export const ANJI_PAYROLL: Record<string, PayrollEntry[]> = {
  "2023-05": [
    e("Dinh Van Pham", 173.81), e("Duc Tuan Nguyen", 173.81), e("Huu Tho Pham", 158.33),
    e("Quoc Dat Nguyen", 173.81), e("Rdwan Salim Hadeedah", 117), e("The Buong Nguyen", 169.72),
    e("Thi Mo Nguyen", 173.81), e("Thi Thuy Linh Nguyen", 173.81), e("Thi Thuy Nhu", 169.72),
    e("Truong Thai Nguyen", 52.14, { startDate: "2023-05-23" }), e("Van Quyet Hoang", 173.81),
    e("Xuan Chi Dong", 173.81),
  ],
  "2023-06": [
    e("Dinh Van Pham", 173.81, { endDate: "2023-06-30" }), e("Duc Tuan Nguyen", 173.81),
    e("Huu Tho Pham", 158.33), e("Quoc Dat Nguyen", 173.81),
    e("Rdwan Salim Hadeedah", 117, { endDate: "2023-06-30" }), e("The Buong Nguyen", 169.72),
    e("Thi Mo Nguyen", 173.81), e("Thi Thuy Linh Nguyen", 173.81), e("Thi Thuy Nhu", 169.72),
    e("Truong Thai Nguyen", 173.81), e("Van Quyet Hoang", 173.81), e("Xuan Chi Dong", 173.81),
  ],
  "2023-07": [
    e("Duc Tuan Nguyen", 173.81), e("Huu Tho Pham", 158.33), e("Quoc Dat Nguyen", 173.81),
    e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 173.81), e("Thi Thuy Linh Nguyen", 173.81),
    e("Thi Thuy Nhu", 169.72), e("Truong Thai Nguyen", 173.81), e("Van Quyet Hoang", 173.81),
    e("Xuan Chi Dong", 173.81),
  ],
  "2023-08": [
    e("Duc Tuan Nguyen", 91), e("Huu Tho Pham", 158.33), e("Quoc Dat Nguyen", 173.81),
    e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 173.81), e("Thi Thuy Linh Nguyen", 173.81),
    e("Thi Thuy Nhu", 169.72), e("Truong Thai Nguyen", 173.81), e("Van Quyet Hoang", 173.81),
    e("Xuan Chi Dong", 173.81),
  ],
  "2023-09": [
    e("Duc Tuan Nguyen", 91), e("Huu Tho Pham", 158.33), e("Quoc Dat Nguyen", 173.81),
    e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 173.81), e("Thi Thuy Linh Nguyen", 173.81),
    e("Thi Thuy Nhu", 169.72), e("Truong Thai Nguyen", 173.81), e("Van Quyet Hoang", 173.81),
    e("Xuan Chi Dong", 173.81),
  ],
  "2023-10": [
    e("Duc Tuan Nguyen", 91), e("Huu Tho Pham", 158.33), e("Quoc Dat Nguyen", 173.81),
    e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 173.81), e("Thi Thuy Linh Nguyen", 173.81),
    e("Thi Thuy Nhu", 169.72), e("Truong Thai Nguyen", 173.81), e("Van Quyet Hoang", 173.81),
    e("Xuan Chi Dong", 173.81),
  ],
  "2023-12": [
    e("Duc Tuan Nguyen", 91), e("Ha Phuong Nguyen", 32.45, { startDate: "2023-12-21" }),
    e("Huu Tho Pham", 158.33), e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 83.33),
    e("Thi Thuy Linh Nguyen", 173.81), e("Thi Thuy Nhu", 169.72), e("Truong Thai Nguyen", 173.81),
    e("Van Quyet Hoang", 173.81), e("Xuan Chi Dong", 173.81),
  ],
  "2024-02": [
    e("Duc Tuan Nguyen", 91), e("Ha Phuong Nguyen", 88.5), e("Quang Tien La", 88.5),
    e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 83.33), e("Thi Thuy Linh Nguyen", 173.81),
    e("Thi Thuy Nhu", 169.72), e("Thu Huong Nguyen", 84.5), e("Tien Viet Pham", 88.5),
    e("Truong Thai Nguyen", 173.81),
  ],
  "2024-03": [
    e("Duc Tuan Nguyen", 91), e("Ha Phuong Nguyen", 88.5),
    e("Hong Son Le", 168.02, { startDate: "2024-03-03" }), e("Quang Tien La", 88.5),
    e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 83.33), e("Thi Thuy Linh Nguyen", 173.81),
    e("Thi Thuy Nhu", 169.72, { endDate: "2024-03-31" }), e("Thu Huong Nguyen", 84.5),
    e("Tien Viet Pham", 88.5), e("Truong Thai Nguyen", 173.81),
  ],
  "2024-04": [
    e("Duc Thinh Nguyen", 81.11, { startDate: "2024-04-17" }), e("Duc Tuan Nguyen", 88.19),
    e("Ha Phuong Nguyen", 88.5), e("Hong Son Le", 173.81),
    e("Huy Nam Nguyen", 105.83, { startDate: "2024-04-06" }), e("Quang Tien La", 88.5),
    e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 80.5), e("Thi Thuy Linh Nguyen", 62.37),
    e("Thu Huong Nguyen", 84.5), e("Tien Viet Pham", 88.5),
    e("Truong Thai Nguyen", 98.49, { endDate: "2024-04-17" }),
  ],
  "2024-06": [
    e("Duc Thinh Nguyen", 44.31), e("Duc Tuan Nguyen", 88.19), e("Ha Phuong Nguyen", 88.5),
    e("Hong Son Le", 173.81), e("Huy Nam Nguyen", 127), e("Quang Tien La", 88.5),
    e("Quoc Dat Nguyen", 168.02, { startDate: "2024-06-02" }), e("The Buong Nguyen", 169.72),
    e("Thi Mo Nguyen", 80.5), e("Thu Huong Nguyen", 84.5), e("Tien Viet Pham", 88.5),
  ],
  "2024-08": [
    e("Duc Thinh Nguyen", 44.31), e("Duc Tuan Nguyen", 88.19), e("Ha Phuong Nguyen", 88.5),
    e("Huy Nam Nguyen", 127), e("Quang Tien La", 88.5), e("Quoc Dat Nguyen", 173.81),
    e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 80.5), e("Thu Huong Nguyen", 84.5),
  ],
  "2024-09": [
    e("Duc Thinh Nguyen", 44.31), e("Duc Tuan Nguyen", 88.19), e("Ha Phuong Nguyen", 88.5),
    e("Huy Nam Nguyen", 127), e("Quang Tien La", 88.5), e("Quoc Dat Nguyen", 173.81),
    e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 80.5), e("Thu Huong Nguyen", 84.5),
  ],
  "2024-10": [
    e("Duc Thinh Nguyen", 44.31), e("Duc Tuan Nguyen", 88.19), e("Ha Phuong Nguyen", 88.5),
    e("Huy Nam Nguyen", 127), e("Quang Tien La", 88.5), e("Quoc Dat Nguyen", 173.81),
    e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 80.5), e("Thi Thah Huong Vi", 173.81),
    e("Thu Huong Nguyen", 84.5),
  ],
  "2024-11": [
    e("Duc Thinh Nguyen", 44.31), e("Duc Tuan Nguyen", 88.19), e("Ha Phuong Nguyen", 88.5),
    e("Huy Nam Nguyen", 127), e("Quang Tien La", 88.5), e("Quoc Dat Nguyen", 173.81),
    e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 80.5), e("Thi Thah Huong Vi", 173.81),
    e("Thu Huong Nguyen", 84.5),
  ],
  "2024-12": [
    e("Duc Thinh Nguyen", 44.31), e("Duc Tuan Nguyen", 88.19), e("Ha Phuong Nguyen", 88.5),
    e("Huy Nam Nguyen", 127), e("Quang Tien La", 88.5), e("Quoc Dat Nguyen", 173.81),
    e("The Buong Nguyen", 169.72), e("Thi Mo Nguyen", 80.5), e("Thi Thah Huong Vi", 173.81),
    e("Thu Huong Nguyen", 84.5),
  ],
};

/** Tháng thiếu bảng lương – không xếp lịch, không xuất (như ANAN_MISSING_MONTHS). */
export const ANJI_MISSING_MONTHS: Record<string, string> = {
  "2023-11": "Không có bảng lương tháng 11; chỉ có điều chỉnh in kèm 12/2023 (Quoc Dat Nguyen 173,81 h, nghỉ 30.11.; Thi Thuy Nhu 169,72 h).",
  "2024-01": "Không có bảng lương tháng 1; chỉ có điều chỉnh in kèm 02/2024 (3 Azubi Bồi: Ha Phuong Nguyen 88,5 h, Quang Tien La 47,2 h, Tien Viet Pham 44,25 h) – không có Bếp.",
  "2024-05": "Không có bảng lương tháng 5; chỉ có điều chỉnh in kèm 06/2024 (Thi Thuy Linh Nguyen 31,18 h, nghỉ 15.05.).",
  "2024-07": "Không có bảng lương tháng 7 trong bộ file.",
};

/** Bếp theo danh sách chủ quán gửi; mọi người còn lại là Bồi (Service). */
export const ANJI_KITCHEN = new Set([
  "Dinh Van Pham", "Huu Tho Pham", "Quoc Dat Nguyen", "The Buong Nguyen", "Thi Mo Nguyen",
  "Thi Thuy Nhu", "Truong Thai Nguyen", "Van Quyet Hoang", "Hong Son Le", "Duc Thinh Nguyen",
]);

/** Azubi (Bồi) theo danh sách chủ quán – giờ tháng lấy theo bảng lương. */
export const ANJI_AZUBI = new Set(["Ha Phuong Nguyen", "Quang Tien La", "Tien Viet Pham"]);

/** Người có tháng ≥ 150 h là toàn thời gian; tháng vào/nghỉ giữa chừng vẫn giữ loại đó. */
const FULL_TIME = new Set(
  Object.values(ANJI_PAYROLL).flat().filter((entry) => entry.hours >= 150).map((entry) => entry.name),
);

export function anjiEmploymentType(entry: PayrollEntry): Employee["employmentType"] {
  if (ANJI_AZUBI.has(entry.name)) return "AZUBI";
  const partial = entry.startDate != null || entry.endDate != null;
  return entry.hours >= 150 || (partial && FULL_TIME.has(entry.name)) ? "VOLLZEIT" : "TEILZEIT";
}

export const anjiEmployeeId = (name: string) => `aj-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`;

/** Đội của một tháng theo bảng lương ("yyyy-MM"); [] nếu tháng đó không có dữ liệu. */
export function anjiRoster(monthKey: string): Employee[] {
  return (ANJI_PAYROLL[monthKey] ?? []).map((entry) => ({
    id: anjiEmployeeId(entry.name),
    name: entry.name,
    employmentType: anjiEmploymentType(entry),
    targetMinutes: Math.round(entry.hours * 60),
    workRole: ANJI_KITCHEN.has(entry.name) ? "KITCHEN" : "SERVICE",
    daysPerMonth: payrollDays("anji", monthKey, entry.name),
    ...(entry.startDate ? { startDate: entry.startDate } : {}),
    ...(entry.endDate ? { endDate: entry.endDate } : {}),
  }));
}
