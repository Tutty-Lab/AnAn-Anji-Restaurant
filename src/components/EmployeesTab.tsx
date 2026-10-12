import { useMemo, useState } from "react";
import { canSwitchRoleFor, isRoleSwitchedInMonth, monthKeyOf, monthRole } from "../lib/monthRole";
import type { UseScheduleReturn } from "../hooks/useSchedule";
import type { DateRange, Employee, EmploymentType, WorkRole } from "../types";
import { splitTargetHours } from "../lib/splitTargetHours";
import { WEEKDAY_SHORT_VI, type WeekdayKey } from "../lib/demand";
import { monthlyTargetMinutesFor } from "../lib/contract";
import { employmentShortVi, roleLabelVi } from "../lib/employment";
import { currentPartners, linkPatches, type PartnerChoice, type StoreRoster } from "../lib/sharedPerson";
import type { StoreProfile } from "../lib/staffing";
import { minutesToShortHours, minutesToTime, timeToMinutes } from "../lib/time";
import type { WorkHoursConfig } from "../lib/workHours";
import { describePreferredWindow, preferredWindowsOf } from "../lib/preferredWindows";

// Formular wie Thiên Long (Bottom-Sheet, mobil zuerst, Abschnitte):
// Thông tin · Giờ làm · Ngày nghỉ cố định · Kỳ học · Luật riêng · Thời gian làm
// việc · Cũng làm ở quán khác · Đã kiểm tra (Lưu). Die Felder speichern in die
// bestehenden AnAn/Anji-Felder (availableWeekdays, maxDaysPerWeek, …).

// text-base (16px) auf dem Handy: iOS zoomt sonst beim Tippen hinein.
const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

/** Voreinstellung der festen Schicht, wenn eingeschaltet: Mittagsblock. */
const FIXED_START_DEFAULT = "11:00";
const FIXED_END_DEFAULT = "14:30";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Ab hier warnt das Formular (wie Thiên Long). */
const WARN_HOURS = 192;

const WEEKDAY_ORDER: WeekdayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const ROLE_BADGE: Record<WorkRole | "NONE", string> = {
  KITCHEN: "bg-orange-50 text-orange-700",
  SERVICE: "bg-sky-50 text-sky-700",
  DRIVER: "bg-violet-50 text-violet-700",
  NONE: "bg-slate-100 text-slate-500",
};

/** Số ngày làm (= số ca) cho một mục tiêu, hoặc thông báo lỗi. */
function splitInfo(targetHours: number, type: EmploymentType): { ok: boolean; text: string } {
  if (targetHours <= 0) return { ok: true, text: "—" };
  try {
    const parts = splitTargetHours(Math.round(targetHours), type);
    return { ok: true, text: `${parts.length} ca` };
  } catch (e) {
    return { ok: false, text: e instanceof Error ? e.message : "không hợp lệ" };
  }
}

