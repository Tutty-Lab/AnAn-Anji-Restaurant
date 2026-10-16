import type { Employee, Shift, WorkRole } from "../types";
import type { WeekdayKey } from "./demand";
import type { DayBlocks, DayWindow } from "./workHours";

// ── Nhóm nhân viên ──────────────────────────────────────────────────────────
/**
 * Bereich, nach dem die Besetzung gezählt wird. Wer noch keinem Bereich
 * zugeordnet ist (Admin trägt es später ein), zählt wie Service – so bleibt die
 * Mindestbesetzung „Phục vụ" prüfbar, bis die Zuordnung steht.
 */
export type StaffGroup = "KITCHEN" | "SERVICE" | "DRIVER";
export const STAFF_GROUPS: readonly StaffGroup[] = ["KITCHEN", "SERVICE", "DRIVER"];
/** Personen im Laden (Bếp + Phục vụ). Fahrer sind unterwegs und zählen nicht mit. */
export const IN_HOUSE: readonly StaffGroup[] = ["KITCHEN", "SERVICE"];

export function staffGroupOf(employee: Employee | undefined): StaffGroup {
  if (employee?.workRole === "KITCHEN") return "KITCHEN";
  if (employee?.workRole === "DRIVER") return "DRIVER";
  return "SERVICE";
}

/**
 * Kernzeit der Fahrer (Vorgabe des Betriebs): 18–21 Uhr, sonntags 18–22 Uhr,
 * Feiertage wie Sonntag. In dieser Zeit gilt die Fahrerbesetzung (T2–T7 1, CN 2).
 * Fahrer fahren „chủ yếu tối", dürfen aber in allen Öffnungszeiten arbeiten –
 * mittags „thi thoảng 2–3 người", und Vollzeitfahrer (173,81 h) passen gar
 * nicht in 3 h je Abend.
 */
export const DRIVER_HOURS: { default: DayWindow; sunday: DayWindow } = {
  default: { startMinutes: 18 * 60, endMinutes: 21 * 60 },
  sunday: { startMinutes: 18 * 60, endMinutes: 22 * 60 },
};

export function driverWindowOf(weekday: WeekdayKey): DayWindow {
  return weekday === "sunday" ? DRIVER_HOURS.sunday : DRIVER_HOURS.default;
}

/**
 * Küchenvorbereitung: die Arbeitszeit beginnt so viele Minuten vor der Öffnung
 * (workHours.ts). In dieser Zeit arbeitet nur die Küche – genau 1 Person.
 */
export const PREP_MINUTES = 30;

/** Öffnungsblöcke für Gäste: der erste Block ohne die Vorbereitungszeit der Küche. */
export function guestBlocks(blocks: DayBlocks): DayBlocks {
  return blocks
    .map((block, index) => (index === 0 ? { startMinutes: block.startMinutes + PREP_MINUTES, endMinutes: block.endMinutes } : block))
    .filter((block) => block.endMinutes > block.startMinutes);
}

/** Die Vorbereitungszeit des Tages (erste halbe Stunde des ersten Blocks). */
const prepWindow = (blocks: DayBlocks): DayWindow[] =>
  blocks.length === 0 ? [] : [{ startMinutes: blocks[0].startMinutes, endMinutes: Math.min(blocks[0].endMinutes, blocks[0].startMinutes + PREP_MINUTES) }];

/**
 * Blöcke, in denen diese Person arbeiten darf: Küche ab Vorbereitung, Service
 * und Fahrer erst ab Öffnung (Fahrer bevorzugt in der Kernzeit, siehe
 * weeklyScheduler.ts driverShortCost).
 */
export function workBlocksFor(employee: Employee | undefined, blocks: DayBlocks, _weekday: WeekdayKey): DayBlocks {
  return staffGroupOf(employee) === "KITCHEN" ? blocks : guestBlocks(blocks);
}

/** Welche Bereiche es in dieser Belegschaft überhaupt gibt. */
export function presentGroups(employees: readonly Employee[]): Set<StaffGroup> {
  return new Set(employees.map(staffGroupOf));
}

