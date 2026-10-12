// ============================================================================
// Rolle einer Person für einen Monat (aus Thiên Long, roleCoverage.ts).
//
// Hauptrolle = workRole. Bei „Làm được cả Bếp và Phục vụ" (canSwitchRole) kann
// für einzelne Monate die andere Rolle gewählt werden (roleByMonth). Planer,
// Prüfung, Độ phủ und Anzeige bekommen die Mitarbeiter mit der Rolle DIESES
// Monats als workRole – staffGroupOf bleibt damit unverändert die einzige Stelle,
// die den Bereich bestimmt.
// ============================================================================

import type { Employee, WorkRole } from "../types";

export const monthKeyOf = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

/** Wechsel nur zwischen Küche und Service – Fahrer bleiben Fahrer. */
export function canSwitchRoleFor(role: WorkRole | undefined): boolean {
  return role === "KITCHEN" || role === "SERVICE";
}

/** Rolle der Person in diesem Monat. */
export function monthRole(employee: Employee, year: number, month: number): WorkRole | undefined {
  if (employee.canSwitchRole && canSwitchRoleFor(employee.workRole)) {
    const override = employee.roleByMonth?.[monthKeyOf(year, month)];
    if (override && canSwitchRoleFor(override)) return override;
  }
  return employee.workRole;
}

/** Mitarbeiter mit der Rolle dieses Monats als workRole (für Planer, Prüfung, Anzeige). */
export function withMonthRoles(employees: readonly Employee[], year: number, month: number): Employee[] {
  return employees.map((employee) => {
    const role = monthRole(employee, year, month);
    return role === employee.workRole ? employee : { ...employee, workRole: role };
  });
}

/** Hat die Person diesen Monat eine andere Rolle als ihre Hauptrolle? */
export function isRoleSwitchedInMonth(employee: Employee, year: number, month: number): boolean {
  return monthRole(employee, year, month) !== employee.workRole;
}
