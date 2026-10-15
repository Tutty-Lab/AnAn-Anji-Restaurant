import { useState } from "react";
import type { UseScheduleReturn } from "../hooks/useSchedule";
import type { Employee, Schedule } from "../types";
import { minutesToDecimalHours } from "../lib/time";
import { monthlyTargetMinutesFor } from "../lib/contract";

/** "2026-08-27" -> "27.08." – kurz, weil oft mehrere Tage nebeneinander stehen. */
function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}.${month}.`;
}

/**
 * Aufklappbarer Hinweis: eine Zeile mit Zusammenfassung und (i)-Knopf; die
 * ausführliche Begründung erscheint erst beim Klick. So steht bei einer Warnung
 * nicht mehr die ganze Liste dauerhaft auf dem Bildschirm.
 */
function InfoNote({
  tone,
  summary,
  children,
}: {
  tone: "error" | "warning";
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const cls =
    tone === "error"
      ? "bg-rose-50 border-rose-200 text-rose-900"
      : "bg-amber-50 border-amber-200 text-amber-900";
  const icon = tone === "error" ? "✕" : "!";
  const badge = tone === "error" ? "bg-rose-200 text-rose-800" : "bg-amber-200 text-amber-800";
  return (
    <div className={`mt-2 rounded border text-sm ${cls}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`}>
          {icon}
        </span>
        <span className="flex-1 font-medium">{summary}</span>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/40 text-xs font-semibold opacity-70"
          title={open ? "Ẩn chi tiết" : "Xem chi tiết vì sao"}
        >
          {open ? "×" : "i"}
        </span>
      </button>
      {open && <div className="border-t border-current/15 px-3 py-2 font-normal">{children}</div>}
    </div>
  );
}

/** Warum erreicht diese Person ihr Soll nicht? Aus ihren Feldern abgeleitet. */
function underQuotaReason(emp: Employee | undefined, schedule: Schedule): string {
  if (!emp) return "tháng này không đủ ngày cho định mức đó.";
  const prefix = `${schedule.year}-${String(schedule.month).padStart(2, "0")}-`;
  const parts: string[] = [];
  if (emp.startDate && emp.startDate.startsWith(prefix)) {
    parts.push(`vào làm từ ${shortDate(emp.startDate)} (các ngày trước không tính)`);
  }
  if (emp.endDate && emp.endDate.startsWith(prefix)) {
    parts.push(`thôi làm sau ${shortDate(emp.endDate)} (các ngày sau không tính)`);
  }
  const monthEnd = `${prefix}31`;
  const school = (emp.schoolPeriods ?? []).filter((period) => period.start <= monthEnd && period.end >= `${prefix}01`);
  if (school.length > 0) {
    parts.push(`đang trong kỳ học ${school.map((period) => `${shortDate(period.start)}–${shortDate(period.end)}`).join(", ")}`);
  }
  if (emp.availableWeekdays && emp.availableWeekdays.length > 0 && emp.availableWeekdays.length < 7) {
    parts.push(`chỉ làm ${emp.availableWeekdays.length} ngày cố định trong tuần`);
  }
  if (emp.maxDaysPerWeek != null && emp.maxDaysPerWeek < 6) {
    parts.push(`giới hạn ${emp.maxDaysPerWeek} ngày/tuần`);
  }
  if (parts.length === 0) {
    return "hợp đồng theo tuần cao hơn số ngày quán mở trong tháng — tháng này không đủ ngày để xếp đủ giờ.";
  }
  return `do ${parts.join("; ")}.`;
}

/** Kennzahlen EINES Ladens – Grundlage für die Summe und den Kurzstatus je Laden. */
function storeFigures(store: UseScheduleReturn) {
  const { schedule, validation, openDates } = store;
  // Wochenverträge (weeklyHours) haben targetMinutes = 0; das Monats-Soll wird
  // erst über die offenen Tage abgeleitet (contract.ts), genau wie in der Prüfung.
  const targetMin = schedule.employees.reduce((s, e) => s + monthlyTargetMinutesFor(e, openDates, schedule.workHours), 0);
  const plannedMin = schedule.shifts.reduce((s, x) => s + x.paidMinutes, 0);
  return {
    targetMin,
    plannedMin,
    notGenerated: schedule.shifts.length === 0,
    // Warnungen und Fehler getrennt: ein zu hohes Monats-Soll macht den Plan nicht
    // unbrauchbar, es fehlen nur Stunden, die der Monat nicht hergibt.
    warnungen: validation.errors.filter((e) => e.severity === "warning"),
    fehler: validation.errors.filter((e) => e.severity !== "warning"),
  };
}

const hours = (min: number) => `${minutesToDecimalHours(min, 1)} h`;

/**
 * Eine Karte wie in demo-studenzettell: verplante Stunden beider Läden als
 * Balken + Status, darunter je Laden ein Knopf mit Kurzstatus (wechselt den
 * angezeigten Laden). Die Hinweise darunter gelten für den gewählten Laden.
 */
export function Dashboard({
  stores,
  view,
  onChooseStore,
}: {
  stores: readonly UseScheduleReturn[];
  view: UseScheduleReturn;
  onChooseStore: (storeId: string) => void;
}) {
  const figures = stores.map((store) => ({ store, f: storeFigures(store) }));
  const sum = (pick: (f: ReturnType<typeof storeFigures>) => number) => figures.reduce((t, x) => t + pick(x.f), 0);
  const targetMinAll = sum((f) => f.targetMin);
  const plannedMinAll = sum((f) => f.plannedMin);
  const uncoveredAll = Math.max(0, targetMinAll - plannedMinAll);
  const fehlerAll = sum((f) => f.fehler.length);
  const warnAll = sum((f) => f.warnungen.length);
  const notGeneratedCount = figures.filter((x) => x.f.notGenerated && x.store.schedule.employees.length > 0).length;
  const statusText =
    notGeneratedCount === stores.length
      ? "Chưa tạo lịch"
      : fehlerAll > 0
        ? `${fehlerAll} lỗi`
        : warnAll > 0
          ? `${warnAll} cảnh báo`
          : notGeneratedCount > 0
            ? `${notGeneratedCount} quán chưa có lịch`
            : "✓ Hợp lệ";
  const statusPill =
    notGeneratedCount === stores.length
      ? "bg-slate-100 text-slate-500"
      : fehlerAll > 0
        ? "bg-rose-50 text-rose-700"
        : warnAll > 0 || notGeneratedCount > 0
          ? "bg-amber-50 text-amber-700"
          : "bg-emerald-50 text-emerald-700";
  const pct = targetMinAll > 0 ? Math.min(100, Math.round((plannedMinAll / targetMinAll) * 100)) : 0;

  const { schedule, peakGaps } = view;
  const byId = new Map(schedule.employees.map((e) => [e.id, e] as const));
  const { notGenerated, warnungen, fehler } = storeFigures(view);

  return (
    <div>
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-500">
            Giờ đã xếp · <b className="font-semibold text-slate-700">{String(view.schedule.month).padStart(2, "0")}/{view.schedule.year}</b>
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill}`}>{statusText}</span>
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold text-slate-900">{minutesToDecimalHours(plannedMinAll, 0)}</span>
          <span className="text-sm text-slate-500">/ {hours(targetMinAll)} định mức</span>
        </div>
        {/* Dunkel = verplant, Gelb = fehlt noch (Giờ chưa thể xếp). Farbe nur für Status. */}
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="bg-slate-700" style={{ width: `${pct}%` }} />
          {uncoveredAll > 0 && plannedMinAll > 0 && <div className="bg-amber-300" style={{ width: `${100 - pct}%` }} />}
        </div>
        {uncoveredAll > 0 && notGeneratedCount < stores.length && (
          <div className="mt-1.5 text-xs text-slate-600">
            Còn thiếu <b className="text-amber-700">{hours(uncoveredAll)}</b> chưa xếp được
          </div>
        )}
        {/* Quán đang xem – je Laden ein Knopf mit Kurzstatus. */}
        <div role="tablist" aria-label="Quán" className="mt-2 flex flex-wrap gap-1.5">
          {figures.map(({ store, f }) => {
            const active = store.storeId === view.storeId;
            const [text, cls] = f.notGenerated
              ? ["chưa tạo", active ? "text-slate-300" : "text-slate-400"]
              : f.fehler.length > 0
                ? [`${f.fehler.length} lỗi`, active ? "text-rose-300" : "text-rose-600"]
                : f.warnungen.length > 0
                  ? [`${f.warnungen.length} cảnh báo`, active ? "text-amber-300" : "text-amber-600"]
                  : ["ổn", active ? "text-emerald-300" : "text-emerald-600"];
            return (
              <button
                key={store.storeId}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChooseStore(store.storeId)}
                className={`rounded-lg border px-3 py-1 text-sm font-medium ${
                  active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {store.profile.shortName} <span className={`text-xs font-normal ${cls}`}>· {text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {notGenerated && schedule.employees.length > 0 && (
        <div className="mt-2 rounded bg-sky-50 border border-sky-200 text-sky-800 text-sm px-3 py-2">
          {view.profile.shortName}: chưa có lịch — bấm <b>Tạo lịch</b>.
        </div>
      )}

      {/* Lỗi: gộp sau nút (i). */}
      {fehler.length > 0 && (
        <InfoNote tone="error" summary={`${fehler.length} lỗi cần sửa trước khi dùng lịch`}>
          <ul className="space-y-1">
            {fehler.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </InfoNote>
      )}

      {/* Cảnh báo thiếu giờ: một dòng + (i) mở chi tiết vì sao từng người. */}
      {warnungen.length > 0 && schedule.shifts.length > 0 && (
        <InfoNote tone="warning" summary={`${warnungen.length} người chưa đủ giờ định mức (lịch vẫn dùng được)`}>
          <ul className="space-y-1.5">
            {warnungen.map((w, i) => {
              const emp = w.employeeId ? byId.get(w.employeeId) : undefined;
              return (
                <li key={i}>
                  <div>{w.message}</div>
                  <div className="opacity-80">→ Vì sao: {underQuotaReason(emp, schedule)}</div>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 opacity-80">
            App đã xếp kín các ngày hợp lệ trong từng tuần và chia đều giờ mỗi người. Không thể tự
            chuyển giờ sang người/tuần khác vì sẽ vượt hợp đồng — muốn thêm giờ thì đổi ngày vào làm,
            ngày nghỉ, availability hoặc hợp đồng của người đó.
          </div>
        </InfoNote>
      )}

      {/* Cao điểm lệch số người: một dòng + (i). */}
      {peakGaps.length > 0 && (
        <InfoNote tone="warning" summary={`${peakGaps.length} ngày lệch số người ở giờ cao điểm`}>
          <div className="space-y-0.5">
            {peakGaps.slice(0, 8).map((d) => (
              <div key={d.date}>
                <b>{shortDate(d.date)}</b>{" "}
                {d.peaks
                  .filter((p) => !p.ok)
                  .map((p) =>
                    p.minStaff < p.required
                      ? `${p.label} thiếu: ${p.minStaff}/${p.required} người`
                      : `${p.label} thừa: ${p.maxStaff}, tối đa ${p.allowed}`,
                  )
                  .join(" · ")}{" "}
                <span className="opacity-70">({d.shiftCount} ca, {d.paidHours}h)</span>
              </div>
            ))}
            {peakGaps.length > 8 && <div className="opacity-70">… và {peakGaps.length - 8} ngày nữa</div>}
          </div>
          <div className="mt-2 opacity-80">
            → Vì sao: có lúc số người của một nhóm chưa khớp khung yêu cầu (bếp ≥ 1, phục vụ ≥ 2 suốt giờ mở,
            bếp trưa đúng 2, tối 18–21h, lái xe mỗi tối). Thường là nhóm đó không đủ giờ hợp đồng để phủ
            hết – xem giờ nào ở <b>Độ phủ</b>. Cách xử lý: thêm giờ/người cho nhóm thiếu, sửa tay ca đó,
            hoặc chấp nhận vì lịch vẫn hợp lệ.
          </div>
        </InfoNote>
      )}
    </div>
  );
}