export type StaffingWindow = {
  label: string;
  startMinutes: number;
  endMinutes: number;
  minStaff: number;
  maxStaff: number;
  /** Nur Personen dieser Bereiche zählen für das Fenster. */
  groups: readonly StaffGroup[];
  /** Harte Regel des Betriebs (muss immer erfüllt sein) – sonst weiche Vorgabe. */
  hard: boolean;
  /** Gewicht einer weichen Regel (Standard 1) – „mindestens 2" geht vor höheren Zahlen. */
  weight?: number;
};

/** Ab hier keine Pause mehr, wenn es sich vermeiden lässt (Abschluss des Abends). */
export const CLOSING_START = 21 * 60 + 30;

/** „Sáng" (Mittag) endet um 14:30 – Mo–Fr schließt der Mittagsblock dann. */
export const LUNCH_END = 14 * 60 + 30;
/** „Chiều/Tối" (Abend) beginnt um 17:00 – Mo–Fr öffnet dann der Abendblock. */
export const EVENING_START = 17 * 60;

/**
 * Stoßzeiten (Vorgabe des Betriebs): mittags 12–14 Uhr, abends 18–22 Uhr. Nur
 * dann gelten die weichen Besetzungszahlen. Beim Öffnen (11–12, 17–18) und kurz
 * vor 14:30 reicht die harte Regel: 1 Bếp + 1 Phục vụ/Bồi.
 */
export const LUNCH_PEAK = { startMinutes: 12 * 60, endMinutes: 14 * 60 };
export const EVENING_PEAK = { startMinutes: 18 * 60, endMinutes: 22 * 60 };
/** Schluss am Abend (22:00–22:30): etwas mehr als 1 + 1 – 2 Phục vụ/Bồi, 1 Bếp. */
export const CLOSING_WINDOW = { startMinutes: 22 * 60, endMinutes: 22 * 60 + 30 };

/**
 * Eine Besetzungsregel: WO (Zeitspanne je Öffnungsblock), WER (Bereiche) und WIE VIELE.
 *
 * minStaff/maxStaff sind der Wert eines Normaltags (Gewicht 1,0). Bei
 * scaled = true werden sie mit dem Tagesgewicht (DAY_WEIGHTS) multipliziert und
 * aufgerundet.
 *
 * hard = true: Regel des Betriebs, die immer gelten muss (Scheduler gewichtet sie
 * zehnfach). Sonst weiche Vorgabe: so nah wie möglich, Lücken sind erlaubt, wenn
 * die Stunden der Belegschaft nicht reichen.
 *
 * Einzige Quelle für Scheduler, Độ phủ-Bericht und Tab „Tài liệu": wer die
 * Besetzung ändert, ändert nur diese Liste.
 */
export type StaffingRule = {
  label: string;
  /** Kurzbeschreibung der Zeitspanne für den Tab „Tài liệu". */
  when: string;
  minStaff: number;
  maxStaff: number;
  scaled: boolean;
  hard: boolean;
  /** Gewicht der weichen Regel im Planer (Standard 1). */
  weight?: number;
  groups: readonly StaffGroup[];
  /** Nur an diesen (effektiven) Wochentagen; fehlt = an jedem offenen Tag. */
  weekdays?: readonly WeekdayKey[];
  windows: (blocks: DayBlocks) => DayWindow[];
};

/** Schneidet eine feste Uhrzeitspanne mit jedem Gäste-Öffnungsblock (ohne Küchenvorbereitung). */
const clip = (from: number, to: number) => (blocks: DayBlocks): DayWindow[] =>
  guestBlocks(blocks)
    .map((block) => ({ startMinutes: Math.max(from, block.startMinutes), endMinutes: Math.min(to, block.endMinutes) }))
    .filter((window) => window.endMinutes > window.startMinutes);

const wholeBlocks = (blocks: DayBlocks): DayWindow[] =>
  blocks.map((block) => ({ startMinutes: block.startMinutes, endMinutes: block.endMinutes }));

