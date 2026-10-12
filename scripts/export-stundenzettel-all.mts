// MỘT file PDF bảng chấm công (Stundenzettel) cho MỌI tháng của hai bảng lương –
// không cần mở app. Lịch xếp đúng như nút „Tạo lịch" (AnAn rồi Anji, người làm cả
// hai quán không bị xếp hai quán cùng ngày) và giống hệt scripts/export-all.mts.
// Thứ tự: AnAn (các tháng) rồi Anji; trong mỗi tháng mỗi người một trang.
// Mục lục (bookmark) theo quán → tháng → người. Tháng thiếu bảng lương
// (ANAN_/ANJI_MISSING_MONTHS) không có trong payrollMonths nên không xuất.
// Ra thêm: mỗi quán, mỗi tháng một file <Quán>_<MM>_<YYYY>.pdf.
// Chạy: npx vite-node scripts/export-stundenzettel-all.mts [thư mục ra]   (mặc định output)
import fs from "node:fs";
import path from "node:path";
import type { jsPDF } from "jspdf";
import { generateSchedule } from "../src/lib/scheduler";
import { payrollMonths, storeRoster } from "../src/lib/stores";
import { DEFAULT_WORK_HOURS } from "../src/lib/workHours";
import { STORE_PROFILES } from "../src/lib/staffing";
import { planAcrossStores } from "../src/lib/sharedPerson";
import { buildStundenzettelPdf } from "../src/lib/pdf";
import type { Employee, Schedule, Shift } from "../src/types";

const allMonths = [...new Set(STORE_PROFILES.flatMap((profile) => payrollMonths(profile.id)))].sort();
const outDir = process.argv[2] ?? "output";
const monthTag = (monthKey: string) => `${monthKey.slice(5)}_${monthKey.slice(0, 4)}`;
const outFile = path.join(outDir, `AnAn_Anji_Stundenzettel_${monthTag(allMonths[0])}_bis_${monthTag(allMonths[allMonths.length - 1])}.pdf`);
const save = (file: string, pdf: jsPDF) => fs.writeFileSync(file, Buffer.from(pdf.output("arraybuffer")));
fs.mkdirSync(outDir, { recursive: true });

// 1) Lịch từng tháng, hai quán cùng lúc (như „Tạo lịch").
const plans: Record<string, { monthKey: string; employees: Employee[]; shifts: Shift[] }[]> =
  Object.fromEntries(STORE_PROFILES.map((profile) => [profile.id, []]));
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
    if (rosters[profile.id].length > 0) plans[profile.id].push({ monthKey, employees: rosters[profile.id], shifts: planned[profile.id] });
  }
  console.log(`${monthKey}: ${STORE_PROFILES.map((p) => `${p.shortName} ${rosters[p.id].length} NV`).join(", ")}`);
}

// 2) Alles in EIN Dokument, mit Lesezeichen.
let doc: jsPDF | undefined;
let pages = 0;
for (const profile of STORE_PROFILES) {
  const storeMark = { page: pages + 1, months: [] as { title: string; page: number; people: { name: string; page: number }[] }[] };
  for (const { monthKey, employees, shifts } of plans[profile.id]) {
    const [year, month] = monthKey.split("-").map(Number);
    const schedule: Schedule = {
      companyName: profile.name, address: profile.address, year, month,
      workHours: DEFAULT_WORK_HOURS, dateOverrides: [], employees, shifts,
    };
    const first = pages + 1;
    doc = await buildStundenzettelPdf(schedule, employees, { doc });
    save(path.join(outDir, `${profile.shortName}_${monthTag(monthKey)}.pdf`), await buildStundenzettelPdf(schedule, employees));
    storeMark.months.push({
      title: `${String(month).padStart(2, "0")}/${year}`,
      page: first,
      people: employees.map((e, i) => ({ name: e.name, page: first + i })),
    });
    pages += employees.length;
  }
  if (!doc) continue;
  const storeNode = doc.outline.add(null, profile.name, { pageNumber: storeMark.page });
  for (const m of storeMark.months) {
    const monthNode = doc.outline.add(storeNode, m.title, { pageNumber: m.page });
    for (const p of m.people) doc.outline.add(monthNode, p.name, { pageNumber: p.page });
  }
}

if (!doc) throw new Error("Không có tháng nào để xuất.");
save(outFile, doc);
console.log(`→ ${outDir}: ${Object.values(plans).flat().length} file tháng + ${path.basename(outFile)} (${pages} trang)`);
