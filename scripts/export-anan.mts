// Xuất lịch AnAn cho MỌI tháng trong bảng lương và kiểm từng quy tắc trên từng ô 30 phút.
// Chạy: npx vite-node scripts/export-anan.mts [thư mục ra]   (mặc định output/anan)
// Ra: <tháng>_Dienstplan.pdf, <tháng>_Stundenzettel.pdf, lich-tat-ca.csv, BAO-CAO.md
import fs from "node:fs";
import path from "node:path";
import { generateSchedule } from "../src/lib/scheduler";
import { ANAN_MISSING_MONTHS, ANAN_PAYROLL, ananRoster } from "../src/lib/ananPayroll";
import { DEFAULT_WORK_HOURS, resolveDay, effectiveWeekdayKey } from "../src/lib/workHours";
import { publicHolidays } from "../src/lib/holidays";
import { datesOfMonth } from "../src/lib/demand";
import { staffingWindows, staffGroupOf, workingAt, presentGroups, GROUP_LABEL_VI } from "../src/lib/staffing";
import { validateSchedule } from "../src/lib/validation";
import { calculatePause, minutesToTime } from "../src/lib/time";
import { weekStartOf } from "../src/lib/weeks";
import { maxConsecutiveRun } from "../src/lib/consecutive";
import { buildDienstplanPdf, buildStundenzettelPdf } from "../src/lib/pdf";
import { COMPANY_ADDRESS, COMPANY_NAME } from "../src/lib/company";
import type { Schedule, Shift } from "../src/types";

const outDir = process.argv[2] ?? "output/anan";
fs.mkdirSync(outDir, { recursive: true });
const hm = (minutes: number) => `${(minutes / 60).toFixed(2).replace(".", ",")}`;
const csv: string[] = ["thang;ngay;thu;nhan_vien;nhom;bat_dau;ket_thuc;nghi_phut;gio_tra"];
const report: string[] = [];
const summary: string[] = [
  "| Tháng | NV (Bếp/Phục vụ/Lái xe) | Ca | Giờ HĐ → xếp | Cứng: thiếu Bếp | Cứng: thiếu Phục vụ | Mềm thiếu (người×30′) | Luật | App |",
  "|---|---|---|---|---|---|---|---|---|",
];
const WD_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

