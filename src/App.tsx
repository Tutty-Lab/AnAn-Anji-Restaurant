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
// Reihenfolge und Bezeichnungen wie demo-studenzettell: Chấm công · Lịch · Nhân viên.
const TABS: { id: TabId; label: string }[] = [
  { id: "stundenzettel", label: "Chấm công" },
  { id: "dienstplan", label: "Lịch" },
  { id: "mitarbeiter", label: "Nhân viên" },
  { id: "einstellungen", label: "Cài đặt" },
];
const MAIN_TABS: TabId[] = ["stundenzettel", "dienstplan", "mitarbeiter"];

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

  const [tab, setTab] = useState<TabId>("stundenzettel");
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /**
   * Tải lại: als App vom Home-Bildschirm (iPhone/Safari) gibt es keine
   * Browserleiste zum Neuladen. Erst nach einer neuen Version fragen (Service
   * Worker), dann neu laden – so kommen Code UND Daten frisch.
   */
  const refreshApp = async () => {
    setRefreshing(true);
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      // Höchstens 3 s auf die Update-Prüfung warten (schlechtes Netz).
      await Promise.race([reg?.update(), new Promise((resolve) => setTimeout(resolve, 3000))]);
    } catch {
      // egal – trotzdem neu laden
    }
    window.location.reload();
  };
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
        <div className="mx-auto max-w-[1500px] px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base sm:text-lg font-semibold" title={`bản ${__BUILD__}`}>
              AnAn &amp; Anji
            </h1>
            {/* Nur ein SYNC-FEHLER wird gezeigt: dann liegen Daten nur auf diesem Gerät. */}
            {stores.some((s) => s.remoteStatus === "error") && (
              <p className="text-xs text-rose-300">Lỗi đồng bộ — dữ liệu chỉ lưu trên máy này</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Aus dem Menü geöffnete Seite: steht direkt neben dem Menü, mit ✕ zurück. */}
            {(docsOpen || !MAIN_TABS.includes(tab)) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white py-1.5 pl-3 pr-1 text-sm font-medium text-slate-900">
                {docsOpen ? "Tài liệu" : TABS.find((t) => t.id === tab)?.label}
                <button
                  type="button"
                  onClick={() => openTab("stundenzettel")}
                  aria-label="Đóng"
                  className="rounded px-1.5 text-slate-400 hover:text-slate-900"
                >
                  ✕
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => void refreshApp()}
              disabled={refreshing}
              aria-label="Tải lại"
              title="Tải lại"
              className="flex h-9 w-9 items-center justify-center rounded bg-slate-700 text-lg leading-none hover:bg-slate-600 disabled:opacity-60"
            >
              <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>↻</span>
            </button>
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
        <Dashboard stores={stores} view={view} onChooseStore={chooseStore} />
      </div>

      <nav className="no-print mx-auto max-w-[1500px] px-3 sm:px-4 mt-4">
        <div className="flex items-center gap-2">
          {/* Eine Zeile wie demo-studenzettell: Chấm công · Lịch · Nhân viên als Segment, rechts Tạo lịch. */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
            {TABS.filter((t) => MAIN_TABS.includes(t.id)).map((t) => {
              const active = !docsOpen && tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => openTab(t.id)}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm font-medium ${
                    active ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {/* Tháng chọn trong popup „Tạo lịch" (wie demo-studenzettell) – hier nur der Knopf. */}
          <div className="ml-auto">
            {/* „Tạo lịch" – wichtigste Aktion, rechts in der Tab-Zeile. */}
            <button
              type="button"
              onClick={() => setGenDialogOpen(true)}
              disabled={stores.every((s) => s.schedule.employees.length === 0)}
              className="whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40"
            >
              Tạo lịch
            </button>
          </div>
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
            if (tab !== "dienstplan") openTab("stundenzettel");
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

      {/* Tab Lịch: volle Breite – mehr Platz für Tage und Debug-Zeilen. */}
      <main className={`mx-auto px-3 sm:px-4 py-4 ${tab === "dienstplan" && !docsOpen ? "max-w-none" : "max-w-[1500px]"}`}>
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
