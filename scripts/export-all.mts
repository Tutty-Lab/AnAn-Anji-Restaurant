// Xuất lịch AnAn + Anji cho MỌI tháng trong hai bảng lương, đúng như nút „Tạo lịch"
// của app: hai quán lần lượt (AnAn rồi Anji), người làm cả hai quán không bị xếp
// hai quán trong cùng một ngày. Kiểm từng quy tắc trên từng ô 30 phút.
// Chạy: npx vite-node scripts/export-all.mts [thư mục ra]   (mặc định output)
// Ra: <thư mục>/<anan|anji>/<tháng>_Dienstplan.pdf, <tháng>_Stundenzettel.pdf,
//     lich-tat-ca.csv, BAO-CAO.md; <thư mục>/NGUOI-LAM-2-QUAN.md
import fs from "node:fs";
import path from "node:path";
import { generateSchedule } from "../src/lib/scheduler";
import { ANAN_MISSING_MONTHS } from "../src/lib/ananPayroll";
import { payrollMonths, storeRoster } from "../src/lib/stores";
import { DEFAULT_WORK_HOURS, resolveDay, effectiveWeekdayKey } from "../src/lib/workHours";
import { publicHolidays } from "../src/lib/holidays";
import { datesOfMonth } from "../src/lib/demand";
import { STORE_PROFILES, staffingWindows, staffGroupOf, workingAt, presentGroups, type StoreProfile } from "../src/lib/staffing";
import { crossStoreConflicts, crossStoreRunIssues, planAcrossStores } from "../src/lib/sharedPerson";
import { validateSchedule } from "../src/lib/validation";
import { calculatePause, minutesToTime } from "../src/lib/time";
import { weekStartOf } from "../src/lib/weeks";
import { maxConsecutiveRun } from "../src/lib/consecutive";
import { buildDienstplanPdf, buildStundenzettelPdf } from "../src/lib/pdf";
import type { Employee, Schedule, Shift } from "../src/types";

const baseDir = process.argv[2] ?? "output";
const hm = (minutes: number) => `${(minutes / 60).toFixed(2).replace(".", ",")}`;
const WD_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MISSING: Record<string, Record<string, string>> = { anan: ANAN_MISSING_MONTHS, anji: {} };

type Acc = { csv: string[]; report: string[]; summary: string[]; months: string[] };
const acc: Record<string, Acc> = Object.fromEntries(STORE_PROFILES.map((profile) => {
  const label = profile.groupLabels;
  const roles = profile.workRoles.map((role) => label[role]).join("/");
  return [profile.id, {
    csv: ["thang;ngay;thu;nhan_vien;nhom;bat_dau;ket_thuc;nghi_phut;gio_tra"],
    report: [],
    summary: [
      `| Tháng | NV (${roles}) | Ca | Giờ HĐ → xếp | Cứng: thiếu Bếp | Cứng: thiếu ${label.SERVICE} | Mềm thiếu (người×30′) | Luật | App |`,
      "|---|---|---|---|---|---|---|---|---|",
    ],
    months: [],
  }];
}));
const shared: string[] = [];