const MON_THU: readonly WeekdayKey[] = ["monday", "tuesday", "wednesday", "thursday"];
const FRI_SUN: readonly WeekdayKey[] = ["friday", "saturday", "sunday"];
const MON_SAT: readonly WeekdayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const lunch = clip(LUNCH_PEAK.startMinutes, LUNCH_PEAK.endMinutes);

// Restaurant AnAn (Vorgabe des Betriebs), Aufbau wie Anji.
// Hart: von Öffnung bis Schluss immer mindestens 1 Phục vụ (Service) und 1 Bếp
// (Küche) – die Küche ab der Vorbereitung, der Service ab Öffnung.
// Weich: Phục vụ T2–T5 trưa 12–14 2–3, 18–20 3–4, 20–21 2, 21–Schluss 1; T6–CN
// trưa 2, 18–21 3, 21–Schluss 2. Bếp 10:30 1 người, sáng 2, tối T6–CN 3 (18–21).
// Lái xe: trong tuần 1 người mỗi tối, CN (và lễ) luôn 2.
const ANAN_RULES: readonly StaffingRule[] = [
  { label: "Bếp luôn có người", when: "suốt giờ làm (gồm 30′ chuẩn bị)", minStaff: 1, maxStaff: Infinity, scaled: false, hard: true, groups: ["KITCHEN"], windows: wholeBlocks },
  { label: "Phục vụ luôn có người", when: "suốt giờ mở cửa (gồm người chưa gán nhóm)", minStaff: 1, maxStaff: Infinity, scaled: false, hard: true, groups: ["SERVICE"], windows: (blocks) => guestBlocks(blocks) },
  // Ưu tiên (chủ quán): giờ đông ít nhất 2 phục vụ mọi ngày – trước người thứ 3, thứ 4.
  { label: "Phục vụ ít nhất 2 (12–14)", when: "12:00 – 14:00, mọi ngày (ưu tiên)", minStaff: 2, maxStaff: Infinity, scaled: false, hard: false, weight: 15, groups: ["SERVICE"], windows: lunch },
  { label: "Phục vụ ít nhất 2 (18–21)", when: "18:00 – 21:00, mọi ngày (ưu tiên)", minStaff: 2, maxStaff: Infinity, scaled: false, hard: false, weight: 15, groups: ["SERVICE"], windows: clip(18 * 60, 21 * 60) },
  { label: "Bếp chuẩn bị", when: "30′ trước giờ mở (T2–T7 10:30, CN/lễ 11:30)", minStaff: 1, maxStaff: 1, scaled: false, hard: false, groups: ["KITCHEN"], windows: prepWindow },
  // Như Anji (chủ quán): Phục vụ T2–T5 trưa 12–14 2–3, tối 18–20 3–4, 20–21 2, 21–đóng cửa 1.
  { label: "Phục vụ trưa T2–T5", when: "12:00 – 14:00 (2–3 người)", minStaff: 2, maxStaff: 3, scaled: false, hard: false, groups: ["SERVICE"], weekdays: MON_THU, windows: lunch },
  { label: "Phục vụ tối T2–T5", when: "18:00 – 20:00 (3–4 người)", minStaff: 3, maxStaff: 4, scaled: false, hard: false, groups: ["SERVICE"], weekdays: MON_THU, windows: clip(18 * 60, 20 * 60) },
  { label: "Phục vụ 20–21 T2–T5", when: "20:00 – 21:00 (2 người)", minStaff: 2, maxStaff: 2, scaled: false, hard: false, groups: ["SERVICE"], weekdays: MON_THU, windows: clip(20 * 60, 21 * 60) },
  { label: "Phục vụ cuối T2–T5", when: "21:00 – đóng cửa (1 người)", minStaff: 1, maxStaff: 1, scaled: false, hard: false, groups: ["SERVICE"], weekdays: MON_THU, windows: clip(21 * 60, 24 * 60) },
  // T6, T7, CN đông nhất: trưa ≥ 2, tối 18–21 ≥ 3, 21–đóng cửa ≥ 2.
  { label: "Phục vụ sáng T6–CN", when: "12:00 – 14:00 (giờ đông)", minStaff: 2, maxStaff: Infinity, scaled: false, hard: false, groups: ["SERVICE"], weekdays: FRI_SUN, windows: lunch },
  { label: "Phục vụ chiều T6–CN", when: "18:00 – 21:00 (giờ đông)", minStaff: 3, maxStaff: Infinity, scaled: false, hard: false, groups: ["SERVICE"], weekdays: FRI_SUN, windows: clip(18 * 60, 21 * 60) },
  { label: "Bếp sáng", when: "12:00 – 14:00 (giờ đông)", minStaff: 2, maxStaff: Infinity, scaled: false, hard: false, groups: ["KITCHEN"], windows: lunch },
  { label: "Bếp tối T6–CN", when: "18:00 – 21:00 (đông thì 4)", minStaff: 3, maxStaff: Infinity, scaled: false, hard: false, groups: ["KITCHEN"], weekdays: FRI_SUN, windows: clip(18 * 60, 21 * 60) },
  { label: "Phục vụ cuối T6–CN", when: "21:00 – đóng cửa (2 người)", minStaff: 2, maxStaff: Infinity, scaled: false, hard: false, groups: ["SERVICE"], weekdays: FRI_SUN, windows: clip(21 * 60, 24 * 60) },
  {
    label: "Lái xe", when: "18:00–21:00 (T2–T7)", minStaff: 1, maxStaff: 2, scaled: false, hard: false, groups: ["DRIVER"],
    weekdays: MON_SAT, windows: clip(DRIVER_HOURS.default.startMinutes, DRIVER_HOURS.default.endMinutes),
  },
  {
    label: "Lái xe CN", when: "18:00–22:00 (CN, ngày lễ)", minStaff: 2, maxStaff: 2, scaled: false, hard: false, groups: ["DRIVER"],
    weekdays: ["sunday"], windows: clip(DRIVER_HOURS.sunday.startMinutes, DRIVER_HOURS.sunday.endMinutes),
  },
];

