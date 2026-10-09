import { useEffect, useMemo, useState } from "react";
import { useSchedule } from "./hooks/useSchedule";
import { GenerateScheduleDialog } from "./components/GenerateScheduleDialog";
import { SettingsTab } from "./components/SettingsTab";
import { EmployeesTab } from "./components/EmployeesTab";
import { ScheduleTab } from "./components/ScheduleTab";
import { StundenzettelTab } from "./components/StundenzettelTab";
import { DocsTab } from "./components/DocsTab";
import { Dashboard } from "./components/Dashboard";
import { LockScreen } from "./components/LockScreen";
import { isAuthenticated, logout } from "./lib/auth";
import { MONTH_NAMES_VI } from "./lib/dateFormat";
import { isScheduleYearAllowed, SCHEDULE_YEARS } from "./lib/years";
import { ANAN_PROFILE, ANJI_PROFILE, STORE_PROFILES } from "./lib/stores";
import { crossStoreConflicts, crossStoreRunIssues, planAcrossStores } from "./lib/sharedPerson";

/** Zuletzt angezeigter Laden (nur Ansicht, je Gerät). */
const VIEW_KEY = "stundenzettel-app:view-store";

type TabId = "einstellungen" | "mitarbeiter" | "dienstplan" | "stundenzettel";

/**
 * Alle Ansichten. Als Tab sichtbar sind die drei, mit denen täglich gearbeitet
 * wird (MAIN_TABS); Cài đặt und Tài liệu stecken im Menü ☰ oben rechts – wie
 * in den Apps Shin/Coco/Nieu und Thiên Long.
 */
const TABS: { id: TabId; label: string }[] = [
  { id: "dienstplan", label: "Lịch làm việc" },
  { id: "stundenzettel", label: "Bảng chấm công" },
  { id: "mitarbeiter", label: "Nhân viên" },
  { id: "einstellungen", label: "Cài đặt" },
];
const MAIN_TABS: TabId[] = ["dienstplan", "stundenzettel", "mitarbeiter"];

export default function App() {
  const [unlocked, setUnlocked] = useState(() => isAuthenticated());

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;
  return <MainApp onLogout={() => setUnlocked(false)} />;
}