async function reportStore(profile: StoreProfile, monthKey: string, employees: Employee[], shifts: Shift[]) {
  const a = acc[profile.id];
  const outDir = path.join(baseDir, profile.id);
  fs.mkdirSync(outDir, { recursive: true });
  const label = profile.groupLabels;
  const [year, month] = monthKey.split("-").map(Number);
  const byId = new Map(employees.map((e) => [e.id, e]));
  const holidays = publicHolidays(year);
  const present = presentGroups(employees);
  a.months.push(monthKey);

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
    for (const w of staffingWindows(day.blocks, weekday, present, profile)) {
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
      const paid = list.reduce((sum, s) => sum + s.paidMinutes, 0);
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
  const validation = validateSchedule(employees, shifts, year, openDates, DEFAULT_WORK_HOURS, profile.dayWeights);
  const appErrors = validation.errors.filter((x) => x.severity === "error");

  // ── PDF: eine Seite je Kalenderwoche – wie der Wochenausdruck der App ──
  const schedule: Schedule = {
    companyName: profile.name, address: profile.address, year, month,
    workHours: DEFAULT_WORK_HOURS, dateOverrides: [], employees, shifts,
  };
  if (employees.length > 0) {
    const weeks = new Map<string, string[]>();
    for (const date of datesOfMonth(year, month)) weeks.set(weekStartOf(date), [...(weeks.get(weekStartOf(date)) ?? []), date]);
    let plan: ReturnType<typeof buildDienstplanPdf> | undefined;
    for (const dates of weeks.values()) {
      const de = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}.`;
      plan = buildDienstplanPdf(schedule, { dates, title: `Woche ${de(dates[0])}–${de(dates[dates.length - 1])}${year}`, layout: "byEmployee" }, plan);
    }
    fs.writeFileSync(path.join(outDir, `${monthKey}_Dienstplan.pdf`), Buffer.from(plan!.output("arraybuffer")));
    const sheets = await buildStundenzettelPdf(schedule, employees);
    fs.writeFileSync(path.join(outDir, `${monthKey}_Stundenzettel.pdf`), Buffer.from(sheets.output("arraybuffer")));
  }
  for (const s of [...shifts].sort((x, y) => x.date.localeCompare(y.date) || x.startMinutes - y.startMinutes)) {
    const e = byId.get(s.employeeId)!;
    a.csv.push([monthKey, s.date, WD_VI[new Date(`${s.date}T12:00:00Z`).getUTCDay()], e.name, label[staffGroupOf(e)],
      minutesToTime(s.startMinutes), minutesToTime(s.endMinutes), s.pauseMinutes, hm(s.paidMinutes)].join(";"));
  }

  const count = (group: string) => employees.filter((e) => staffGroupOf(e) === group).length;
  const counts = profile.workRoles.map(count).join("/");
  const target = employees.reduce((sum, e) => sum + e.targetMinutes, 0);
  const total = shifts.reduce((sum, s) => sum + s.paidMinutes, 0);
  const softTotal = Object.values(softMiss).reduce((x, y) => x + y, 0);
  a.summary.push(`| ${monthKey} | ${employees.length} (${counts}) | ${shifts.length} | ${hm(target)} → ${hm(total)} | ${hardMiss.KITCHEN.length} ngày | ${hardMiss.SERVICE.length} ngày | ${softTotal} | ${legal.length ? `✗ ${legal.length}` : "✓"} | ${appErrors.length ? `✗ ${appErrors.length}` : "✓"} |`);

  a.report.push(`## ${monthKey}`, "");
  a.report.push("| Nhân viên | Nhóm | Loại | Giờ HĐ | Đã xếp | Số ngày |", "|---|---|---|---|---|---|");
  for (const e of employees) {
    const days = new Set(shifts.filter((s) => s.employeeId === e.id).map((s) => s.date)).size;
    const note = [e.startDate && `vào ${e.startDate}`, e.endDate && `nghỉ sau ${e.endDate}`, e.personKey && "làm cả 2 quán"].filter(Boolean).join(", ");
    a.report.push(`| ${e.name}${note ? ` (${note})` : ""} | ${label[staffGroupOf(e)]} | ${e.employmentType} | ${hm(e.targetMinutes)} | ${hm(planned.get(e.id) ?? 0)} | ${days} |`);
  }
  a.report.push("");
  for (const group of ["KITCHEN", "SERVICE"] as const) {
    a.report.push(`- **Cứng – thiếu ${label[group]}:** ${hardMiss[group].length ? hardMiss[group].join(", ") : "không"}`);
  }
  a.report.push(`- **Mềm – thiếu (người × 30′):** ${Object.entries(softMiss).map(([k, v]) => `${k} ${v}`).join(" · ") || "không"}`);
  a.report.push(`- **Luật lao động / hợp đồng:** ${legal.length ? legal.slice(0, 10).join("; ") + (legal.length > 10 ? ` … (+${legal.length - 10})` : "") : "đạt"}`);
  a.report.push(`- **Kiểm tra trong app:** ${appErrors.length ? appErrors.slice(0, 5).map((x) => x.message).join("; ") : "Hợp lệ"}`, "");
  console.log(`${profile.shortName} ${monthKey}: ${shifts.length} ca, cứng bếp ${hardMiss.KITCHEN.length}d ${label.SERVICE.toLowerCase()} ${hardMiss.SERVICE.length}d, mềm ${softTotal}, luật ${legal.length}, app ${appErrors.length}`);
}

const allMonths = [...new Set(STORE_PROFILES.flatMap((profile) => payrollMonths(profile.id)))].sort();
for (const monthKey of allMonths) {
  const [year, month] = monthKey.split("-").map(Number);
  const rosters = Object.fromEntries(STORE_PROFILES.map((profile) => [profile.id, storeRoster(profile.id, monthKey)]));
  const planned: Record<string, Shift[]> = {};
  planAcrossStores(STORE_PROFILES.map((profile) => ({
    employees: rosters[profile.id],
    plan: (blockedDays, daysPerWeekCap) => (planned[profile.id] = rosters[profile.id].length
      ? generateSchedule({ year, month, workHours: DEFAULT_WORK_HOURS, employees: rosters[profile.id], profile, blockedDays, daysPerWeekCap })
      : []),
  })));
  for (const profile of STORE_PROFILES) {
    if (rosters[profile.id].length > 0) await reportStore(profile, monthKey, rosters[profile.id], planned[profile.id]);
  }

  // Người làm cả hai quán trong tháng này
  const storeSchedules = STORE_PROFILES.map((profile) => ({
    storeId: profile.id, shortName: profile.shortName,
    schedule: { year, month, employees: rosters[profile.id], shifts: planned[profile.id] } as Schedule,
  }));
  const conflicts = crossStoreConflicts(storeSchedules);
  const runIssues = crossStoreRunIssues(storeSchedules);
  const keys = new Set(STORE_PROFILES.flatMap((profile) => rosters[profile.id].map((e) => e.personKey).filter(Boolean)));
  for (const key of keys) {
    const parts = STORE_PROFILES.flatMap((profile) => {
      const e = rosters[profile.id].find((x) => x.personKey === key);
      if (!e) return [];
      const own = planned[profile.id].filter((s) => s.employeeId === e.id);
      return [{ store: profile.shortName, name: e.name, target: e.targetMinutes, paid: own.reduce((x, s) => x + s.paidMinutes, 0), days: new Set(own.map((s) => s.date)).size }];
    });
    if (parts.length < 2) continue;
    const sum = (k: "target" | "paid" | "days") => parts.reduce((x, p) => x + p[k], 0);
    shared.push(`| ${monthKey} | ${parts[0].name} | ${parts.map((p) => `${p.store} ${hm(p.target)} → ${hm(p.paid)} (${p.days} ngày)`).join(" · ")} | ${hm(sum("target"))} → ${hm(sum("paid"))} | ${sum("days")} | ${conflicts.some((c) => c.personKey === key) ? "✗ trùng ngày" : "✓"} | ${runIssues.filter((i) => i.personKey === key).map((i) => "✗ " + i.message).join("; ") || "✓"} |`);
  }
}

for (const profile of STORE_PROFILES) {
  const a = acc[profile.id];
  const missing = Object.entries(MISSING[profile.id]);
  fs.writeFileSync(path.join(baseDir, profile.id, "lich-tat-ca.csv"), "﻿" + a.csv.join("\r\n"));
  fs.writeFileSync(path.join(baseDir, profile.id, "BAO-CAO.md"), [
    `# ${profile.name} – kiểm tra lịch ${a.months[0]?.split("-").reverse().join("/")}–${a.months[a.months.length - 1]?.split("-").reverse().join("/")}`, "",
    "Mỗi tháng tạo lịch bằng đúng thuật toán của app, đội theo bảng lương tháng đó. Hai quán xếp lần lượt (AnAn rồi Anji);",
    "người làm cả hai quán không bị xếp hai quán trong cùng một ngày (xem NGUOI-LAM-2-QUAN.md).",
    `Cứng = luôn có ≥ 1 Bếp (từ 30′ chuẩn bị) và ≥ 1 ${profile.groupLabels.SERVICE} (từ giờ mở). Mềm = số người quy định từng buổi.`, "",
    ...a.summary, "",
    ...(missing.length ? ["**Không xuất (bảng lương thiếu giờ):**", "", ...missing.map(([month, note]) => `- ${month}: ${note}`), ""] : []),
    ...a.report,
  ].join("\n"));
}
fs.writeFileSync(path.join(baseDir, "NGUOI-LAM-2-QUAN.md"), [
  "# Người làm cả AnAn và Anji", "",
  "Mỗi ngày một người chỉ làm ở một quán. AnAn xếp trước, Anji xếp vào những ngày còn trống.",
  "Luật ngày nghỉ (≤ 6 ngày liên tiếp, ≤ 6 ngày/tuần) tính cả hai quán. Quán xếp trước chỉ được dùng số ngày/tuần theo tỉ lệ giờ hợp đồng ở hai quán.", "",
  "| Tháng | Người | Từng quán: giờ HĐ → xếp (số ngày) | Tổng giờ HĐ → xếp | Tổng ngày | Trùng ngày | ≤ 6 ngày liền, ≤ 6 ngày/tuần |",
  "|---|---|---|---|---|---|---|",
  ...shared, "",
].join("\n"));
console.log(`→ ${baseDir}`);