// Restaurant Anji (Vorgabe des Betriebs).
// Hart: immer mindestens 1 Bồi (Service) und 1 Bếp (Küche) – die Küche ab der
// Vorbereitung, der Service ab Öffnung.
// Weich: Bồi T2–T4 sáng 3 / chiều 3, T5–CN sáng 3 / chiều 4; Bếp 10:30 1 người,
// sáng 3 (T2–CN), tối 4 (T6–CN); Bồi tối T2–T5 3, T6–CN 4. Zeiten wie AnAn: sáng 12–14, tối 18–22, Öffnen
// nur 1 + 1, Schluss 22:00–22:30 2 Bồi + 1 Bếp. Keine Fahrer.
const ANJI_RULES: readonly StaffingRule[] = [
  { label: "Bếp luôn có người", when: "suốt giờ làm (gồm 30′ chuẩn bị)", minStaff: 1, maxStaff: Infinity, scaled: false, hard: true, groups: ["KITCHEN"], windows: wholeBlocks },
  { label: "Bồi luôn có người", when: "suốt giờ mở cửa (gồm người chưa gán nhóm)", minStaff: 1, maxStaff: Infinity, scaled: false, hard: true, groups: ["SERVICE"], windows: (blocks) => guestBlocks(blocks) },
  // Ưu tiên (chủ quán): giờ đông ít nhất 2 bồi mọi ngày – trước người thứ 3, thứ 4.
  { label: "Bồi ít nhất 2 (12–14)", when: "12:00 – 14:00, mọi ngày (ưu tiên)", minStaff: 2, maxStaff: Infinity, scaled: false, hard: false, weight: 15, groups: ["SERVICE"], windows: lunch },
  { label: "Bồi ít nhất 2 (18–21)", when: "18:00 – 21:00, mọi ngày (ưu tiên)", minStaff: 2, maxStaff: Infinity, scaled: false, hard: false, weight: 15, groups: ["SERVICE"], windows: clip(18 * 60, 21 * 60) },
  { label: "Bếp chuẩn bị", when: "30′ trước giờ mở (T2–T7 10:30, CN/lễ 11:30)", minStaff: 1, maxStaff: 1, scaled: false, hard: false, groups: ["KITCHEN"], windows: prepWindow },
  // Bồi T2–T5 (chủ quán): trưa 12–14 2–3, tối 18–20 3–4, 20–21 2, 21–đóng cửa 1.
  { label: "Bồi trưa T2–T5", when: "12:00 – 14:00 (2–3 người)", minStaff: 2, maxStaff: 3, scaled: false, hard: false, groups: ["SERVICE"], weekdays: MON_THU, windows: lunch },
  { label: "Bồi tối T2–T5", when: "18:00 – 20:00 (3–4 người)", minStaff: 3, maxStaff: 4, scaled: false, hard: false, groups: ["SERVICE"], weekdays: MON_THU, windows: clip(18 * 60, 20 * 60) },
  { label: "Bồi 20–21 T2–T5", when: "20:00 – 21:00 (2 người)", minStaff: 2, maxStaff: 2, scaled: false, hard: false, groups: ["SERVICE"], weekdays: MON_THU, windows: clip(20 * 60, 21 * 60) },
  { label: "Bồi cuối T2–T5", when: "21:00 – đóng cửa (1 người)", minStaff: 1, maxStaff: 1, scaled: false, hard: false, groups: ["SERVICE"], weekdays: MON_THU, windows: clip(21 * 60, 24 * 60) },
  // T6, T7, CN đông nhất: trưa ≥ 3, tối 18–21 ≥ 4, 21–đóng cửa ≥ 2.
  { label: "Bồi sáng T6–CN", when: "12:00 – 14:00 (giờ đông)", minStaff: 3, maxStaff: Infinity, scaled: false, hard: false, groups: ["SERVICE"], weekdays: FRI_SUN, windows: lunch },
  { label: "Bồi chiều T6–CN", when: "18:00 – 21:00 (giờ đông)", minStaff: 4, maxStaff: Infinity, scaled: false, hard: false, groups: ["SERVICE"], weekdays: FRI_SUN, windows: clip(18 * 60, 21 * 60) },
  { label: "Bếp sáng", when: "12:00 – 14:00 (giờ đông)", minStaff: 3, maxStaff: Infinity, scaled: false, hard: false, groups: ["KITCHEN"], windows: lunch },
  { label: "Bếp tối T6–CN", when: "18:00 – 21:00 (giờ đông)", minStaff: 4, maxStaff: Infinity, scaled: false, hard: false, groups: ["KITCHEN"], weekdays: FRI_SUN, windows: clip(18 * 60, 21 * 60) },
  { label: "Bồi cuối T6–CN", when: "21:00 – đóng cửa (2 người)", minStaff: 2, maxStaff: Infinity, scaled: false, hard: false, groups: ["SERVICE"], weekdays: FRI_SUN, windows: clip(21 * 60, 24 * 60) },
];

