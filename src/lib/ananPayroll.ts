// Bảng lương AnAn (Anw.-Std. = giờ hợp đồng tháng), theo dữ liệu chủ quán gửi.
// Dùng cho đội mẫu (sampleData.ts), test và scripts/export-anan.mts.
import { payrollDays } from "./payrollDays";
import type { Employee, WorkRole } from "../types";

export type PayrollEntry = { name: string; hours: number; startDate?: string; endDate?: string };

const e = (name: string, hours: number, extra: Partial<PayrollEntry> = {}): PayrollEntry => ({ name, hours, ...extra });

/** Bộ phận theo danh sách chủ quán gửi. */
export const ANAN_ROLES: Record<string, WorkRole> = {
  "Anh Tuan Pham": "KITCHEN",
  "Asghar Naveed": "DRIVER",
  "Bao Long Nguyen": "SERVICE",
  "Cong Tri Duong": "KITCHEN",
  // „Service + Lái xe": app chỉ có một nhóm mỗi người – xếp Phục vụ vì nhóm này thiếu giờ nhất.
  "Duc Tuan Tran": "SERVICE",
  "Duy Tan Nguyen": "KITCHEN",
  "Hiep Doan": "DRIVER",
  "Hoa Bang Dao": "KITCHEN",
  "Hong Son Le": "DRIVER",
  "Huy Nam Nguyen": "DRIVER",
  "Ngoc Dat Doan": "KITCHEN",
  "Quoc Dung Nguyen": "DRIVER",
  "Thanh Tam Le": "KITCHEN",
  "Thi Kieu Hoa Tran": "SERVICE",
  "Thi Kim Ngan Nguyen": "SERVICE",
  "Thi Kim Ngan Vu": "SERVICE",
  "Thi Ky Duyen Nguyen": "SERVICE",
  "Thi Thuy Nhu": "KITCHEN",
  "Trung Dung Duong": "DRIVER",
  "Truong Son Cao": "DRIVER",
  "Van Hao Nguyen": "KITCHEN",
  "Van Hau Hoang": "SERVICE",
  "Van Nham Pham": "KITCHEN",
  "Van Trang Tran": "KITCHEN",
};

/** Azubi/Service theo danh sách chủ quán. */
export const ANAN_AZUBI = new Set(["Bao Long Nguyen", "Thi Kim Ngan Vu", "Thi Ky Duyen Nguyen", "Van Hau Hoang"]);

const MID_2023 = [
  e("Asghar Naveed", 42.5), e("Bao Long Nguyen", 173.81), e("Hiep Doan", 80), e("Hoa Bang Dao", 173.81),
  e("Ngoc Dat Doan", 173.81), e("Thi Kieu Hoa Tran", 50),
];
const TEAM_2024_06 = [
  e("Cong Tri Duong", 173.81), e("Duc Tuan Tran", 43.51), e("Hiep Doan", 73.94), e("Thanh Tam Le", 173.81),
  e("Thi Kim Ngan Vu", 173.81), e("Thi Thuy Nhu", 173.81), e("Trung Dung Duong", 43.51), e("Van Hao Nguyen", 39),
];
const LATE_2024 = [
  e("Anh Tuan Pham", 173.81), ...TEAM_2024_06, e("Van Trang Tran", 173.81),
  e("Huy Nam Nguyen", 28.2), e("Quoc Dung Nguyen", 28.2),
];

/**
 * Khoá "yyyy-MM". Tháng 12/2023 không có dòng giờ/ngày, tháng 04/2024 chỉ có
 * 1 dòng – cả hai thiếu dữ liệu nên không có ở đây (xem ANAN_MISSING_MONTHS).
 */
