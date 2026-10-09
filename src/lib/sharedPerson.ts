// ============================================================================
// Ein Mensch, zwei Läden (AnAn und Anji): Mitarbeiter mit demselben personKey
// sind dieselbe Person. „Tạo lịch" plant sie dann nie am selben Tag in beiden
// Läden (App.tsx, generateAll). Hier steht, wie das Feld „Cũng làm ở quán khác"
// im Tab Nhân viên die Schlüssel setzt und löst, und welche Tage nach einer
// Hand-Änderung doch doppelt belegt sind. (Übernommen aus Shin-Coco-Nieu.)
// ============================================================================

import type { Employee, Schedule } from "../types";
import { maxConsecutiveRun } from "./consecutive";
import { weekStartOf } from "./weeks";

export type StoreRoster = { storeId: string; employees: readonly Employee[] };

/** Gewählter Partner je anderer Filiale: storeId -> employeeId ("" = keiner). */
export type PartnerChoice = Record<string, string>;

/**
 * "" heißt „bewusst gelöst": so verbindet withSharedPersonDefaults (stores.ts)
 * einen alten Stand beim nächsten Laden nicht wieder.
 */
export type PersonKeyPatch = { storeId: string; employeeId: string; personKey: string };

/** Die Mitarbeiter ANDERER Filialen, die schon dieselbe Person sind. */
export function currentPartners(rosters: readonly StoreRoster[], storeId: string, employee?: Employee): PartnerChoice {
  const choice: PartnerChoice = {};
  if (!employee?.personKey) return choice;
  for (const roster of rosters) {
    if (roster.storeId === storeId) continue;
    const partner = roster.employees.find((e) => e.personKey === employee.personKey);
    if (partner) choice[roster.storeId] = partner.id;
  }
  return choice;
}

/** Lesbarer, noch nicht vergebener Schlüssel aus dem Namen („ba-viet-nguyen"). */
function freshKey(name: string, rosters: readonly StoreRoster[]): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "person";
  const taken = new Set(rosters.flatMap((r) => r.employees.map((e) => e.personKey)).filter(Boolean));
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
  return key;
}

/**
 * Welche personKeys sich ändern, wenn `self` mit genau den gewählten Partnern
 * verbunden sein soll. Wer bisher dazugehörte und nicht mehr gewählt ist, wird
 * gelöst. `self` darf neu sein (steht dann noch in keinem Roster).
 */
export function linkPatches(
  rosters: readonly StoreRoster[],
  self: { storeId: string; employeeId: string; name: string; personKey?: string },
  choice: PartnerChoice,
): PersonKeyPatch[] {
  const chosen = Object.entries(choice)
    .filter(([storeId, employeeId]) => storeId !== self.storeId && employeeId)
    .map(([storeId, employeeId]) => ({
      storeId,
      employee: rosters.find((r) => r.storeId === storeId)?.employees.find((e) => e.id === employeeId),
    }))
    .filter((c): c is { storeId: string; employee: Employee } => c.employee !== undefined);

  const key =
    chosen.length === 0
      ? ""
      : self.personKey || chosen.find((c) => c.employee.personKey)?.employee.personKey || freshKey(self.name, rosters);

  const patches: PersonKeyPatch[] = [];
  if ((self.personKey ?? "") !== key) patches.push({ storeId: self.storeId, employeeId: self.employeeId, personKey: key });
  for (const c of chosen) {
    if (c.employee.personKey !== key) patches.push({ storeId: c.storeId, employeeId: c.employee.id, personKey: key });
  }
  // Bisherige Partner, die nicht mehr gewählt sind, lösen.
  if (self.personKey) {
    for (const roster of rosters) {
      if (roster.storeId === self.storeId) continue;
      for (const e of roster.employees) {
        if (e.personKey !== self.personKey) continue;
        if (chosen.some((c) => c.storeId === roster.storeId && c.employee.id === e.id)) continue;
        patches.push({ storeId: roster.storeId, employeeId: e.id, personKey: "" });
      }
    }
  }
  return patches;
}

export type CrossStoreConflict = { personKey: string; name: string; date: string; stores: string[] };

/**
 * Tage, an denen dieselbe Person (personKey) in mehr als einem Laden einen Dienst
 * hat. Der Planer erzeugt das nie; nach einer Hand-Änderung kann es passieren.
 */