/** Mindest-/Höchstzahl einer Regel an einem Wochentag (Gewicht angewandt, aufgerundet). */
export function ruleRange(rule: StaffingRule, weekday: WeekdayKey, profile: StoreProfile = ANAN_PROFILE): { minStaff: number; maxStaff: number } {
  const weight = rule.scaled ? profile.dayWeights[weekday] : 1;
  return {
    minStaff: Math.ceil(rule.minStaff * weight),
    maxStaff: Number.isFinite(rule.maxStaff) ? Math.ceil(rule.maxStaff * weight) : Infinity,
  };
}

export function ruleAppliesOn(rule: StaffingRule, weekday: WeekdayKey): boolean {
  return !rule.weekdays || rule.weekdays.includes(weekday);
}

/**
 * Besetzungsfenster eines Tages. present = vorhandene Bereiche: eine WEICHE Regel
 * für einen Bereich ohne Personen wird übersprungen, statt jeden Tag als
 * unerfüllbar rot zu melden. Harte Regeln (immer 1 Bếp, 1 Phục vụ/Bồi) gelten
 * immer – fehlt der Bereich, ist das eine echte Lücke.
 */
export function staffingWindows(
  blocks: DayBlocks,
  weekday: WeekdayKey,
  present?: ReadonlySet<StaffGroup>,
  profile: StoreProfile = ANAN_PROFILE,
): StaffingWindow[] {
  return profile.staffingRules
    .filter((rule) => ruleAppliesOn(rule, weekday) && (rule.hard || !present || rule.groups.some((group) => present.has(group))))
    .flatMap((rule) => {
      const range = ruleRange(rule, weekday, profile);
      return rule.windows(blocks).map((window) => ({ label: rule.label, groups: rule.groups, hard: rule.hard, weight: rule.weight, ...window, ...range }));
    });
}

