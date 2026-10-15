import { useMemo, useState } from "react";
import type { UseScheduleReturn } from "../hooks/useSchedule";
import type { Shift } from "../types";
import {
  datesOfMonth,
  parseIsoDate,
  WEEKDAY_SHORT_VI,
  weekdayKeyOf,
} from "../lib/demand";
import { minutesToShortHours, minutesToTime } from "../lib/time";
import { signedHours } from "../lib/dateFormat";
import { effectiveWeekdayKey, isDayClosed, resolveDay } from "../lib/workHours";
import { publicHolidays } from "../lib/holidays";
import { ShiftCellEditor } from "./ShiftCellEditor";
import { ScheduleDayView } from "./ScheduleDayView";
import { weeksOfMonth } from "../lib/weeks";
import { employmentShortVi, roleLabelVi } from "../lib/employment";
import { presentGroups, staffGroupOf, staffingWindows, workingAt, type StaffGroup } from "../lib/staffing";
import { monthlyTargetMinutesFor, SCHEDULE_SLOT_MINUTES } from "../lib/contract";
import { StaffingReport } from "./StaffingReport";
import { CoverageChart } from "./CoverageChart";

/** „17", „11½" (halbe Stunde), sonst „11:15" – so bleibt die Zelle schmal (wie demo-studenzettell). */
function shortTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return String(h);
  if (m === 30) return `${h}½`;
  return minutesToTime(minutes);
}

function isWeekendKey(iso: string): boolean {
  const k = weekdayKeyOf(parseIsoDate(iso));
  return k === "saturday" || k === "sunday";
}

function cellClass(shift: Shift | undefined): string {
  if (!shift) return "shift-free";
  const base = shift.shiftType === "EARLY" ? "shift-early" : "shift-late";
  return `${base} ${!shift.generated ? "shift-custom" : ""}`;
}