function MainApp({ onLogout }: { onLogout: () => void }) {
  // Beide Läden laufen gleichzeitig – jeder mit eigenem State, eigener
  // Persistenz und eigener Sync. Angezeigt wird der Laden, der in der Reihe
  // unter den Tabs gewählt ist; erzeugt wird für beide zusammen, wegen der Leute,
  // die in beiden Läden arbeiten.
  const anan = useSchedule(ANAN_PROFILE.id);
  const anji = useSchedule(ANJI_PROFILE.id);
  const stores = [anan, anji];
  const [viewId, setViewId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved && STORE_PROFILES.some((p) => p.id === saved)) return saved;
    } catch {
      // Speicher gesperrt – dann der erste Laden.
    }
    return STORE_PROFILES[0].id;
  });
  const chooseStore = (id: string) => {
    setViewId(id);
    try {
      localStorage.setItem(VIEW_KEY, id);
    } catch {
      // egal – nur eine Bequemlichkeit
    }
  };
  /** Der angezeigte Laden. */
  const view = stores.find((s) => s.storeId === viewId) ?? anan;
  // Monat/Jahr sind für beide gleich (der Ausdruck muss zusammenpassen). Der Kopf
  // steuert beide; angezeigt wird der Stand des ersten Ladens.
  const primary = anan;

  const [tab, setTab] = useState<TabId>("dienstplan");
  const [menuOpen, setMenuOpen] = useState(false);
  /** Trang Tài liệu mở riêng; đóng lại thì về đúng tab đang làm. */
  const [docsOpen, setDocsOpen] = useState(false);

  const openTab = (id: TabId) => {
    setTab(id);
    setDocsOpen(false);
  };

  /**
   * Beide Läden nacheinander planen. Wer in beiden arbeitet (personKey), ist an
   * seinen schon verplanten Tagen im nächsten Laden gesperrt – eine Person
   * arbeitet an einem Tag nur in einem Laden (Vorgabe des Betriebs).
   */
  const generateAll = (target: { year: number; month: number }) => {
    planAcrossStores(stores.map((s) => ({ employees: s.schedule.employees, plan: (blocked, caps) => s.generate(target, blocked, caps) })));
  };

  /** Monat/Jahr für BEIDE Läden setzen. */
  const setPeriod = (patch: { year?: number; month?: number }) => {
    for (const s of stores) s.updateMeta(patch);
  };

  /** Dieselbe Person an einem Tag in beiden Läden (z. B. nach einer Hand-Änderung). */
  const { conflicts, runIssues } = useMemo(() => {
    const list = stores.map((s) => ({ storeId: s.storeId, shortName: s.profile.shortName, schedule: s.schedule }));
    return { conflicts: crossStoreConflicts(list), runIssues: crossStoreRunIssues(list) };
  }, [anan.schedule, anji.schedule]); // eslint-disable-line react-hooks/exhaustive-deps

  // „Tạo lịch" sitzt über den Tabs – erreichbar von jedem Tab aus. Popup statt
  // window.confirm: eingebettete Browser (Messenger, Zalo) schlucken den.
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  // Kurze Erfolgsmeldung nach dem Erzeugen. genStamp steigt bei jedem
  // erfolgreichen Lauf; der Effekt liest DANACH die (frische) Prüfung beider Läden.
  const [toast, setToast] = useState<string | null>(null);
  const genStampSum = stores.reduce((sum, s) => sum + s.genStamp, 0);
  useEffect(() => {
    if (genStampSum === 0) return;
    const allErrors = stores.flatMap((s) => s.validation.errors);
    const fehler = allErrors.filter((e) => e.severity !== "warning").length;
    const warn = allErrors.filter((e) => e.severity === "warning").length;
    setToast(
      fehler > 0
        ? `Đã tạo lịch ${stores.length} quán — nhưng còn ${fehler} lỗi, xem chi tiết ở phần trạng thái.`
        : warn > 0
          ? `✓ Đã tạo lịch ${stores.length} quán (còn ${warn} cảnh báo — bấm (i) để xem).`
          : `✓ Đã tạo lịch mới cho cả ${stores.length} quán — hợp lệ, đúng giờ hợp đồng.`,
    );
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [genStampSum]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen">
      <header className="no-print bg-slate-900 text-white shadow sticky top-0 z-30">
        <div className="mx-auto max-w-[1500px] px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-semibold" title={`bản ${__BUILD__}`}>
              AnAn &amp; Anji · Lịch làm việc &amp; Bảng chấm công
            </h1>
            {/* Nur ein SYNC-FEHLER wird gezeigt: dann liegen Daten nur auf diesem Gerät. */}
            {stores.some((s) => s.remoteStatus === "error") && (
              <p className="text-xs text-rose-300">Lỗi đồng bộ — dữ liệu chỉ lưu trên máy này</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Tháng/năm dùng chung cho cả hai quán – bản in phải cùng kỳ. */}
            <select
              aria-label="Tháng"
              value={`${primary.schedule.year}-${primary.schedule.month}`}
              onChange={(e) => {
                const [year, month] = e.target.value.split("-").map(Number);
                setPeriod({ year, month });
              }}
              className="rounded-md border border-slate-600 bg-white px-2 py-1.5 text-sm font-medium text-slate-900"
            >
              {(isScheduleYearAllowed(primary.schedule.year)
                ? SCHEDULE_YEARS
                : [primary.schedule.year, ...SCHEDULE_YEARS]
              ).flatMap((y) =>
                MONTH_NAMES_VI.map((_, i) => (
                  <option key={`${y}-${i + 1}`} value={`${y}-${i + 1}`} className="bg-white text-slate-900">
                    {String(i + 1).padStart(2, "0")}/{y}
                  </option>
                )),
              )}
            </select>
            {/* Aus dem Menü geöffnete Seite: steht direkt neben dem Menü, mit ✕ zurück. */}
            {(docsOpen || !MAIN_TABS.includes(tab)) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white py-1.5 pl-3 pr-1 text-sm font-medium text-slate-900">
                {docsOpen ? "Tài liệu" : TABS.find((t) => t.id === tab)?.label}
                <button
                  type="button"
                  onClick={() => openTab("dienstplan")}
                  aria-label="Đóng"
                  className="rounded px-1.5 text-slate-400 hover:text-slate-900"
                >
                  ✕
                </button>
              </span>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className={`rounded px-3 py-2 text-sm font-medium ${menuOpen ? "bg-white text-slate-900" : "bg-slate-700 hover:bg-slate-600"}`}
              >
                ☰ Menu
              </button>
              {menuOpen && (
                <>
                  {/* Klick daneben schließt das Menü. */}
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm text-slate-800 shadow-lg"
                  >
                    {(
                      [
                        ["Cài đặt", () => openTab("einstellungen")],
                        ["Tài liệu", () => setDocsOpen(true)],
                      ] as const
                    ).map(([label, action]) => (
                      <button
                        key={label}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          action();
                          setMenuOpen(false);
                        }}
                        className="block w-full px-4 py-2 text-left hover:bg-slate-50"
                      >
                        {label}
                      </button>
                    ))}
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        if (confirm(`Xoá toàn bộ dữ liệu của cả ${stores.length} quán?`)) {
                          for (const s of stores) s.resetAll();
                        }
                      }}
                      className="block w-full px-4 py-2 text-left text-rose-700 hover:bg-rose-50"
                    >
                      Xoá dữ liệu
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                        onLogout();
                      }}
                      className="block w-full px-4 py-2 text-left hover:bg-slate-50"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Quán đang xem – một hàng nhãn dùng chung cho mọi tab. */}
      {!docsOpen && (
        <div className="no-print mx-auto max-w-[1500px] px-3 sm:px-4 pt-4">
          <div role="tablist" aria-label="Quán" className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            {stores.map((s) => {
              const active = s.storeId === view.storeId;
              return (
                <button
                  key={s.storeId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => chooseStore(s.storeId)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {s.profile.shortName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="no-print mx-auto max-w-[1500px] px-3 sm:px-4 pt-4 space-y-3">
        {runIssues.length > 0 && (
          <div role="alert" className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            <div className="font-semibold">Người làm 2 quán vượt luật ngày nghỉ</div>
            <ul className="mt-1 list-disc pl-5">
              {runIssues.map((issue) => (
                <li key={`${issue.personKey}-${issue.message}`}>{issue.name}: {issue.message}</li>
              ))}
            </ul>
          </div>
        )}
        {conflicts.length > 0 && (
          <div role="alert" className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            <div className="font-semibold">Một người làm 2 quán trong cùng một ngày</div>
            <ul className="mt-1 list-disc pl-5">
              {conflicts.slice(0, 8).map((c) => (
                <li key={`${c.personKey}-${c.date}`}>
                  {c.name}: {c.date.slice(8)}.{c.date.slice(5, 7)}. ở {c.stores.join(" và ")}
                </li>
              ))}
              {conflicts.length > 8 && <li>… và {conflicts.length - 8} ngày khác</li>}
            </ul>
          </div>
        )}
        <Dashboard key={view.storeId} store={view} />
      </div>

      <nav className="no-print mx-auto max-w-[1500px] px-3 sm:px-4 mt-4">
        <div className="flex flex-wrap gap-2">
          {TABS.filter((t) => MAIN_TABS.includes(t.id)).map((t) => {
            const active = !docsOpen && tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => openTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={`px-3.5 py-2 text-sm font-medium rounded-full border ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                {t.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setGenDialogOpen(true)}
            disabled={stores.every((s) => s.schedule.employees.length === 0)}
            className="ml-auto rounded-lg border border-emerald-700 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40"
          >
            Tạo lịch
          </button>
        </div>
      </nav>

      {/* Popup chọn tháng/năm – nhắc kiểm tra ngày lễ/giờ đặc biệt, cảnh báo thay lịch và mở khóa. */}
      {genDialogOpen && (
        <GenerateScheduleDialog
          currentYear={primary.schedule.year}
          currentMonth={primary.schedule.month}
          hasShifts={stores.some((s) => s.schedule.shifts.length > 0)}
          isLocked={stores.some((s) => s.isLocked)}
          dateOverrides={stores.flatMap((s) => s.schedule.dateOverrides)}
          onClose={() => setGenDialogOpen(false)}
          onOpenSettings={() => {
            setGenDialogOpen(false);
            openTab("einstellungen");
          }}
          onConfirm={(target) => {
            setGenDialogOpen(false);
            generateAll(target);
            openTab("dienstplan");
          }}
        />
      )}

      {(stores.some((s) => s.genError) || toast) && (
        <div className="no-print mx-auto max-w-[1500px] px-3 sm:px-4 mt-3 space-y-2">
          {stores
            .filter((s) => s.genError)
            .map((s) => (
              <div key={s.storeId} role="alert" className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {s.profile.shortName}: {s.genError}
              </div>
            ))}
          {/* Erfolgsmeldung nach „Tạo lịch"; Details zu Warnungen/Fehlern stehen aufklappbar im Dashboard. */}
          {toast && (
            <div
              role="status"
              className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${
                toast.startsWith("✓")
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <span className="flex-1">{toast}</span>
              <button type="button" onClick={() => setToast(null)} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Đóng">
                ×
              </button>
            </div>
          )}
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-3 sm:px-4 py-4">
        {docsOpen ? (
          <div className="no-print">
            <button
              type="button"
              onClick={() => setDocsOpen(false)}
              className="mb-3 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              ← Quay lại {TABS.find((t) => t.id === tab)?.label}
            </button>
            <DocsTab profiles={STORE_PROFILES} />
          </div>
        ) : (
          <>
            <div className="no-print">
              {tab === "einstellungen" && <SettingsTab key={view.storeId} store={view} />}
              {tab === "mitarbeiter" && <EmployeesTab key={view.storeId} store={view} allStores={stores} />}
            </div>
            {/*
              „Bảng chấm công" enthält den Druckbereich und darf deshalb NICHT im
              no-print-Container liegen. Der Dienstplan bringt sein eigenes no-print mit.
            */}
            {tab === "dienstplan" && <ScheduleTab key={view.storeId} store={view} />}
            {tab === "stundenzettel" && <StundenzettelTab key={view.storeId} store={view} />}
          </>
        )}
      </main>
    </div>
  );
}