// ── Đường nhu cầu trong ngày ────────────────────────────────────────────────
/**
 * Nhu cầu tương đối theo giờ (1,0 = bình thường) – dạng „ngọn núi": chuẩn bị,
 * lên dốc, đỉnh, xuống dốc. Thuật toán chia GIỜ CÔNG TRONG QUÁN CỦA NGÀY (đã nhân
 * hệ số ngày) theo đường này thành số người mục tiêu cho từng 30 phút, rồi phạt
 * độ lệch theo bình phương – nhờ vậy số người lên xuống mượt, không dồn cục.
 *
 * Mức trưa/chiều theo từng quán (StoreProfile.demand). 30′ chuẩn bị chỉ 1 người bếp.
 */
export type DemandBand = { startMinutes: number; endMinutes: number; level: number; label: string };

const band = (from: string, to: string, level: number, label: string): DemandBand => {
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  return { startMinutes: toMinutes(from), endMinutes: toMinutes(to), level, label };
};

/** Höchster Wert der Kurve – Maßstab für „liegt in der Stoßzeit". */
export const PEAK_LEVEL = 1.5;

export type DemandProfile = { default: readonly DemandBand[]; sunday: readonly DemandBand[] };

/**
 * Đường nhu cầu: đông trưa 12:00–14:00 (= lunch) và tối 18:00–22:00. Lúc mở cửa
 * (11:00–12:00, 17:00–18:00), 14:00–14:30 và chiều 14:30–17:00 (T7, CN mở liền)
 * chỉ 1 bếp + 1 phục vụ (= quiet). Đóng cửa 22:00–22:30 hơn chút (= closing).
 */
function demandProfile(lunch: number, quiet: number, closing: number, quietLabel: string): DemandProfile {
  const AFTERNOON = [band("14:00", "14:30", quiet, "Cuối trưa"), band("14:30", "17:00", quiet, quietLabel)];
  const EVENING = [
    band("17:00", "18:00", quiet, "Mở ca tối"),
    band("18:00", "18:30", 1.4, "Vào cao điểm"),
    band("18:30", "20:30", 1.5, "Cao điểm tối"),
    band("20:30", "21:30", 1.4, "Sau cao điểm"),
    band("21:30", "22:00", 1.25, "Cuối cao điểm"),
    band("22:00", "22:30", closing, "Đóng cửa"),
  ];
  return {
    // T2–T7. 14:30–17:00 chỉ dùng ở T7 (mở liền); T2–T6 đóng giờ đó.
    default: [band("10:30", "11:00", 0.2, "Bếp chuẩn bị"), band("11:00", "12:00", quiet, "Mở cửa"), band("12:00", "14:00", lunch, "Trưa"), ...AFTERNOON, ...EVENING],
    // CN và ngày lễ mở từ 12:00 (vào thẳng giờ đông), bếp chuẩn bị từ 11:30.
    sunday: [band("11:30", "12:00", 0.2, "Bếp chuẩn bị"), band("12:00", "14:00", lunch, "Trưa"), ...AFTERNOON, ...EVENING],
  };
}