export function ScheduleTab({ store }: { store: UseScheduleReturn }) {
  // Drucken (Monat/Woche) und Entsperren liegen im Tab „Bảng chấm công" –
  // dort sitzt alles, was Papier erzeugt.
  // Nút „Tạo lịch làm việc" và popup nằm trên thanh tab (App.tsx).
  const { schedule, validation, generate, isLocked, openDates } = store;
  const [selected, setSelected] = useState<{ employeeId: string; date: string } | null>(null);
  // Mặc định: điện thoại -> xem theo ngày, màn lớn -> bảng tháng.
  const [view, setView] = useState<"grid" | "day" | "coverage">(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches ? "day" : "grid",
  );
  const [weekIndex, setWeekIndex] = useState(0);

  const dates = useMemo(
    () => datesOfMonth(schedule.year, schedule.month),
    [schedule.year, schedule.month],
  );

  const weeks = useMemo(
    () => weeksOfMonth(schedule.year, schedule.month),
    [schedule.year, schedule.month],
  );

  // Bảng tháng luôn hiện cả tháng (đã bỏ chế độ xem theo tuần).
  const gridDates = dates;

  // Tra nhanh: employeeId#date -> ALLE Dienste des Tages.
  //
  // Es kann zwei geben (mittags und abends). Vorher stand hier eine Map auf
  // EINEN Dienst, und der zweite verschwand lautlos aus der Anzeige – der Plan
  // sah dann anders aus, als er war.
  const shiftMap = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of schedule.shifts) {
      const key = `${s.employeeId}#${s.date}`;
      const liste = m.get(key);
      if (liste) liste.push(s);
      else m.set(key, [s]);
    }
    for (const liste of m.values()) liste.sort((a, b) => a.startMinutes - b.startMinutes);
    return m;
  }, [schedule.shifts]);

  const summaryByEmp = useMemo(
    () => new Map(validation.summaries.map((s) => [s.employee.id, s] as const)),
    [validation.summaries],
  );

  const overridesByDate = useMemo(
    () => new Map(schedule.dateOverrides.map((o) => [o.date, o] as const)),
    [schedule.dateOverrides],
  );

  // Geschlossene Tage (Sonntag + Feiertag-Overrides + Betriebsruhe) vorab.
  const closedByDate = useMemo(() => {
    const holidays = publicHolidays(schedule.year);
    const ovMap = Object.fromEntries(schedule.dateOverrides.map((o) => [o.date, o]));
    const set = new Set<string>();
    for (const d of dates) {
      if (isDayClosed(schedule.workHours, d, holidays, ovMap)) set.add(d);
    }
    return set;
  }, [dates, schedule.workHours, schedule.year, schedule.dateOverrides]);

  // Tổng theo ngày cho các dòng chân bảng. Theo nhóm: số NGƯỜI (ca gãy trưa + tối tính 1).
  const dayStats = useMemo(() => {
    const employeesById = new Map(store.monthEmployees.map((e) => [e.id, e] as const));
    const stats = new Map<string, {
      people: Set<string>; shifts: number; total: number; early: number; late: number;
      kitchen: Set<string>; service: Set<string>; driver: Set<string>;
    }>();
    for (const d of dates) stats.set(d, { people: new Set(), shifts: 0, total: 0, early: 0, late: 0, kitchen: new Set(), service: new Set(), driver: new Set() });
    for (const s of schedule.shifts) {
      const st = stats.get(s.date);
      if (!st) continue;
      // „Số nhân viên" zählt PERSONEN – wer mittags und abends arbeitet, ist
      // eine Person mit zwei Diensten (Zeile „Số ca" darunter).
      st.people.add(s.employeeId);
      st.shifts += 1;
      st.total += s.paidMinutes;
      if (s.shiftType === "EARLY") st.early += 1;
      else st.late += 1; // LATE hoặc CUSTOM tính là ca tối
      const group = staffGroupOf(employeesById.get(s.employeeId));
      (group === "KITCHEN" ? st.kitchen : group === "DRIVER" ? st.driver : st.service).add(s.employeeId);
    }
    return stats;
  }, [dates, schedule.shifts, store.monthEmployees]);
  const hasDrivers = store.monthEmployees.some((e) => e.workRole === "DRIVER");

  // Bếp/Phục vụ ít nhất có mặt trong từng khung giờ (lúc vắng nhất của khung),
  // để thấy ngay chỗ chỉ còn 0–1 người. `need` = mức tối thiểu theo quy tắc của
  // quán (cứng + mềm, staffing.ts) – thiếu so với mức đó thì viền đỏ.
  const coverage = useMemo(() => {
    const result = new Map<string, Map<string, Coverage | null>>();
    const holidays = publicHolidays(schedule.year);
    const overrideMap = Object.fromEntries(schedule.dateOverrides.map((o) => [o.date, o]));
    const groupById = new Map(store.monthEmployees.map((e) => [e.id, staffGroupOf(e)] as const));
    const present = presentGroups(store.monthEmployees);
    for (const d of dates) {
      const perWindow = new Map<string, Coverage | null>();
      result.set(d, perWindow);
      const day = resolveDay(schedule.workHours, d, holidays, overrideMap);
      if (day.closed) continue;
      const dayShifts = schedule.shifts.filter((s) => s.date === d);
      const rules = staffingWindows(day.blocks, effectiveWeekdayKey(d, holidays), present, store.profile);
      for (const w of COVERAGE_WINDOWS) {
        const from = w.from ?? day.blocks[0]?.startMinutes ?? 0;
        let cell: Coverage | null = null;
        for (const block of day.blocks) {
          for (let t = Math.max(from, block.startMinutes); t + 30 <= Math.min(w.to, block.endMinutes); t += 30) {
            const need = rules
              .filter((r) => r.groups.length === 1 && r.groups[0] === w.group && t >= r.startMinutes && t + 30 <= r.endMinutes)
              .reduce((max, r) => Math.max(max, r.minStaff), 0);
            // Phục vụ bắt đầu từ giờ mở cửa: 30′ bếp chuẩn bị không tính cho Phục vụ.
            if (w.group === "SERVICE" && need === 0 && t < block.startMinutes + 30 && block === day.blocks[0]) continue;
            const count = dayShifts.filter((s) => groupById.get(s.employeeId) === w.group && workingAt(s, t)).length;
            if (!cell) cell = { min: count, short: false, need: 0 };
            cell.min = Math.min(cell.min, count);
            if (count < need) cell.short = true;
            cell.need = Math.max(cell.need, need);
          }
        }
        perWindow.set(w.key, cell);
      }
    }
    return result;
  }, [dates, schedule, store.profile, store.monthEmployees]);

  const hasSplitSunday = useMemo(() => {
    const holidays = publicHolidays(schedule.year);
    for (const s of schedule.shifts) {
      if (weekdayKeyOf(parseIsoDate(s.date)) === "sunday" || holidays.has(s.date)) {
        const count = schedule.shifts.filter(
          (other) => other.date === s.date && other.employeeId === s.employeeId,
        ).length;
        // CN là ca liền (tab Tài liệu); ca dài ở CN là đúng hệ số 1,5, chỉ báo khi bị chia 2 ca.
        if (count > 1) return true;
      }
    }
    return false;
  }, [schedule.year, schedule.shifts]);

  const hasEmployees = schedule.employees.length > 0;

  return (
    <section>
      {/* Alles Sichtbare liegt im no-print-Block; beim Drucken bleibt nur der
          Druckbereich ganz unten übrig. */}
      <div className="no-print">
      {hasSplitSunday && (
        <div className="mb-3 rounded-lg bg-blue-50 border border-blue-300 p-3 text-blue-950 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div>
            <div className="font-semibold flex items-center gap-1.5 text-blue-900">
              <span>Chủ nhật đang bị chia 2 ca</span>
            </div>
            <p className="text-xs text-blue-800 mt-0.5">
              Chủ nhật/ngày lễ là <b>ca liền</b> (xem mục Tài liệu). Lịch này có người bị chia ca sáng/chiều vào Chủ nhật — bấm nút bên cạnh để tạo lại.
            </p>
          </div>
          <button
            type="button"
            onClick={() => generate()}
            className="whitespace-nowrap rounded bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 active:bg-blue-800 shadow"
          >
            Cập nhật lại lịch chuẩn ngay
          </button>
        </div>
      )}

      {/*
        Nur ein kurzer Hinweis - Drucken und Entsperren sitzen im Tab
        "Bang cham cong". Ohne diesen Hinweis klickt man hier auf eine Zelle
        und nichts passiert, ohne zu erfahren warum.
      */}
      {isLocked && (
        <div className="mb-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2">
          Lịch tháng này đã khóa vì đã in
          {schedule.lockedAt && ` lúc ${new Date(schedule.lockedAt).toLocaleString("vi-VN")}`} — chỉ
          xem, không sửa được. Mở khóa ở tab <b>Bảng chấm công</b>, hoặc bấm{" "}
          <b>„Tạo lịch làm việc"</b> để tạo lại (sẽ mở khóa).
        </div>
      )}

      {/* Eine Leiste wie demo-studenzettell: rechts „Xem theo" (Tháng / Ngày / Độ phủ). */}
      {hasEmployees && (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          {view === "coverage" && weeks.length > 0 && (
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
                disabled={weekIndex === 0}
                aria-label="Tuần trước"
                className="px-2.5 py-1.5 text-slate-600 disabled:opacity-30"
              >
                ‹
              </button>
              <select
                aria-label="Tuần"
                value={Math.min(weekIndex, weeks.length - 1)}
                onChange={(e) => setWeekIndex(Number(e.target.value))}
                className="border-x border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
              >
                {weeks.map((w, idx) => (
                  <option key={w.weekStart} value={idx}>
                    {w.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setWeekIndex((i) => Math.min(weeks.length - 1, i + 1))}
                disabled={weekIndex >= weeks.length - 1}
                aria-label="Tuần sau"
                className="px-2.5 py-1.5 text-slate-600 disabled:opacity-30"
              >
                ›
              </button>
            </div>
          )}
          <select
            aria-label="Xem theo"
            value={view}
            onChange={(e) => setView(e.target.value as typeof view)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800"
          >
            <option value="grid">Tháng</option>
            <option value="day">Ngày</option>
            <option value="coverage">Độ phủ</option>
          </select>
        </div>
      )}

      {schedule.shifts.length > 0 && <StaffingReport analysis={store.analysis} />}

      {/* Lỗi kiểm tra */}
      {!validation.valid && schedule.shifts.length > 0 && (
        <div className="mb-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">
          <div className="font-medium mb-1">Lỗi kiểm tra ({validation.errors.length}):</div>
          <ul className="list-disc pl-5 space-y-0.5 max-h-40 overflow-auto">
            {validation.errors.slice(0, 30).map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Chú thích bảng tháng */}
      {view === "grid" && (
        <div className="flex flex-wrap gap-3 mb-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border shift-early" /> Ca sáng
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border shift-late" /> Ca tối
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border shift-free" /> Nghỉ
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border shift-custom bg-white" /> Đã sửa tay
          </span>
        </div>
      )}

      {!hasEmployees ? (
        <div className="rounded bg-white border border-slate-200 p-6 text-center text-slate-400">
          Vui lòng thêm nhân viên trước.
        </div>
      ) : view === "day" ? (
        <ScheduleDayView store={store} onEdit={(employeeId, date) => setSelected({ employeeId, date })} />
      ) : view === "coverage" ? (
        <CoverageChart schedule={{ ...schedule, employees: store.monthEmployees }} profile={store.profile} dates={weeks[Math.min(weekIndex, weeks.length - 1)]?.dates ?? dates} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white -mx-3 sm:mx-0">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-slate-100 border-b border-r border-slate-200 px-1.5 py-1 text-left w-[80px] max-w-[80px]">
                  Nhân viên
                </th>
                {gridDates.map((d) => {
                  const day = parseIsoDate(d).getDate();
                  const wk = WEEKDAY_SHORT_VI[weekdayKeyOf(parseIsoDate(d))];
                  const ov = overridesByDate.get(d);
                  const closed = closedByDate.has(d);
                  const headerBg = closed
                    ? "bg-rose-100"
                    : ov
                      ? "bg-sky-100"
                      : isWeekendKey(d)
                        ? "bg-slate-200"
                        : "bg-slate-100";
                  return (
                    <th
                      key={d}
                      title={
                        closed
                          ? `Đóng cửa${ov?.note ? " · " + ov.note : ""}`
                          : ov
                            ? `Giờ riêng${ov.note ? " · " + ov.note : ""}`
                            : undefined
                      }
                      className={`border-b border-l border-slate-200 px-0.5 py-1 text-center min-w-[40px] ${headerBg}`}
                    >
                      <div className="font-semibold">{day}</div>
                      <div className="text-[10px] text-slate-500">{wk}</div>
                      {closed && <div className="text-[9px] text-rose-600 font-medium">Đóng</div>}
                      {!closed && ov && <div className="text-[9px] text-sky-700 font-medium">Riêng</div>}
                    </th>
                  );
                })}
                <th className="bg-slate-100 border-b border-l border-slate-200 px-2 py-2 text-right min-w-[64px]">
                  Đã xếp
                </th>
                <th className="bg-slate-100 border-b border-l border-slate-200 px-2 py-2 text-right min-w-[70px]">
                  Chênh lệch
                </th>
              </tr>
            </thead>
            <tbody>
              {store.monthEmployees.map((emp) => {
                const sum = summaryByEmp.get(emp.id);
                const sollMin = monthlyTargetMinutesFor(emp, openDates, schedule.workHours);
                const diff = sum?.diffMinutes ?? -sollMin;
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50">
                    {/* Nur der Name (gekürzt); Art, Nhóm und Soll stehen im Tooltip und im Tab Nhân viên. */}
                    <td
                      className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 px-1.5 py-1 font-medium w-[80px] max-w-[80px] truncate"
                      title={`${emp.name} · ${employmentShortVi(emp.employmentType)} · ${roleLabelVi(emp.workRole, store.profile)} · ${minutesToShortHours(sollMin)}`}
                    >
                      {emp.name}
                    </td>
                    {gridDates.map((d) => {
                      const dienste = shiftMap.get(`${emp.id}#${d}`) ?? [];
                      const shift = dienste[0];
                      return (
                        <td
                          key={d}
                          onClick={() => setSelected({ employeeId: emp.id, date: d })}
                          className={`border-b border-l border-slate-200 px-0.5 py-1 text-center cursor-pointer align-middle ${cellClass(
                            shift,
                          )}`}
                          title="Bấm để sửa"
                        >
                          {shift ? (
                            // Kurz: „11½–14½" / „17–22" je Dienst untereinander (wie demo-studenzettell).
                            <div className="leading-tight whitespace-nowrap text-[10px] font-medium">
                              {dienste.map((x) => (
                                <div key={x.id} title={`${minutesToTime(x.startMinutes)}–${minutesToTime(x.endMinutes)} · ${minutesToShortHours(x.paidMinutes)}`}>
                                  {shortTime(x.startMinutes)}–{shortTime(x.endMinutes)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300">–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b border-l border-slate-200 px-2 py-1 text-right font-medium">
                      {minutesToShortHours(sum?.assignedMinutes ?? 0)}
                    </td>
                    <td
                      className={`border-b border-l border-slate-200 px-2 py-1 text-right font-medium ${
                        Math.abs(diff) <= SCHEDULE_SLOT_MINUTES / 2 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {Math.abs(diff) <= SCHEDULE_SLOT_MINUTES / 2 ? "≈0,0" : signedHours(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <SummaryRow label="Số NV" dates={gridDates} value={(d) => String(dayStats.get(d)!.people.size)} />
              <SummaryRow label="Số ca" dates={gridDates} value={(d) => String(dayStats.get(d)!.shifts)} />
              <SummaryRow label="Bếp" labelClass="text-orange-700" dates={gridDates} value={(d) => String(dayStats.get(d)!.kitchen.size)} />
              <SummaryRow label={store.profile.groupLabels.SERVICE} labelClass="text-sky-700" dates={gridDates} value={(d) => String(dayStats.get(d)!.service.size)} />
              {hasDrivers && (
                <SummaryRow label="Lái xe" labelClass="text-violet-700" dates={gridDates} value={(d) => String(dayStats.get(d)!.driver.size)} />
              )}
              <SummaryRow
                label="Tổng giờ"
                dates={gridDates}
                value={(d) => minutesToShortHours(dayStats.get(d)!.total)}
              />
              <SummaryRow label="Ca sáng" dates={gridDates} value={(d) => String(dayStats.get(d)!.early)} />
              <SummaryRow label="Ca tối" dates={gridDates} value={(d) => String(dayStats.get(d)!.late)} />
              {COVERAGE_WINDOWS.map((w) => (
                <CoverageRow
                  key={w.key}
                  label={`${shortGroup(store.profile.groupLabels[w.group])} ${w.range}`}
                  title={`${store.profile.groupLabels[w.group]} ít nhất có mặt, ${w.title}`}
                  labelClass={w.group === "KITCHEN" ? "text-orange-700" : "text-sky-700"}
                  dates={gridDates}
                  cell={(d) => coverage.get(d)?.get(w.key) ?? null}
                />
              ))}
            </tfoot>
          </table>
        </div>
      )}

      {/* Bearbeiten ist bei gesperrtem Monat gar nicht erst möglich. */}
      {selected && !isLocked && (
        <ShiftCellEditor
          store={store}
          employeeId={selected.employeeId}
          date={selected.date}
          onClose={() => setSelected(null)}
        />
      )}
      </div>
    </section>
  );
}

function SummaryRow({
  label,
  labelClass = "",
  dates,
  value,
}: {
  label: string;
  /** Màu chữ của nhãn – cùng màu nhóm với biểu đồ Độ phủ. */
  labelClass?: string;
  dates: string[];
  value: (d: string) => string;
}) {
  return (
    <tr className="bg-slate-50 text-slate-600">
      <td className={`sticky left-0 z-10 bg-slate-50 border-t border-r border-slate-200 px-1.5 py-1 font-medium whitespace-nowrap ${labelClass}`}>
        {label}
      </td>
      {dates.map((d) => (
        <td key={d} className="border-t border-l border-slate-200 px-1 py-1 text-center">
          {value(d)}
        </td>
      ))}
      <td className="border-t border-l border-slate-200" />
      <td className="border-t border-l border-slate-200" />
    </tr>
  );
}

type Coverage = { min: number; short: boolean; need: number };

// Khung giờ cho các dòng „ít nhất" ở chân bảng (from undefined = đầu giờ làm).
// Theo quy tắc AnAn/Anji: giờ đông 12–14h và 18–22h, đóng cửa 22–22:30.
// Nhãn ngắn để cột tên hẹp (nhiều chỗ cho các ngày); nhãn đầy đủ nằm ở tooltip.
const COVERAGE_WINDOWS: { key: string; range: string; title: string; group: Exclude<StaffGroup, "DRIVER">; from?: number; to: number }[] = (
  [
    ["open", "mở–12", "mở cửa – 12:00", undefined, 12 * 60],
    ["noon", "12–14", "12:00 – 14:00 (giờ đông)", 12 * 60, 14 * 60],
    ["afternoon", "14–17", "14:00 – 17:00", 14 * 60, 17 * 60],
    ["evening-open", "17–18", "17:00 – 18:00", 17 * 60, 18 * 60],
    ["evening", "18–22", "18:00 – 22:00 (giờ đông)", 18 * 60, 22 * 60],
    ["closing", "22–22½", "đóng cửa 22:00 – 22:30", 22 * 60, 22 * 60 + 30],
  ] as const
).flatMap(([key, range, title, from, to]) =>
  (["KITCHEN", "SERVICE"] as const).map((group) => ({ key: `${group}-${key}`, range, title, group, from, to })),
);

/** Kurzname des Bereichs für die schmale erste Spalte („Phục vụ" → „PV"). */
const shortGroup = (label: string) => (label.length > 4 ? label.split(" ").map((w) => w[0].toUpperCase()).join("") : label);

/** Dòng „ít nhất x người" trong khung giờ: 0 = đỏ, 1 = vàng, thiếu so với quy tắc = viền đỏ. */
function CoverageRow({
  label,
  title,
  labelClass = "",
  dates,
  cell,
}: {
  label: string;
  title?: string;
  labelClass?: string;
  dates: string[];
  cell: (d: string) => Coverage | null;
}) {
  return (
    <tr className="bg-slate-50 text-slate-600">
      <td title={title} className={`sticky left-0 z-10 bg-slate-50 border-t border-r border-slate-200 px-1.5 py-1 font-medium whitespace-nowrap ${labelClass}`}>
        {label}
      </td>
      {dates.map((d) => {
        const c = cell(d);
        const tone = !c
          ? "text-slate-300"
          : c.min === 0
            ? "bg-rose-50 text-rose-700 font-semibold"
            : c.min === 1
              ? "bg-amber-50 text-amber-800"
              : "";
        return (
          <td
            key={d}
            className={`border-t border-l border-slate-200 px-1 py-1 text-center ${tone} ${
              c?.short ? "outline outline-2 -outline-offset-2 outline-rose-500" : ""
            }`}
            title={c?.short ? `Thiếu: cần ít nhất ${c.need}` : undefined}
          >
            {c ? c.min : "–"}
            {c?.short && <span className="block text-[10px] leading-none">cần {c.need}</span>}
          </td>
        );
      })}
      <td className="border-t border-l border-slate-200" />
      <td className="border-t border-l border-slate-200" />
    </tr>
  );
}