/** "92,70" / "92.7" -> 92.7; Unsinn -> 0. */
function parseHours(text: string): number {
  const value = Number(text.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

const formatHours = (hours: number) => hours.toLocaleString("de-DE", { maximumFractionDigits: 2 });
const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/**
 * Entwurf, während im Blatt getippt wird. Die Stunden sind ein STRING,
 * damit man das Feld leeren und mit Komma tippen kann.
 */
type Draft = {
  name: string;
  employmentType: EmploymentType;
  contract: "week" | "month";
  hours: string;
  role: WorkRole | "";
  schoolPeriods: DateRange[];
  fixed: boolean;
  fixedStart: string; // "HH:MM"
  fixedEnd: string; // "HH:MM"
  /** Ngày nghỉ cố định = Wochentage, an denen die Person NIE arbeitet. */
  daysOff: WeekdayKey[];
  /** „Số ngày làm / tuần": "" = Tự (không giới hạn), sonst "1".."7". */
  daysPerWeek: string;
  startDate: string; // "yyyy-MM-dd" hoặc "" = từ đầu tháng
  endDate: string; // "yyyy-MM-dd" hoặc "" = vẫn làm
  /** Cùng người này ở quán khác: storeId -> employeeId ("" = không). */
  partners: PartnerChoice;
  /** „Làm được cả Bếp và Phục vụ" – đổi nhóm cả tháng khi thiếu người. */
  canSwitchRole: boolean;
  roleByMonth: Record<string, WorkRole>;
  shiftMin: string;
  shiftMax: string;
  spreadEvenly: boolean;
  windows: { days: WeekdayKey[]; start: string; end: string }[];
  saved: boolean;
};

/** Der andere Laden, wie ihn das Feld „Cũng làm ở quán khác" braucht. */
type OtherStore = { storeId: string; shortName: string; employees: readonly Employee[]; locked: boolean };

function draftFrom(emp?: Employee, partners: PartnerChoice = {}): Draft {
  const weekly = emp?.weeklyHours != null;
  const available = emp?.availableWeekdays ?? [];
  return {
    name: emp?.name ?? "",
    employmentType: emp?.employmentType ?? "TEILZEIT",
    contract: emp ? (weekly ? "week" : "month") : "month",
    hours: emp ? (weekly ? formatHours(emp.weeklyHours!) : formatHours(emp.targetMinutes / 60)) : "",
    role: emp?.workRole ?? "",
    schoolPeriods: (emp?.schoolPeriods ?? []).map((period) => ({ ...period })),
    fixed: !!emp?.fixedShift,
    // Vorhandene feste Schicht übernehmen, sonst die Voreinstellung anzeigen.
    fixedStart: emp?.fixedShift ? minutesToTime(emp.fixedShift.startMinutes) : FIXED_START_DEFAULT,
    fixedEnd: emp?.fixedShift ? minutesToTime(emp.fixedShift.endMinutes) : FIXED_END_DEFAULT,
    daysOff: available.length === 0 ? [] : WEEKDAY_ORDER.filter((key) => !available.includes(key)),
    daysPerWeek: emp?.maxDaysPerWeek ? String(Math.min(7, emp.maxDaysPerWeek)) : "",
    startDate: emp?.startDate ?? "",
    endDate: emp?.endDate ?? "",
    partners,
    canSwitchRole: emp?.canSwitchRole === true,
    roleByMonth: { ...(emp?.roleByMonth ?? {}) },
    shiftMin: emp?.shiftHours ? formatHours(emp.shiftHours.min) : "",
    shiftMax: emp?.shiftHours ? formatHours(emp.shiftHours.max) : "",
    spreadEvenly: emp?.spreadEvenly === true,
    windows: (emp?.preferredWindows ?? []).map((w) => ({
      days: [...w.days],
      start: minutesToTime(w.startMinutes),
      end: minutesToTime(w.endMinutes),
    })),
    saved: emp?.saved === true,
  };
}

/** Wandelt "HH:MM" in Minuten; bei Unsinn die Voreinstellung. */
function safeMinutes(time: string, fallback: string): number {
  try {
    return timeToMinutes(time);
  } catch {
    return timeToMinutes(fallback);
  }
}

/** Gültige Zeiträume, Anfang ≤ Ende, sortiert. */
function cleanPeriods(periods: DateRange[]): DateRange[] {
  return periods
    .filter((period) => ISO_DATE.test(period.start) && ISO_DATE.test(period.end))
    .map((period) => (period.start <= period.end ? period : { start: period.end, end: period.start }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** „Độ dài ca" aus dem Formular: beide Werte > 0, sonst nicht gesetzt. */
function shiftHoursFromDraft(d: Draft): Employee["shiftHours"] {
  const min = parseHours(d.shiftMin);
  const max = parseHours(d.shiftMax);
  if (!(min > 0) || !(max > 0)) return undefined;
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

/** Nur vollständige Khung giờ (mind. ein Tag, Ende nach Beginn). */
function windowsFromDraft(d: Draft): Employee["preferredWindows"] {
  const out = d.windows.flatMap((w) => {
    try {
      const startMinutes = timeToMinutes(w.start);
      const endMinutes = timeToMinutes(w.end);
      if (w.days.length === 0 || endMinutes <= startMinutes) return [];
      return [{ days: WEEKDAY_ORDER.filter((x) => w.days.includes(x)), startMinutes, endMinutes }];
    } catch {
      return [];
    }
  });
  return out.length > 0 ? out : undefined;
}

/** Entwurf -> Mitarbeiter-Felder (ohne id). */
function draftToEmployee(d: Draft): Omit<Employee, "id"> {
  const hours = parseHours(d.hours);
  const tage = Number(d.daysPerWeek);
  const fixedStart = safeMinutes(d.fixedStart, FIXED_START_DEFAULT);
  const fixedEnd = safeMinutes(d.fixedEnd, FIXED_END_DEFAULT);
  const periods = cleanPeriods(d.schoolPeriods);
  const daysOff = d.daysOff.filter((key) => WEEKDAY_ORDER.includes(key));
  return {
    name: d.name.trim() || "Nhân viên mới",
    employmentType: d.employmentType,
    // Monatsvertrag in Minuten; beim Wochenvertrag leitet contract.ts das Soll je Monat ab.
    targetMinutes: d.contract === "month" ? Math.round(hours * 60) : 0,
    weeklyHours: d.contract === "week" ? Math.round(hours * 100) / 100 : undefined,
    workRole: d.role || undefined,
    schoolPeriods: periods.length > 0 ? periods : undefined,
    // Ende muss nach Beginn liegen – sonst die feste Schicht ignorieren, statt
    // eine kaputte Zeitspanne zu speichern.
    fixedShift:
      d.fixed && fixedEnd > fixedStart
        ? { startMinutes: fixedStart, endMinutes: fixedEnd }
        : undefined,
    // Ngày nghỉ cố định ist die Umkehrung von availableWeekdays (Planer unverändert).
    availableWeekdays:
      daysOff.length === 0 || daysOff.length === 7
        ? undefined
        : WEEKDAY_ORDER.filter((key) => !daysOff.includes(key)),
    maxDaysPerWeek: d.daysPerWeek === "" || !(tage >= 1) ? undefined : Math.min(7, Math.round(tage)),
    // Leeres Feld = von Monatsanfang an dabei (kein Eintrittsdatum).
    startDate: ISO_DATE.test(d.startDate) ? d.startDate : undefined,
    endDate: ISO_DATE.test(d.endDate) ? d.endDate : undefined,
    canSwitchRole: d.canSwitchRole && canSwitchRoleFor(d.role || undefined) ? true : undefined,
    // Nur Monate mit ANDERER Rolle als der Hauptrolle aufheben.
    roleByMonth: (() => {
      if (!d.canSwitchRole || !canSwitchRoleFor(d.role || undefined)) return undefined;
      const kept = Object.fromEntries(Object.entries(d.roleByMonth).filter(([, role]) => role !== d.role));
      return Object.keys(kept).length > 0 ? kept : undefined;
    })(),
    shiftHours: shiftHoursFromDraft(d),
    spreadEvenly: d.spreadEvenly || undefined,
    preferredWindows: windowsFromDraft(d),
    saved: d.saved || undefined,
  };
}

export function EmployeesTab({ store, allStores }: { store: UseScheduleReturn; allStores: readonly UseScheduleReturn[] }) {
  const { schedule, openDates, addEmployee, updateEmployee, removeEmployee, profile } = store;
  const locked = Boolean(schedule.lockedAt);

  const rosters: StoreRoster[] = allStores.map((s) => ({ storeId: s.storeId, employees: s.schedule.employees }));
  const others: OtherStore[] = allStores
    .filter((s) => s.storeId !== store.storeId)
    .map((s) => ({
      storeId: s.storeId,
      shortName: s.profile.shortName,
      employees: s.schedule.employees,
      locked: Boolean(s.schedule.lockedAt),
    }));
  const partnerLabel = (emp: Employee) =>
    others.filter((o) => currentPartners(rosters, store.storeId, emp)[o.storeId]).map((o) => o.shortName);

  /** personKeys in beiden Läden setzen bzw. lösen. */
  const saveLinks = (self: { employeeId: string; name: string; personKey?: string }, choice: PartnerChoice) => {
    for (const patch of linkPatches(rosters, { storeId: store.storeId, ...self }, choice)) {
      allStores.find((s) => s.storeId === patch.storeId)?.updateEmployee(patch.employeeId, { personKey: patch.personKey });
    }
  };

  // null = zu; "new" = anlegen; sonst = die id, die bearbeitet wird.
  const [offen, setOffen] = useState<null | "new" | string>(null);
  const bearbeitet = useMemo(
    () =>
      typeof offen === "string" && offen !== "new"
        ? schedule.employees.find((e) => e.id === offen)
        : undefined,
    [offen, schedule.employees],
  );

  return (
    <section className="rounded-lg bg-white border border-slate-200 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-slate-900">
          Nhân viên {profile.shortName}
          {schedule.employees.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">
              {schedule.employees.length}
            </span>
          )}
        </h2>
        <button
          onClick={() => setOffen("new")}
          disabled={locked}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 active:bg-slate-800 disabled:opacity-40"
        >
          + Thêm
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Hợp đồng theo <b>tháng</b> hoặc theo <b>tuần</b> (Azubi). Lịch xếp theo bậc 30′, không vượt hợp đồng. Bấm vào một người để sửa.
      </p>

      {locked && (
        <div className="mb-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2">
          Lịch tháng này đã khoá vì đã in — mở khoá ở tab <b>Bảng chấm công</b> để sửa nhân viên.
        </div>
      )}

      {schedule.employees.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          Chưa có nhân viên. Bấm <b>+ Thêm</b> để tạo.
        </div>
      ) : (
        <ul className="space-y-2">
          {schedule.employees.map((emp) => (
            <li key={emp.id}>
              <button
                onClick={() => setOffen(emp.id)}
                className="w-full text-left rounded-lg border border-slate-200 p-3 flex items-center gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                <EmployeeSummaryRow emp={emp} year={schedule.year} month={schedule.month} openDates={openDates} workHours={schedule.workHours} profile={profile} sharedWith={partnerLabel(emp)} />
                <span className="text-slate-300 text-lg leading-none">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!locked && (
        <button
          onClick={() => setOffen("new")}
          aria-label="Thêm nhân viên"
          className="sm:hidden fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-slate-900 text-white text-2xl shadow-lg active:bg-slate-700 flex items-center justify-center"
        >
          +
        </button>
      )}

      {offen !== null && !locked && (
        <EmployeeSheet
          key={bearbeitet?.id ?? "new"}
          employee={bearbeitet}
          year={schedule.year}
          month={schedule.month}
          openDates={openDates}
          workHours={schedule.workHours}
          profile={profile}
          others={others}
          partners={currentPartners(rosters, store.storeId, bearbeitet)}
          onClose={() => setOffen(null)}
          onSave={(felder, partners) => {
            if (bearbeitet) {
              updateEmployee(bearbeitet.id, felder);
              saveLinks({ employeeId: bearbeitet.id, name: felder.name, personKey: bearbeitet.personKey }, partners);
            } else {
              const id = addEmployee(felder);
              if (id) saveLinks({ employeeId: id, name: felder.name }, partners);
            }
            setOffen(null);
          }}
          onDelete={
            bearbeitet
              ? () => {
                  removeEmployee(bearbeitet.id);
                  setOffen(null);
                }
              : undefined
          }
        />
      )}
    </section>
  );
}


/** Kompakte Zeile in der Liste: Name, Art, Bereich, Vertrag, Besonderheiten. */
function EmployeeSummaryRow({
  emp,
  year,
  month,
  openDates,
  workHours,
  profile,
  sharedWith,
}: {
  emp: Employee;
  year: number;
  month: number;
  openDates: readonly string[];
  workHours: WorkHoursConfig;
  profile: StoreProfile;
  sharedWith: string[];
}) {
  const monatMin = monthlyTargetMinutesFor(emp, openDates, workHours);
  const monatH = monatMin / 60;
  const info = splitInfo(monatH, emp.employmentType);
  const first = openDates[0];
  const last = openDates[openDates.length - 1];
  const schoolThisMonth = first && last
    ? (emp.schoolPeriods ?? []).filter((period) => period.start <= last && period.end >= first)
    : [];
  const daysOff = (emp.availableWeekdays ?? []).length === 0
    ? []
    : WEEKDAY_ORDER.filter((key) => !emp.availableWeekdays!.includes(key));
  const tooMany = emp.weeklyHours == null && emp.targetMinutes / 60 > WARN_HOURS;
  const windows = preferredWindowsOf(emp);

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        {emp.saved && <span className="shrink-0 text-emerald-600 text-sm" title="Đã kiểm tra thông tin">✓</span>}
        <span className="font-medium text-slate-900 truncate">{emp.name}</span>
        <span className="shrink-0 rounded bg-slate-100 text-slate-600 text-[11px] px-1.5 py-0.5">
          {employmentShortVi(emp.employmentType)}
        </span>
        <span className={`shrink-0 rounded text-[11px] px-1.5 py-0.5 ${ROLE_BADGE[emp.workRole ?? "NONE"]}`}>
          {roleLabelVi(emp.workRole, profile)}
        </span>
        {isRoleSwitchedInMonth(emp, year, month) && (
          <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
            → {roleLabelVi(monthRole(emp, year, month), profile)} tháng này
          </span>
        )}
        {sharedWith.length > 0 && (
          <span className="shrink-0 rounded bg-fuchsia-50 text-fuchsia-700 text-[11px] px-1.5 py-0.5">
            cũng làm ở {sharedWith.join(", ")}
          </span>
        )}
        {tooMany && <span className="shrink-0 text-amber-600 text-xs">⚠</span>}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
        <span>
          {emp.weeklyHours != null
            ? `${formatHours(emp.weeklyHours)}h/tuần · ${minutesToShortHours(monatMin)} tháng này · `
            : `${formatHours(emp.targetMinutes / 60)}h · `}
          <span className={info.ok ? "" : "text-rose-600"}>{info.text}</span>
        </span>
        {daysOff.length > 0 && (
          <span className="text-slate-400">· nghỉ {daysOff.map((key) => WEEKDAY_SHORT_VI[key]).join(" ")}</span>
        )}
        {emp.maxDaysPerWeek ? <span className="text-slate-400">· {emp.maxDaysPerWeek} ngày/tuần</span> : null}
        {emp.shiftHours && (
          <span className="text-teal-700">
            · ca {formatHours(emp.shiftHours.min)}–{formatHours(emp.shiftHours.max)}h
          </span>
        )}
        {emp.spreadEvenly && <span className="text-teal-700">· rải đều</span>}
        {windows.length > 0 && (
          <span className="text-teal-700">· ưu tiên {windows.map(describePreferredWindow).join(" + ")}</span>
        )}
        {emp.fixedShift ? (
          <span className="text-indigo-700">
            · ca cố định {minutesToTime(emp.fixedShift.startMinutes)}–{minutesToTime(emp.fixedShift.endMinutes)}
          </span>
        ) : null}
        {schoolThisMonth.map((period) => (
          <span key={period.start} className="rounded bg-amber-50 text-amber-800 px-1.5 py-0.5">
            học {shortDate(period.start)}–{shortDate(period.end)}
          </span>
        ))}
        {(emp.startDate || emp.endDate) && (
          <span className="text-violet-700">
            · {emp.startDate ? `vào ${shortDate(emp.startDate)}${emp.startDate.slice(0, 4)}` : ""}
            {emp.startDate && emp.endDate ? " – " : ""}
            {emp.endDate ? `nghỉ ${shortDate(emp.endDate)}${emp.endDate.slice(0, 4)}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Formular (Bottom-Sheet, mobil zuerst) – Aufbau wie Thiên Long --------

/** Große Tipp-Ziele statt Dropdowns (Hình thức, Vị trí). */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-1 rounded-lg bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2 py-2.5 text-sm font-medium transition-colors ${
            value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-2">
      <span className="text-xs font-medium text-slate-600">{children}</span>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </div>
  );
}

/** Zahlenfeld mit Dezimal-Tastatur und Einheit rechts (Komma erlaubt: 173,82). */
function HoursInput({
  value,
  onChange,
  placeholder,
  unit = "h",
  warn,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
  warn?: boolean;
}) {
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        enterKeyHint="done"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        className={`${inputClass} w-full pr-10 tabular-nums ${warn ? "border-amber-400 text-amber-900" : ""}`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
        {unit}
      </span>
    </div>
  );
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      {children}
    </section>
  );
}

/**
 * Ein Blatt zum Anlegen ODER Bearbeiten – auf dem Handy von unten, am Desktop
 * mittig. Alle Felder an einem Ort, statt in der Liste zu suchen.
 */
function EmployeeSheet({
  employee,
  year,
  month,
  openDates,
  workHours,
  profile,
  others,
  partners,
  onClose,
  onSave,
  onDelete,
}: {
  employee?: Employee;
  year: number;
  month: number;
  openDates: readonly string[];
  workHours: WorkHoursConfig;
  profile: StoreProfile;
  others: readonly OtherStore[];
  partners: PartnerChoice;
  onClose: () => void;
  onSave: (felder: Omit<Employee, "id">, partners: PartnerChoice) => void;
  onDelete?: () => void;
}) {
  const [d, setD] = useState<Draft>(() => draftFrom(employee, partners));
  const [loeschFrage, setLoeschFrage] = useState(false);
  const [showPeriod, setShowPeriod] = useState(() => !!(employee?.startDate || employee?.endDate));

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));
  const setPeriod = (index: number, patch: Partial<DateRange>) =>
    set("schoolPeriods", d.schoolPeriods.map((period, k) => (k === index ? { ...period, ...patch } : period)));

  const draftEmp: Employee = { ...draftToEmployee(d), id: employee?.id ?? "preview" };
  const monatMin = monthlyTargetMinutesFor(draftEmp, openDates, workHours);
  const info = splitInfo(monatMin / 60, d.employmentType);
  const plannedMonthly = Math.floor(monatMin / 30) * 30;
  const tooMany = d.contract === "month" && parseHours(d.hours) > WARN_HOURS;
  const isAzubi = d.employmentType === "AZUBI";
  const otherRole: WorkRole = d.role === "KITCHEN" ? "SERVICE" : "KITCHEN";
  const showSwitch = canSwitchRoleFor(d.role || undefined) && profile.workRoles.includes(otherRole);

  const periodPreview =
    d.endDate && d.startDate && d.endDate < d.startDate
      ? "Ngày nghỉ việc phải sau ngày vào làm."
      : `Tháng ${month}/${year}: khoảng ${minutesToShortHours(plannedMonthly)} (các ngày ngoài thời gian làm không xếp ca).`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full sm:max-w-md max-h-[94dvh] flex-col rounded-t-2xl sm:rounded-lg bg-white shadow-xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="font-semibold text-slate-900">{employee ? "Sửa nhân viên" : "Thêm nhân viên"}</h3>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="-mr-2 h-10 w-10 rounded-full text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-6">
          <SheetSection title="Thông tin">
            <label className="block">
              <FieldLabel>Tên</FieldLabel>
              <input
                autoFocus={!employee}
                autoCapitalize="words"
                autoComplete="off"
                enterKeyHint="next"
                className={`${inputClass} w-full`}
                value={d.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Tên nhân viên"
              />
            </label>
            <div>
              <FieldLabel>Hình thức</FieldLabel>
              <Segmented<EmploymentType>
                value={d.employmentType}
                onChange={(type) => {
                  // Azubi: Wochenvertrag 39 h als Vorschlag, wenn noch nichts eingetragen ist.
                  if (type === "AZUBI" && parseHours(d.hours) === 0) {
                    setD((prev) => ({ ...prev, employmentType: type, contract: "week", hours: "39" }));
                  } else {
                    set("employmentType", type);
                  }
                }}
                options={[
                  { value: "VOLLZEIT", label: "Toàn TG" },
                  { value: "TEILZEIT", label: "Bán TG" },
                  { value: "MINIJOB", label: "Minijob" },
                  { value: "AZUBI", label: "Azubi" },
                ]}
              />
            </div>
            <div>
              <FieldLabel hint={!d.role ? "chưa gán = tính như " + roleLabelVi("SERVICE", profile) : undefined}>Vị trí chính</FieldLabel>
              <Segmented<WorkRole>
                value={d.role}
                onChange={(role) => set("role", role)}
                options={profile.workRoles.map((role) => ({ value: role, label: roleLabelVi(role, profile) }))}
              />
            </div>
            {showSwitch && (
              <div className="rounded-lg border border-slate-200">
                <label className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-sm text-slate-700">
                    Làm được cả {roleLabelVi("KITCHEN", profile)} và {roleLabelVi("SERVICE", profile)}
                    <span className="block text-[11px] text-slate-400">
                      Tháng thiếu người có thể cho làm vị trí kia cả tháng
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={d.canSwitchRole}
                    onChange={(e) => set("canSwitchRole", e.target.checked)}
                    className="h-6 w-6 rounded border-slate-300"
                  />
                </label>
                {d.canSwitchRole && (
                  <div className="border-t border-slate-100 px-3 py-2.5">
                    <FieldLabel>Tháng {month}/{year} làm</FieldLabel>
                    <Segmented<WorkRole>
                      value={d.roleByMonth[monthKeyOf(year, month)] ?? d.role}
                      onChange={(role) => set("roleByMonth", { ...d.roleByMonth, [monthKeyOf(year, month)]: role })}
                      options={(["KITCHEN", "SERVICE"] as const).map((role) => ({
                        value: role,
                        label: `${roleLabelVi(role, profile)}${d.role === role ? " (chính)" : ""}`,
                      }))}
                    />
                  </div>
                )}
              </div>
            )}
          </SheetSection>

          <SheetSection title="Giờ làm">
            <div>
              <FieldLabel>Hợp đồng theo</FieldLabel>
              <Segmented<Draft["contract"]>
                value={d.contract}
                onChange={(v) => set("contract", v)}
                options={[
                  { value: "month", label: "Tháng" },
                  { value: "week", label: "Tuần" },
                ]}
              />
            </div>
            <div>
              <FieldLabel hint={`tháng này ≈ ${minutesToShortHours(plannedMonthly)} · ${info.text}`}>
                Giờ / {d.contract === "week" ? "tuần" : "tháng"}
              </FieldLabel>
              <HoursInput
                value={d.hours}
                placeholder={d.contract === "week" ? "39" : "173,82"}
                onChange={(v) => set("hours", v)}
                warn={tooMany}
              />
              {!info.ok && <p className="mt-1 text-xs text-rose-600">{info.text}</p>}
              {tooMany && <p className="mt-1 text-xs text-amber-700">⚠ trên {WARN_HOURS}h/tháng</p>}
            </div>
            <div>
              <FieldLabel hint="Tự = không giới hạn">Số ngày làm / tuần</FieldLabel>
              <div className="grid grid-cols-8 gap-1">
                {["", "1", "2", "3", "4", "5", "6", "7"].map((n) => (
                  <button
                    key={n || "auto"}
                    type="button"
                    aria-pressed={d.daysPerWeek === n}
                    onClick={() => set("daysPerWeek", n)}
                    className={`rounded-md border py-2.5 text-sm font-medium ${
                      d.daysPerWeek === n
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {n || "Tự"}
                  </button>
                ))}
              </div>
              {d.daysPerWeek === "7" && (
                <p className="mt-1 text-xs text-slate-500">Luật vẫn giới hạn tối đa 6 ngày/tuần.</p>
              )}
            </div>
          </SheetSection>

          <SheetSection title="Ngày nghỉ cố định">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_ORDER.map((key) => {
                const selected = d.daysOff.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => set("daysOff", selected ? d.daysOff.filter((x) => x !== key) : [...d.daysOff, key])}
                    className={`rounded-md border py-2.5 text-sm font-medium transition-colors ${
                      selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {WEEKDAY_SHORT_VI[key]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">
              {d.daysOff.length === 0
                ? "Chưa chọn = làm được mọi ngày."
                : d.daysOff.length === 7
                  ? "Không thể nghỉ cả 7 ngày – sẽ bỏ qua."
                  : "Ngày đã chọn không bao giờ xếp ca."}
            </p>
          </SheetSection>

          {(isAzubi || d.schoolPeriods.length > 0) && (
            <SheetSection title="Kỳ học (đi học không xếp ca)">
              {d.schoolPeriods.length === 0 && <p className="text-xs text-slate-400">Chưa có kỳ học.</p>}
              {d.schoolPeriods.map((period, index) => (
                <div key={index} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                  <input
                    type="date"
                    className={`${inputClass} w-full`}
                    value={period.start}
                    onChange={(e) => setPeriod(index, { start: e.target.value })}
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="date"
                    className={`${inputClass} w-full`}
                    value={period.end}
                    onChange={(e) => setPeriod(index, { end: e.target.value })}
                  />
                  <button
                    type="button"
                    aria-label="Xoá kỳ học"
                    onClick={() => set("schoolPeriods", d.schoolPeriods.filter((_, k) => k !== index))}
                    className="rounded-lg px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set("schoolPeriods", [...d.schoolPeriods, { start: "", end: "" }])}
                className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-left text-sm text-slate-600"
              >
                + Thêm kỳ học
              </button>
            </SheetSection>
          )}

          <SheetSection title="Luật riêng (mềm – xếp theo khi được)">
            <div>
              <FieldLabel hint="bỏ trống = mặc định">Độ dài ca</FieldLabel>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <HoursInput placeholder="từ" value={d.shiftMin} onChange={(v) => set("shiftMin", v)} />
                <span className="text-slate-400">–</span>
                <HoursInput placeholder="đến" value={d.shiftMax} onChange={(v) => set("shiftMax", v)} />
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
              <span className="text-sm text-slate-700">
                Rải đều trong tháng
                <span className="block text-xs text-slate-400">
                  Tuần nào cũng có ca; có Độ dài ca thì ưu tiên nhiều ca ngắn.
                </span>
              </span>
              <input
                type="checkbox"
                checked={d.spreadEvenly}
                onChange={(e) => set("spreadEvenly", e.target.checked)}
                className="h-6 w-6 rounded border-slate-300"
              />
            </label>
            <div className="space-y-2">
              <FieldLabel hint="app ưu tiên xếp ngày và giờ vào đây">Khung giờ ưu tiên</FieldLabel>
              {d.windows.map((w, i) => {
                const update = (patch: Partial<Draft["windows"][number]>) =>
                  set("windows", d.windows.map((x, k) => (k === i ? { ...x, ...patch } : x)));
                return (
                  <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-2">
                    <div className="grid grid-cols-7 gap-1">
                      {WEEKDAY_ORDER.map((key) => {
                        const on = w.days.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={on}
                            onClick={() => update({ days: on ? w.days.filter((x) => x !== key) : [...w.days, key] })}
                            className={`rounded-md border py-2 text-sm font-medium ${
                              on ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            {WEEKDAY_SHORT_VI[key]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                      <input
                        type="time"
                        step={1800}
                        className={`${inputClass} w-full`}
                        value={w.start}
                        onChange={(e) => update({ start: e.target.value })}
                      />
                      <span className="text-slate-400">–</span>
                      <input
                        type="time"
                        step={1800}
                        className={`${inputClass} w-full`}
                        value={w.end}
                        onChange={(e) => update({ end: e.target.value })}
                      />
                      <button
                        type="button"
                        aria-label="Xoá khung giờ"
                        onClick={() => set("windows", d.windows.filter((_, k) => k !== i))}
                        className="rounded-lg px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
                      >
                        ✕
                      </button>
                    </div>
                    {(w.days.length === 0 || w.end <= w.start) && (
                      <p className="text-xs text-amber-700">
                        {w.days.length === 0 ? "Chọn ít nhất một ngày." : "Giờ kết thúc phải sau giờ bắt đầu."}
                      </p>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => set("windows", [...d.windows, { days: [...WEEKDAY_ORDER], start: "12:00", end: "14:00" }])}
                className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-left text-sm text-slate-600"
              >
                + Thêm khung giờ <span className="text-slate-400">(ví dụ T2–T6 10:30–15:00)</span>
              </button>
            </div>
            <div className="rounded-lg border border-slate-200">
              <label className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-sm text-slate-700">
                  Ca cố định
                  <span className="block text-xs text-slate-400">Ngày nào làm cũng đúng khung giờ này.</span>
                </span>
                <input
                  type="checkbox"
                  checked={d.fixed}
                  onChange={(e) => set("fixed", e.target.checked)}
                  className="h-6 w-6 rounded border-slate-300"
                />
              </label>
              {d.fixed && (
                <div className="border-t border-slate-100 px-3 py-2.5">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <input
                      type="time"
                      step={1800}
                      className={`${inputClass} w-full`}
                      value={d.fixedStart}
                      onChange={(e) => set("fixedStart", e.target.value)}
                    />
                    <span className="text-slate-400">–</span>
                    <input
                      type="time"
                      step={1800}
                      className={`${inputClass} w-full`}
                      value={d.fixedEnd}
                      onChange={(e) => set("fixedEnd", e.target.value)}
                    />
                  </div>
                  {safeMinutes(d.fixedEnd, FIXED_END_DEFAULT) <= safeMinutes(d.fixedStart, FIXED_START_DEFAULT) && (
                    <p className="mt-1 text-xs text-rose-600">Giờ kết thúc phải sau giờ bắt đầu.</p>
                  )}
                </div>
              )}
            </div>
          </SheetSection>

          <SheetSection title="Thời gian làm việc">
            {!showPeriod ? (
              <button
                type="button"
                onClick={() => setShowPeriod(true)}
                className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-left text-sm text-slate-600"
              >
                + Ngày vào làm / nghỉ việc <span className="text-slate-400">(nếu không làm cả tháng)</span>
              </button>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <FieldLabel>Ngày vào làm</FieldLabel>
                    <input
                      type="date"
                      className={`${inputClass} w-full`}
                      value={d.startDate}
                      max={d.endDate || undefined}
                      onChange={(e) => set("startDate", e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Ngày nghỉ việc</FieldLabel>
                    <input
                      type="date"
                      className={`${inputClass} w-full`}
                      value={d.endDate}
                      min={d.startDate || undefined}
                      onChange={(e) => set("endDate", e.target.value)}
                    />
                  </label>
                </div>
                <p className="text-xs text-slate-500">{periodPreview}</p>
              </>
            )}
          </SheetSection>

          {/* Cùng một người ở quán kia – tạo lịch không xếp hai quán trong cùng một ngày. */}
          {others.length > 0 && (
            <SheetSection title="Cũng làm ở quán khác">
              <p className="text-xs text-slate-500">
                Chọn đúng người này trong danh sách quán kia. Khi tạo lịch, người này không bị xếp hai quán trong cùng một ngày.
              </p>
              {others.map((o) => (
                <label key={o.storeId} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="w-14 shrink-0 text-xs font-medium text-slate-600">{o.shortName}</span>
                  <select
                    className={`${inputClass} flex-1 min-w-0`}
                    value={d.partners[o.storeId] ?? ""}
                    disabled={o.locked}
                    onChange={(e) => set("partners", { ...d.partners, [o.storeId]: e.target.value })}
                  >
                    <option value="">— không —</option>
                    {o.employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  {o.locked && <span className="text-xs text-amber-700">đang khoá</span>}
                </label>
              ))}
            </SheetSection>
          )}

          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
            <span className={`text-sm ${d.saved ? "font-medium text-emerald-700" : "text-slate-700"}`}>
              Đã kiểm tra thông tin (Lưu)
            </span>
            <input
              type="checkbox"
              checked={d.saved}
              onChange={(e) => set("saved", e.target.checked)}
              className="h-6 w-6 rounded border-slate-300 text-emerald-600"
            />
          </label>
        </div>

        <div className="border-t border-slate-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {loeschFrage ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600">Xoá nhân viên này?</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setLoeschFrage(false)}
                  className="rounded-lg px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Không
                </button>
                <button
                  onClick={onDelete}
                  className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-700"
                >
                  Xoá
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  onClick={() => setLoeschFrage(true)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  Xoá
                </button>
              )}
              <button
                onClick={onClose}
                className="ml-auto rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Huỷ
              </button>
              <button
                onClick={() => onSave(draftToEmployee(d), d.partners)}
                disabled={d.name.trim().length === 0}
                className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
              >
                Lưu
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