// ── Hồ sơ quán ──────────────────────────────────────────────────────────────
/**
 * Alles, was AnAn und Anji unterscheidet, an EINER Stelle: Besetzungsregeln,
 * Tagesgewichte, Nachfragekurve, Bezeichnungen und wählbare Bereiche.
 * Öffnungszeiten, Gesetz und Planer sind für beide gleich. Die Funktionen hier
 * und in weeklyScheduler/analyze/contract bekommen das Profil als Parameter
 * (Standard: AnAn – so laufen ältere Aufrufe und Tests unverändert).
 */
export type StoreProfile = {
  /** Schlüssel der Zeile in store_data und im LocalStorage – NICHT ändern. */
  id: string;
  name: string;
  shortName: string;
  address: string;
  dayWeights: Record<WeekdayKey, number>;
  staffingRules: readonly StaffingRule[];
  demand: DemandProfile;
  groupLabels: Record<StaffGroup, string>;
  /** Im Tab Nhân viên wählbare Bereiche. */
  workRoles: readonly WorkRole[];
};

export const ANAN_PROFILE: StoreProfile = {
  id: "anan",
  name: "Restaurant AnAn",
  shortName: "AnAn",
  address: "Elvirastr. 12, 80636 München",
  // Am stärksten Do–So, vor allem abends: Service abends Do–So 3 statt 2,
  // Küche abends Do–Sa 3. Fr/Sa 1,5, Do/So 1,3, Mo–Mi 1,0.
  // Như Anji (chủ quán): đông nhất T6, T7, CN; T2–T5 bình thường.
  dayWeights: { monday: 1.0, tuesday: 1.0, wednesday: 1.0, thursday: 1.0, friday: 1.5, saturday: 1.5, sunday: 1.5 },
  staffingRules: ANAN_RULES,
  // Trưa 2 phục vụ + 2 bếp, mở cửa và chiều 1 + 1, tối 3–6 người, đóng cửa 2 + 1.
  demand: demandProfile(1.0, 0.45, 0.7, "Chiều vắng (chỉ 1 phục vụ + 1 bếp)"),
  groupLabels: { KITCHEN: "Bếp", SERVICE: "Phục vụ", DRIVER: "Lái xe" },
  workRoles: ["KITCHEN", "SERVICE", "DRIVER"],
};

export const ANJI_PROFILE: StoreProfile = {
  id: "anji",
  name: "Restaurant Anji",
  shortName: "Anji",
  // Anschrift laut Lohnabrechnung (Anji GmbH).
  address: "Donnersbergerstr. 30, 80634 München",
  // Chủ quán: Anji đông nhất T6, T7 và CN; T2–T5 bình thường.
  dayWeights: { monday: 1.0, tuesday: 1.0, wednesday: 1.0, thursday: 1.0, friday: 1.5, saturday: 1.5, sunday: 1.5 },
  staffingRules: ANJI_RULES,
  // Trưa 3 bồi + 3 bếp, mở cửa và chiều 1 + 1, tối 6–8 người, đóng cửa 2 + 1.
  demand: demandProfile(1.1, 0.35, 0.55, "Chiều vắng (chỉ 1 bồi + 1 bếp)"),
  groupLabels: { KITCHEN: "Bếp", SERVICE: "Bồi", DRIVER: "Lái xe" },
  workRoles: ["KITCHEN", "SERVICE"],
};

/** Alle Läden dieser App, in der Reihenfolge, in der „Tạo lịch" sie plant. */
export const STORE_PROFILES: readonly StoreProfile[] = [ANAN_PROFILE, ANJI_PROFILE];

export function profileById(id: string): StoreProfile {
  return STORE_PROFILES.find((profile) => profile.id === id) ?? ANAN_PROFILE;
}

/** Bezeichnung eines Bereichs im Laden (Service heißt bei Anji „Bồi"). */
export function groupLabel(group: StaffGroup, profile: StoreProfile = ANAN_PROFILE): string {
  return profile.groupLabels[group];
}

export function demandProfileOf(weekday: WeekdayKey, profile: StoreProfile = ANAN_PROFILE): readonly DemandBand[] {
  return weekday === "sunday" ? profile.demand.sunday : profile.demand.default;
}