export const ANAN_PAYROLL: Record<string, PayrollEntry[]> = {
  "2023-06": [
    ...MID_2023, e("Thi Kim Ngan Nguyen", 173.81), e("Truong Son Cao", 50), e("Van Hau Hoang", 173.36),
  ],
  "2023-07": [
    ...MID_2023, e("Thi Kim Ngan Vu", 173.81), e("Truong Son Cao", 1.67, { endDate: "2023-07-01" }), e("Van Hau Hoang", 173.36),
  ],
  "2023-08": [
    ...MID_2023.map((x) => (x.name === "Thi Kieu Hoa Tran" ? e(x.name, 50, { endDate: "2023-08-31" }) : x)),
    e("Thi Kim Ngan Vu", 173.81), e("Van Hau Hoang", 173.36),
  ],
  "2023-09": [
    e("Asghar Naveed", 42.5, { endDate: "2023-09-30" }), e("Bao Long Nguyen", 173.81), e("Hiep Doan", 80),
    e("Hoa Bang Dao", 173.81), e("Ngoc Dat Doan", 52.14, { endDate: "2023-09-09" }), e("Thi Kim Ngan Vu", 173.81),
    e("Van Hau Hoang", 173.36),
  ],
  "2023-10": [
    e("Bao Long Nguyen", 173.81), e("Hiep Doan", 80), e("Hoa Bang Dao", 173.81), e("Thi Kim Ngan Vu", 173.81),
    e("Trung Dung Duong", 173.81, { startDate: "2023-10-01" }), e("Van Hau Hoang", 173.36),
    e("Van Nham Pham", 92.7, { startDate: "2023-10-16" }),
  ],
  "2023-11": [
    e("Bao Long Nguyen", 173.81), e("Duy Tan Nguyen", 156.43, { startDate: "2023-11-04" }), e("Hiep Doan", 80),
    e("Hoa Bang Dao", 28.97, { endDate: "2023-11-05" }), e("Thi Kim Ngan Vu", 173.81), e("Trung Dung Duong", 173.81),
    e("Van Hau Hoang", 173.36), e("Van Nham Pham", 173.81),
  ],
  "2024-01": [
    e("Bao Long Nguyen", 173.81), e("Cong Tri Duong", 173.81), e("Hiep Doan", 80), e("Thanh Tam Le", 173.81),
    e("Thi Kim Ngan Vu", 173.81), e("Trung Dung Duong", 173.81), e("Van Hau Hoang", 173.36), e("Van Nham Pham", 173.81),
  ],
  "2024-02": [
    e("Bao Long Nguyen", 69.52, { endDate: "2024-02-12" }), e("Cong Tri Duong", 173.81), e("Hiep Doan", 80),
    e("Thanh Tam Le", 173.81), e("Thi Kim Ngan Vu", 173.81), e("Thi Ky Duyen Nguyen", 46.35, { startDate: "2024-02-22" }),
    e("Trung Dung Duong", 173.81), e("Van Hau Hoang", 173.36, { endDate: "2024-02-29" }),
    e("Van Nham Pham", 173.81, { endDate: "2024-02-29" }),
  ],
  "2024-03": [
    e("Cong Tri Duong", 173.81), e("Hiep Doan", 73.94), e("Thanh Tam Le", 173.81), e("Thi Kim Ngan Vu", 173.81),
    e("Thi Ky Duyen Nguyen", 173.81), e("Trung Dung Duong", 80),
  ],
  "2024-05": TEAM_2024_06,
  "2024-06": [...TEAM_2024_06, e("Van Trang Tran", 92.7, { startDate: "2024-06-15" })],
  "2024-07": [...TEAM_2024_06, e("Van Trang Tran", 173.81)],
  "2024-08": [...TEAM_2024_06, e("Van Trang Tran", 173.81), e("Anh Tuan Pham", 17.38, { startDate: "2024-08-29" })],
  "2024-09": [...TEAM_2024_06, e("Van Trang Tran", 173.81), e("Anh Tuan Pham", 173.81)],
  "2024-10": [
    ...LATE_2024.map((x) => (x.name === "Quoc Dung Nguyen" ? e(x.name, 27.26, { startDate: "2024-10-03" }) : x)),
    e("Hong Son Le", 173.81, { startDate: "2024-10-01", endDate: "2024-10-31" }),
  ],
  "2024-11": LATE_2024,
  "2024-12": [...LATE_2024, e("Ngoc Dat Doan", 92.7, { startDate: "2024-12-16" })],
};

/** Tháng có trong bảng lương nhưng thiếu số giờ – không xếp được lịch. */
export const ANAN_MISSING_MONTHS: Record<string, string> = {
  "2023-12": "Không có dòng giờ/ngày trong bộ file (Duy Tan Nguyen nghỉ 04.12., Thanh Tam Le vào 12.12., Cong Tri Duong vào 14.12.).",
  "2024-04": "Chỉ có 1 dòng (Thi Ky Duyen Nguyen 173,81 h, nghỉ 30.04.); Thi Thuy Nhu, Van Hao Nguyen, Duc Tuan Tran vào trong tháng nhưng không có giờ.",
};

/** Azubi giữ loại Azubi; ≥ 150 h toàn thời gian (cả tháng vào/nghỉ giữa chừng); > 50 h bán thời gian; còn lại Minijob. */
const FULL_TIME = new Set(
  Object.values(ANAN_PAYROLL).flat().filter((entry) => entry.hours >= 150).map((entry) => entry.name),
);

export function ananEmploymentType(entry: PayrollEntry): Employee["employmentType"] {
  if (ANAN_AZUBI.has(entry.name)) return "AZUBI";
  const partial = entry.startDate != null || entry.endDate != null;
  if (entry.hours >= 150 || (partial && FULL_TIME.has(entry.name))) return "VOLLZEIT";
  return entry.hours > 50 ? "TEILZEIT" : "MINIJOB";
}

export const ananEmployeeId = (name: string) => `an-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`;

/** Đội của một tháng theo bảng lương ("yyyy-MM"); [] nếu tháng đó không có dữ liệu. */
/**
 * Anw.-Tage der Lohnabrechnung = 21,67 = 5 Tage × 52 Wochen ÷ 12 Monate: das
 * Lohnbüro rechnet mit einer 5-Tage-Woche. Die Pläne aus der Lohnabrechnung
 * halten deshalb höchstens 5 Arbeitstage je Woche ein (sonst 26 statt ~22 Tage).
 */
export const PAYROLL_DAYS_PER_WEEK = 5;

export function ananRoster(monthKey: string): Employee[] {
  return (ANAN_PAYROLL[monthKey] ?? []).map((entry) => ({
    id: ananEmployeeId(entry.name),
    name: entry.name,
    employmentType: ananEmploymentType(entry),
    targetMinutes: Math.round(entry.hours * 60),
    workRole: ANAN_ROLES[entry.name],
    maxDaysPerWeek: PAYROLL_DAYS_PER_WEEK,
    daysPerMonth: payrollDays("anan", monthKey, entry.name),
    ...(entry.startDate ? { startDate: entry.startDate } : {}),
    ...(entry.endDate ? { endDate: entry.endDate } : {}),
  }));
}