for (const monthKey of Object.keys(ANAN_PAYROLL).sort()) {
  const [year, month] = monthKey.split("-").map(Number);
  const employees = ananRoster(monthKey);
  const byId = new Map(employees.map((e) => [e.id, e]));
  const holidays = publicHolidays(year);
  const shifts: Shift[] = generateSchedule({ year, month, workHours: DEFAULT_WORK_HOURS, employees, holidays });
  const present = presentGroups(employees);

  const hardMiss: Record<string, string[]> = { KITCHEN: [], SERVICE: [] };
  const softMiss: Record<string, number> = {};
  const legal: string[] = [];
  const openDates: string[] = [];
  for (const date of datesOfMonth(year, month)) {
    const day = resolveDay(DEFAULT_WORK_HOURS, date, holidays, {});
    const onDay = shifts.filter((s) => s.date === date);
    if (day.closed) continue;
    openDates.push(date);
    const weekday = effectiveWeekdayKey(date, holidays);
    // Quy tắc cứng kiểm theo nhóm THẬT (kể cả khi tháng đó không có ai trong nhóm).
    const hardGroups = [
      { group: "KITCHEN" as const, blocks: day.blocks },
      { group: "SERVICE" as const, blocks: day.blocks.map((b, i) => (i === 0 ? { ...b, startMinutes: b.startMinutes + 30 } : b)) },
    ];
    for (const { group, blocks } of hardGroups) {
      const gaps: string[] = [];
      for (const block of blocks) for (let m = block.startMinutes; m < block.endMinutes; m += 30) {
        const n = onDay.filter((s) => workingAt(s, m) && staffGroupOf(byId.get(s.employeeId)) === group).length;
        if (n === 0) gaps.push(minutesToTime(m));
      }
      if (gaps.length) hardMiss[group].push(`${date.slice(8)}. (${gaps.length}×30′: ${gaps[0]}${gaps.length > 1 ? `…${gaps[gaps.length - 1]}` : ""})`);
    }
    for (const w of staffingWindows(day.blocks, weekday, present)) {
      if (w.hard) continue;
      for (let m = w.startMinutes; m < w.endMinutes; m += 30) {
        const n = new Set(onDay.filter((s) => workingAt(s, m) && w.groups.includes(staffGroupOf(byId.get(s.employeeId)))).map((s) => s.employeeId)).size;
        if (n < w.minStaff) softMiss[w.label] = (softMiss[w.label] ?? 0) + w.minStaff - n;
        if (n > w.maxStaff) softMiss[`${w.label} (thừa)`] = (softMiss[`${w.label} (thừa)`] ?? 0) + n - w.maxStaff;
      }
    }
    const perEmp = new Map<string, Shift[]>();
    for (const s of onDay) perEmp.set(s.employeeId, [...(perEmp.get(s.employeeId) ?? []), s]);
    for (const [id, list] of perEmp) {
      const name = byId.get(id)!.name;
      const paid = list.reduce((a, s) => a + s.paidMinutes, 0);
      if (paid > 540) legal.push(`${date} ${name}: ${hm(paid)} h > 9 h`);
      for (const s of list) {
        if (s.pauseMinutes < calculatePause(s.paidMinutes)) legal.push(`${date} ${name}: thiếu giờ nghỉ`);
        if (!day.blocks.some((b) => s.startMinutes >= b.startMinutes && s.endMinutes <= b.endMinutes)) legal.push(`${date} ${name}: ca ngoài giờ làm`);
      }
    }
  }
  const planned = new Map<string, number>();
  for (const s of shifts) planned.set(s.employeeId, (planned.get(s.employeeId) ?? 0) + s.paidMinutes);
  for (const e of employees) {
    const own = shifts.filter((s) => s.employeeId === e.id);
    if (maxConsecutiveRun(new Set(own.map((s) => s.date))) > 6) legal.push(`${e.name}: > 6 ngày liên tiếp`);
    const weeks = new Map<string, Set<string>>();
    for (const s of own) weeks.set(weekStartOf(s.date), (weeks.get(weekStartOf(s.date)) ?? new Set()).add(s.date));
    for (const [w, d] of weeks) if (d.size > 6) legal.push(`${e.name}: tuần ${w} làm ${d.size} ngày`);
    if ((planned.get(e.id) ?? 0) > e.targetMinutes) legal.push(`${e.name}: vượt hợp đồng`);
  }
  const validation = validateSchedule(employees, shifts, year, openDates, DEFAULT_WORK_HOURS);
  const appErrors = validation.errors.filter((x) => x.severity === "error");

  // ── PDF ──
  const schedule: Schedule = {
    companyName: COMPANY_NAME, address: COMPANY_ADDRESS, year, month,
    workHours: DEFAULT_WORK_HOURS, dateOverrides: [], employees, shifts,
  };
  if (employees.length > 0) {
    // Eine Seite je Kalenderwoche (Mo–So, nur Tage dieses Monats) – wie der Wochenausdruck der App.
    const weeks = new Map<string, string[]>();
    for (const date of datesOfMonth(year, month)) weeks.set(weekStartOf(date), [...(weeks.get(weekStartOf(date)) ?? []), date]);
    let plan: ReturnType<typeof buildDienstplanPdf> | undefined;
    for (const dates of weeks.values()) {
      const de = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}.`;
      const title = `Woche ${de(dates[0])}–${de(dates[dates.length - 1])}${year}`;
      plan = buildDienstplanPdf(schedule, { dates, title, layout: "byEmployee" }, plan);
    }
    fs.writeFileSync(path.join(outDir, `${monthKey}_Dienstplan.pdf`), Buffer.from(plan!.output("arraybuffer")));
    const sheets = await buildStundenzettelPdf(schedule, employees);
    fs.writeFileSync(path.join(outDir, `${monthKey}_Stundenzettel.pdf`), Buffer.from(sheets.output("arraybuffer")));
  }
  for (const s of [...shifts].sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)) {
    const e = byId.get(s.employeeId)!;
    csv.push([monthKey, s.date, WD_VI[new Date(`${s.date}T12:00:00Z`).getUTCDay()], e.name, GROUP_LABEL_VI[staffGroupOf(e)],
      minutesToTime(s.startMinutes), minutesToTime(s.endMinutes), s.pauseMinutes, hm(s.paidMinutes)].join(";"));
  }

  const kitchen = employees.filter((e) => staffGroupOf(e) === "KITCHEN").length;
  const drivers = employees.filter((e) => staffGroupOf(e) === "DRIVER").length;
  const target = employees.reduce((a, e) => a + e.targetMinutes, 0);
  const total = shifts.reduce((a, s) => a + s.paidMinutes, 0);
  const softTotal = Object.values(softMiss).reduce((a, b) => a + b, 0);
  summary.push(`| ${monthKey} | ${employees.length} (${kitchen}/${employees.length - kitchen - drivers}/${drivers}) | ${shifts.length} | ${hm(target)} → ${hm(total)} | ${hardMiss.KITCHEN.length} ngày | ${hardMiss.SERVICE.length} ngày | ${softTotal} | ${legal.length ? `✗ ${legal.length}` : "✓"} | ${appErrors.length ? `✗ ${appErrors.length}` : "✓"} |`);

  report.push(`## ${monthKey}`, "");
  if (employees.length === 0) { report.push("Không có dữ liệu bảng lương.", ""); continue; }
  report.push("| Nhân viên | Nhóm | Loại | Giờ HĐ | Đã xếp | Số ngày |", "|---|---|---|---|---|---|");
  for (const e of employees) {
    const days = new Set(shifts.filter((s) => s.employeeId === e.id).map((s) => s.date)).size;
    const note = [e.startDate && `vào ${e.startDate}`, e.endDate && `nghỉ sau ${e.endDate}`].filter(Boolean).join(", ");
    report.push(`| ${e.name}${note ? ` (${note})` : ""} | ${GROUP_LABEL_VI[staffGroupOf(e)]} | ${e.employmentType} | ${hm(e.targetMinutes)} | ${hm(planned.get(e.id) ?? 0)} | ${days} |`);
  }
  report.push("");
  for (const group of ["KITCHEN", "SERVICE"] as const) {
    report.push(`- **Cứng – thiếu ${GROUP_LABEL_VI[group]}:** ${hardMiss[group].length ? hardMiss[group].join(", ") : "không"}`);
  }
  report.push(`- **Mềm – thiếu (người × 30′):** ${Object.entries(softMiss).map(([k, v]) => `${k} ${v}`).join(" · ") || "không"}`);
  report.push(`- **Luật lao động / hợp đồng:** ${legal.length ? legal.slice(0, 10).join("; ") + (legal.length > 10 ? ` … (+${legal.length - 10})` : "") : "đạt"}`);
  report.push(`- **Kiểm tra trong app:** ${appErrors.length ? appErrors.slice(0, 5).map((x) => x.message).join("; ") : "Hợp lệ"}`, "");
  console.log(`${monthKey}: ${shifts.length} ca, cứng bếp ${hardMiss.KITCHEN.length}d phục vụ ${hardMiss.SERVICE.length}d, mềm ${softTotal}, luật ${legal.length}, app ${appErrors.length}`);
}

fs.writeFileSync(path.join(outDir, "lich-tat-ca.csv"), "﻿" + csv.join("\r\n"));
fs.writeFileSync(path.join(outDir, "BAO-CAO.md"), [
  "# Restaurant AnAn – kiểm tra lịch 06/2023–12/2024", "",
  "Mỗi tháng tạo lịch bằng đúng thuật toán của app, đội theo bảng lương tháng đó.",
  "Cứng = luôn có ≥ 1 Bếp (từ 30′ chuẩn bị) và ≥ 1 Phục vụ (từ giờ mở). Mềm = số người quy định từng buổi (gồm lái xe).", "",
  ...summary, "",
  "**Không xuất (bảng lương thiếu giờ):**", "",
  ...Object.entries(ANAN_MISSING_MONTHS).map(([month, note]) => `- ${month}: ${note}`), "",
  ...report,
].join("\n"));
console.log(`→ ${outDir}`);