/** Relative workload at a minute (1 outside all bands). */
export function workloadAt(minute: number, weekday: WeekdayKey, profile: StoreProfile = ANAN_PROFILE): number {
  return demandProfileOf(weekday, profile).find((b) => minute >= b.startMinutes && minute < b.endMinutes)?.level ?? 1;
}

/**
 * Số người mục tiêu cho từng 30 phút mở cửa:
 *   mục tiêu = giờ công của ngày × mức nhu cầu ÷ tổng mức cả ngày (tính theo phút).
 * Trả về [phút bắt đầu, số người mục tiêu].
 */
export function slotTargets(
  blocks: DayBlocks,
  weekday: WeekdayKey,
  targetHours: number,
  slot = 30,
  profile: StoreProfile = ANAN_PROFILE,
): [number, number][] {
  const slots: [number, number][] = [];
  for (const block of blocks) {
    for (let minute = block.startMinutes; minute < block.endMinutes; minute += slot) {
      slots.push([minute, workloadAt(minute, weekday, profile)]);
    }
  }
  const levelMinutes = slots.reduce((sum, [, level]) => sum + level * slot, 0);
  const scale = levelMinutes > 0 ? (targetHours * 60) / levelMinutes : 0;
  return slots.map(([minute, level]) => [minute, level * scale]);
}

export function validPause(shift: Shift): boolean {
  const start = shift.pauseStartMinutes;
  return start != null && shift.pauseMinutes > 0 && start > shift.startMinutes &&
    start + shift.pauseMinutes < shift.endMinutes && start - shift.startMinutes <= 360 &&
    shift.endMinutes - start - shift.pauseMinutes <= 360;
}

export function workingAt(shift: Shift, minute: number): boolean {
  return shift.startMinutes <= minute && shift.endMinutes > minute &&
    !(validPause(shift) && minute >= shift.pauseStartMinutes! && minute < shift.pauseStartMinutes! + shift.pauseMinutes);
}

export function coveragePoints(shifts: Shift[], from: number, to: number): number[] {
  return [...new Set([from, to, ...shifts.flatMap((s) => [s.startMinutes, s.endMinutes,
    ...(validPause(s) ? [s.pauseStartMinutes!, s.pauseStartMinutes! + s.pauseMinutes] : []),
  ]).filter((t) => t > from && t < to)])].sort((a, b) => a - b);
}

/** Kleinste und größte Zahl gleichzeitig arbeitender Personen in [from, to). */
export function staffRange(shifts: Shift[], from: number, to: number): { min: number; max: number } {
  const points = coveragePoints(shifts, from, to).slice(0, -1);
  const counts = points.map((minute) => new Set(shifts.filter((shift) => workingAt(shift, minute)).map((shift) => shift.employeeId)).size);
  return { min: counts.length ? Math.min(...counts) : 0, max: counts.length ? Math.max(...counts) : 0 };
}

/**
 * Giờ công mục tiêu mỗi ngày, chuẩn hoá trong từng ISO-week (không mượn giữa các tuần):
 *   giờ ngày = giờ tuần × (hệ số × phút mở) ÷ Σ(hệ số × phút mở)
 * Nhân phút mở để hệ số là MẬT ĐỘ người: T7 mở 11,5h không thưa hơn T6 mở 9h.
 * Không truyền openMinutesOf => chỉ theo hệ số.
 */
export function weightedDailyTargets(
  dates: string[],
  total: number,
  weekdayOf: (date: string) => WeekdayKey,
  openMinutesOf?: (date: string) => number,
  weights: Record<WeekdayKey, number> = ANAN_PROFILE.dayWeights,
): Map<string, number> {
  const factor = (date: string) => weights[weekdayOf(date)] * (openMinutesOf ? openMinutesOf(date) : 1);
  const sum = dates.reduce((acc, date) => acc + factor(date), 0);
  return new Map(dates.map((date) => [date, sum > 0 ? total * factor(date) / sum : 0]));
}