export function crossStoreConflicts(
  stores: readonly { storeId: string; shortName: string; schedule: Schedule }[],
): CrossStoreConflict[] {
  const byPersonDay = new Map<string, { personKey: string; name: string; date: string; stores: Set<string> }>();
  for (const store of stores) {
    const byId = new Map(store.schedule.employees.map((employee) => [employee.id, employee]));
    for (const shift of store.schedule.shifts) {
      const employee = byId.get(shift.employeeId);
      if (!employee?.personKey) continue;
      const key = `${employee.personKey}|${shift.date}`;
      const entry = byPersonDay.get(key) ?? { personKey: employee.personKey, name: employee.name, date: shift.date, stores: new Set<string>() };
      entry.stores.add(store.shortName);
      byPersonDay.set(key, entry);
    }
  }
  return [...byPersonDay.values()]
    .filter((entry) => entry.stores.size > 1)
    .map((entry) => ({ ...entry, stores: [...entry.stores] }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/**
 * Läden nacheinander planen. Wer in mehreren Läden arbeitet (personKey), ist an
 * seinen schon verplanten Tagen im nächsten Laden gesperrt – eine Person arbeitet
 * an einem Tag nur in einem Laden. `plan` bekommt die gesperrten Tage je
 * Mitarbeiter-id und liefert die Dienste des Ladens.
 */
export function planAcrossStores(
  stores: readonly {
    employees: readonly Employee[];
    plan: (blockedDays: Record<string, string[]>, daysPerWeekCap: Record<string, number>) => readonly { employeeId: string; date: string }[];
  }[],
): void {
  const busyByPerson = new Map<string, Set<string>>();
  // Vertragsminuten je Person über alle Läden – für die Aufteilung der Arbeitstage.
  const totalByPerson = new Map<string, number>();
  for (const store of stores) {
    for (const employee of store.employees) {
      if (employee.personKey) totalByPerson.set(employee.personKey, (totalByPerson.get(employee.personKey) ?? 0) + employee.targetMinutes);
    }
  }
  stores.forEach((store, index) => {
    const blocked: Record<string, string[]> = {};
    const caps: Record<string, number> = {};
    const later = stores.slice(index + 1);
    for (const employee of store.employees) {
      if (!employee.personKey) continue;
      const dates = busyByPerson.get(employee.personKey);
      if (dates?.size) blocked[employee.id] = [...dates].sort();
      // Ein früher geplanter Laden darf nicht alle Tage nehmen: höchstens 6 Tage je
      // Woche für den Menschen, aufgeteilt nach den Vertragsstunden. Der letzte
      // Laden bekommt, was übrig bleibt.
      const total = totalByPerson.get(employee.personKey) ?? 0;
      const laterToo = later.some((other) => other.employees.some((e) => e.personKey === employee.personKey));
      if (laterToo && total > 0) caps[employee.id] = Math.max(1, Math.min(5, Math.round((6 * employee.targetMinutes) / total)));
    }
    const shifts = store.plan(blocked, caps);
    for (const employee of store.employees) {
      if (!employee.personKey) continue;
      const dates = busyByPerson.get(employee.personKey) ?? new Set<string>();
      for (const shift of shifts) if (shift.employeeId === employee.id) dates.add(shift.date);
      busyByPerson.set(employee.personKey, dates);
    }
  });
}

export type CrossStoreRunIssue = { personKey: string; name: string; message: string };

/**
 * Arbeitszeitgesetz für den MENSCHEN, nicht je Laden: höchstens 6 Tage am Stück
 * und höchstens 6 Tage je Woche, beide Läden zusammengezählt.
 */
export function crossStoreRunIssues(
  stores: readonly { storeId: string; shortName: string; schedule: Schedule }[],
): CrossStoreRunIssue[] {
  const datesByPerson = new Map<string, { name: string; dates: Set<string>; stores: Set<string> }>();
  for (const store of stores) {
    const byId = new Map(store.schedule.employees.map((employee) => [employee.id, employee]));
    for (const shift of store.schedule.shifts) {
      const employee = byId.get(shift.employeeId);
      if (!employee?.personKey) continue;
      const entry = datesByPerson.get(employee.personKey) ?? { name: employee.name, dates: new Set<string>(), stores: new Set<string>() };
      entry.dates.add(shift.date);
      entry.stores.add(store.storeId);
      datesByPerson.set(employee.personKey, entry);
    }
  }
  const issues: CrossStoreRunIssue[] = [];
  for (const [personKey, entry] of datesByPerson) {
    if (entry.stores.size < 2) continue;
    const run = maxConsecutiveRun(entry.dates);
    if (run > 6) issues.push({ personKey, name: entry.name, message: `làm ${run} ngày liên tiếp (tính cả hai quán, tối đa 6)` });
    const byWeek = new Map<string, number>();
    for (const date of entry.dates) byWeek.set(weekStartOf(date), (byWeek.get(weekStartOf(date)) ?? 0) + 1);
    for (const [week, days] of byWeek) {
      if (days > 6) issues.push({ personKey, name: entry.name, message: `tuần ${week.slice(8)}.${week.slice(5, 7)}. làm ${days} ngày (tính cả hai quán, tối đa 6)` });
    }
  }
  return issues;
}
