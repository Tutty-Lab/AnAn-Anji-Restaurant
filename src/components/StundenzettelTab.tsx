import { useMemo, useState } from "react";
import type { UseScheduleReturn } from "../hooks/useSchedule";
import type { Employee } from "../types";
import { StundenzettelPage } from "./StundenzettelPage";
import {
  buildStundenzettelPdf,
  deliver,
  safeFileName,
  sharePdf,
} from "../lib/pdf";
import { chromeIntentUrl, detectInAppBrowser } from "../lib/inAppBrowser";
import { isScheduleYearAllowed, SCHEDULE_YEAR_RANGE_LABEL } from "../lib/years";
import { effectiveWeekdayKey } from "../lib/workHours";
import { publicHolidays } from "../lib/holidays";

export function StundenzettelTab({ store }: { store: UseScheduleReturn }) {
  // Nur Stundenzettel werden ausgegeben – den Dienstplan druckt die App nicht mehr.
  const { schedule, isLocked, unlockMonth, generate } = store;

  const hasSplitSunday = useMemo(() => {
    const holidays = publicHolidays(schedule.year);
    for (const s of schedule.shifts) {
      if (effectiveWeekdayKey(s.date, holidays) === "sunday") {
        const count = schedule.shifts.filter(
          (other) => other.date === s.date && other.employeeId === s.employeeId,
        ).length;
        // CN là ca liền (tab Tài liệu); ca dài ở CN là đúng hệ số 1,5, chỉ báo khi bị chia 2 ca.
        if (count > 1) return true;
      }
    }
    return false;
  }, [schedule.year, schedule.shifts]);

  // Trình duyệt nhúng (Zalo, Messenger, Facebook …) không lưu được file tải thẳng.
  const inApp = useMemo(
    () => detectInAppBrowser(typeof navigator === "undefined" ? "" : navigator.userAgent),
    [],
  );
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;
  const chromeUrl = inApp.platform === "android" ? chromeIntentUrl(pageUrl) : null;

  // ── Auswahl: WER (eine Person oder der ganze Laden) und WAS ─────────────
  // who: "all" = ganzer Laden, sonst eine employeeId.
  const [who, setWho] = useState<string>("all");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<string>("");
  /** Lỗi tạo PDF – hiện ngay trên trang (alert bị trình duyệt nhúng chặn). */
  const [pdfError, setPdfError] = useState<string | null>(null);
  /** Trình duyệt nhúng: PDF đã tạo xong, chờ người dùng bấm Lưu / Chia sẻ. */
  const [readyPdf, setReadyPdf] = useState<{ blob: Blob; filename: string } | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);


  /** Zweiter Klick für das Entsperren – ohne native Dialoge, siehe unten. */
  const [confirmUnlock, setConfirmUnlock] = useState(false);

  const monthTag = `${schedule.year}-${String(schedule.month).padStart(2, "0")}`;

  // Für WER: die betroffenen Mitarbeiter (Reihenfolge wie im Plan).
  const chosenEmployees =
    who === "all"
      ? schedule.employees
      : schedule.employees.filter((e) => e.id === who);
  // Für die Vorschau und die Dateinamen: eine konkrete Person.
  const previewEmployee =
    who === "all" ? schedule.employees[0] ?? null : chosenEmployees[0] ?? null;
  const whoTag = who === "all" ? "tat_ca" : safeFileName(previewEmployee?.name ?? who);

  const startPdf = () => {
    setPdfBusy(true);
    setPdfError(null);
    setReadyPdf(null);
    setShareNote(null);
  };
  const progress = (current: number, total: number) => {
    if (total > 1) setPdfProgress(`${current}/${total}`);
  };
  /** Rechner/Chrome/Safari: đã tải thẳng. Trình duyệt nhúng: giữ file để bấm Lưu / Chia sẻ. */
  const finishPdf = (blob: Blob | null, filename: string) => {
    if (inApp.inApp && blob) setReadyPdf({ blob, filename });
  };
  const errorText = (err: unknown) =>
    `Không tạo được PDF: ${err instanceof Error ? err.message : String(err)}`;

  /**
   * Stundenzettel-PDF: echtes Vektor-PDF direkt aus den Daten (jsPDF zeichnet
   * Text und Linien). Kein Screenshot der Seite mehr – deshalb gibt es keine
   * Offscreen-Bühne, kein Warten auf Schriften und kein Gerät, auf dem die
   * Tabelle plötzlich anders aussieht.
   */
  async function doPdf(
    list: Employee[],
    filename: string,
    sz?: { dates?: string[]; label?: string },
  ) {
    if (list.length === 0 || pdfBusy) return;
    startPdf();
    setPdfProgress(list.length > 1 ? `1/${list.length}` : "");
    // Kurzer Yield, damit „Đang tạo PDF…" zuerst sichtbar wird.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const doc = await buildStundenzettelPdf(
        schedule,
        list,
        { dates: sz?.dates, periodLabel: sz?.label },
        progress,
      );
      const blob = doc.output("blob");
      if (!inApp.inApp) await deliver(blob, filename);
      finishPdf(blob, filename);
    } catch (err) {
      setPdfError(errorText(err));
    } finally {
      setPdfBusy(false);
      setPdfProgress("");
    }
  }

  /** Gọi trực tiếp trong lúc bấm – bảng Chia sẻ cần thao tác người dùng còn "mới". */
  async function onSharePdf() {
    if (!readyPdf) return;
    const result = await sharePdf(readyPdf.blob, readyPdf.filename);
    if (result === "shared") {
      setReadyPdf(null);
      setShareNote(null);
    } else if (result !== "cancelled") {
      setShareNote(
        `${inApp.name ?? "Trình duyệt này"} không cho lưu hoặc chia sẻ file. Hãy mở app bằng trình duyệt (Chrome/Safari) rồi xuất lại.`,
      );
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
    } catch {
      setCopied(false);
      setShareNote("Không sao chép tự động được – hãy giữ tay vào ô link bên dưới để sao chép.");
    }
  }

  const openInBrowserHelp = (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {chromeUrl && (
          <a
            href={chromeUrl}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Mở bằng Chrome
          </a>
        )}
        <button
          type="button"
          onClick={() => void copyLink()}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? "Đã sao chép link" : "Sao chép link"}
        </button>
      </div>
      <p className="text-xs">
        {inApp.platform === "ios"
          ? "Hoặc bấm ⋯ ở góc trên → Mở trong Safari (hoặc trình duyệt), rồi xuất PDF lại."
          : "Hoặc bấm ⋮ ở góc trên → Mở bằng trình duyệt, rồi xuất PDF lại."}
      </p>
      <input
        readOnly
        value={pageUrl}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600"
        aria-label="Link của app"
      />
    </div>
  );

  // Immer der ganze Monat (Wochen-Stundenzettel gibt es nicht mehr).
  function onPdf() {
    void doPdf(chosenEmployees, `Stundenzettel_${whoTag}_${monthTag}.pdf`);
  }

  // Vùng in KHÔNG được dọn theo sự kiện "afterprint": trên Android sự kiện đó
  // bắn ra ngay khi gọi window.print(), trước lúc trình duyệt dựng xong trang
  // — nội dung bị xoá mất và tờ in ra trắng. Vùng này vốn đã ẩn trên màn hình
  // nên cứ để nguyên; lần in sau sẽ ghi đè bằng danh sách mới.

  if (schedule.employees.length === 0) {
    return (
      <div className="no-print rounded bg-white border border-slate-200 p-6 text-center text-slate-400">
        Vui lòng thêm nhân viên và tạo lịch làm việc trước.
      </div>
    );
  }

  const hasSchedule = schedule.shifts.length > 0;

  return (
    <>
      {/* Điều khiển (không in) */}
      <div className="no-print">
        {/* ---- Xuất PDF: eine Leiste rechts wie demo-studenzettell (Cho ai · Kỳ · Xuất PDF) ---- */}
        <div className="mb-3">

          {inApp.inApp && !readyPdf && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-semibold">
                Bạn đang mở app trong {inApp.name}
              </div>
              <p className="mt-0.5 text-xs">
                Trình duyệt trong {inApp.name} không tải được file PDF thẳng về máy. Bạn vẫn có thể tạo
                PDF rồi bấm <b>Lưu / Chia sẻ PDF</b>; nếu máy không cho, hãy mở app bằng trình duyệt.
              </p>
              {openInBrowserHelp}
            </div>
          )}

          {/* Handy: alles in EINER Zeile (zwei Felder teilen sich die Breite, Knopf rechts). */}
          <div className="flex items-center gap-2 sm:justify-end">
            {/* WER */}
            <select
              aria-label="Cho ai"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 sm:flex-none"
              value={who}
              onChange={(e) => setWho(e.target.value)}
            >
              <option value="all">Cả quán ({schedule.employees.length})</option>
              {schedule.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button
              disabled={pdfBusy || !hasSchedule || !isScheduleYearAllowed(schedule.year)}
              onClick={onPdf}
              className="shrink-0 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 active:bg-slate-800 disabled:opacity-40"
            >
              {pdfBusy ? `Đang tạo PDF ${pdfProgress ? `(${pdfProgress})` : "…"}` : "Xuất PDF"}
            </button>
          </div>

          {pdfError && (
            <div role="alert" className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
              <span>{pdfError}</span>
              <button type="button" onClick={() => setPdfError(null)} className="text-rose-700 hover:text-rose-900" aria-label="Đóng">
                ✕
              </button>
            </div>
          )}

          {readyPdf && (
            <div role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">PDF đã sẵn sàng</div>
                  <div className="text-xs break-all">{readyPdf.filename}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setReadyPdf(null); setShareNote(null); }}
                  className="text-emerald-800 hover:text-emerald-950"
                  aria-label="Đóng"
                >
                  ✕
                </button>
              </div>
              <button
                type="button"
                onClick={() => void onSharePdf()}
                className="mt-2 rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Lưu / Chia sẻ PDF
              </button>
              <p className="mt-1 text-xs">
                Trong bảng chia sẻ chọn <b>Lưu vào Tệp</b> (iPhone) hoặc gửi qua Zalo/Mail.
              </p>
              {shareNote && (
                <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
                  <div className="text-sm">{shareNote}</div>
                  {openInBrowserHelp}
                </div>
              )}
            </div>
          )}

          {hasSplitSunday && (
            <div className="mt-3 rounded-lg bg-blue-50 border border-blue-300 p-3 text-blue-950 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
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
                onClick={() => {
                  if (isLocked) unlockMonth();
                  generate();
                }}
                className="whitespace-nowrap rounded bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 active:bg-blue-800 shadow"
              >
                Cập nhật lại lịch chuẩn ngay
              </button>
            </div>
          )}

          {!isScheduleYearAllowed(schedule.year) && (
            <p role="alert" className="mt-2 text-sm text-rose-700">
              Chỉ xuất lịch cho các năm {SCHEDULE_YEAR_RANGE_LABEL}. Tạo lịch cho năm trong khoảng này ở tab „Lịch làm việc".
            </p>
          )}

          {isLocked && (
            <div className="mt-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2">
              <div className="font-medium">
                Lịch tháng này đã khóa vì đã in
                {schedule.lockedAt &&
                  ` lúc ${new Date(schedule.lockedAt).toLocaleString("vi-VN")}`}
                .
              </div>
              <div className="mt-0.5">
                Không sửa được ca, không đổi nhân viên. Vẫn in được bình thường. (Tạo lại lịch ở tab
                „Lịch làm việc" cũng sẽ mở khóa.)
              </div>

              {/*
                Bewusst KEIN window.confirm: In-App-Browser (Messenger,
                Facebook) unterdrücken die native Rückfrage teilweise. Sie
                liefert dann stillschweigend false, der Klick tut nichts, und
                niemand erfährt warum. Die Rückfrage steht deshalb direkt hier.
              */}
              {!confirmUnlock ? (
                <button
                  onClick={() => setConfirmUnlock(true)}
                  className="mt-2 rounded border border-amber-400 bg-white px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100"
                >
                  Mở khóa
                </button>
              ) : (
                <div className="mt-2 rounded border border-amber-300 bg-white px-3 py-2">
                  <div className="text-amber-900">
                    Mở khóa lịch tháng này? Bản đã in ở quán sẽ không còn khớp với hệ thống. Sau
                    khi sửa, hãy in lại tuần đó và thay bản cũ.
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        unlockMonth();
                        setConfirmUnlock(false);
                      }}
                      className="rounded bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      Xác nhận mở khóa
                    </button>
                    <button
                      onClick={() => setConfirmUnlock(false)}
                      className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Xem trước trên màn hình cho nhân viên đã chọn */}
        {previewEmployee && (
          <>
            <div className="rounded-lg border border-slate-200 shadow-sm bg-white overflow-x-auto">
              <StundenzettelPage schedule={schedule} employee={previewEmployee} />
            </div>
          </>
        )}
      </div>

    </>
  );
}
