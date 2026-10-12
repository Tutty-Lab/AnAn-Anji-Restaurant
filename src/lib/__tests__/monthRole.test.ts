// „Làm được cả Bếp và Phục vụ": eine Person wechselt für einen Monat die Rolle.
import { describe, expect, it } from "vitest";
import { monthRole, withMonthRoles } from "../monthRole";
import { generateSchedule } from "../scheduler";
import { DEFAULT_WORK_HOURS } from "../workHours";
import { ananRoster } from "../ananPayroll";
import { staffGroupOf } from "../staffing";
import type { Employee } from "../../types";

const cook: Employee = {
  id: "k", name: "k", employmentType: "VOLLZEIT", targetMinutes: 173 * 60, workRole: "KITCHEN",
  canSwitchRole: true, roleByMonth: { "2026-10": "SERVICE" },
};

describe("Rolle je Monat", () => {
  it("gilt nur im gewählten Monat und nur mit Häkchen", () => {
    expect(monthRole(cook, 2026, 10)).toBe("SERVICE");
    expect(monthRole(cook, 2026, 11)).toBe("KITCHEN");
    expect(monthRole({ ...cook, canSwitchRole: false }, 2026, 10)).toBe("KITCHEN");
    expect(monthRole({ ...cook, workRole: "DRIVER" }, 2026, 10)).toBe("DRIVER");
  });

  it("der Planer setzt einen Koch als Phục vụ ein und schließt damit Service-Lücken", () => {
    // AnAn ab 12/2024: 7 Köche, aber nur 2 Phục vụ – mit zwei Köchen im Service
    // gibt es deutlich weniger halbe Stunden ohne Phục vụ.
    const base = ananRoster("2024-12");
    const cooks = base.filter((e) => e.workRole === "KITCHEN" && e.employmentType === "VOLLZEIT").slice(0, 2).map((e) => e.id);
    const switched = base.map((e) => cooks.includes(e.id) ? { ...e, canSwitchRole: true, roleByMonth: { "2026-10": "SERVICE" as const } } : e);
    const serviceGaps = (employees: Employee[]) => {
      const monthEmployees = withMonthRoles(employees, 2026, 10);
      const shifts = generateSchedule({ year: 2026, month: 10, workHours: DEFAULT_WORK_HOURS, employees: monthEmployees });
      const service = new Set(monthEmployees.filter((e) => staffGroupOf(e) === "SERVICE").map((e) => e.id));
      let gaps = 0;
      for (let day = 1; day <= 31; day++) {
        const date = `2026-10-${String(day).padStart(2, "0")}`;
        // 17:00–22:30 hat jeden Tag geöffnet.
        for (let minute = 17 * 60; minute < 22 * 60 + 30; minute += 30) {
          if (!shifts.some((s) => s.date === date && service.has(s.employeeId) && s.startMinutes <= minute && s.endMinutes > minute)) gaps++;
        }
      }
      return gaps;
    };
    expect(serviceGaps(switched)).toBeLessThan(serviceGaps(base));
  });
});
