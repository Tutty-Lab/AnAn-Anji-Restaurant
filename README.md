# Dienstplan & Stundenzettel — Restaurant AnAn

Elvirastr. 12, 80636 München (Bayern). React-Anwendung für Wochenplanung
innerhalb eines Monats und deutsche Stundenaufzeichnungen. Die Oberfläche ist
auf Vietnamesisch. Erstellt aus
[`template-studenzettell`](https://github.com/Tutty-Lab/template-studenzettell)
(Remote `template`, damit spätere Korrekturen übernommen werden können).

## Arbeitszeit

Die Arbeitszeit beginnt 30 Minuten vor der Öffnung – dann bereitet 1 Person
die Küche vor.

| Tag | Öffnung | Arbeitszeit |
| --- | --- | --- |
| Montag–Freitag | 11:00–14:30 und 17:00–22:30 | 10:30–14:30 und 17:00–22:30 |
| Samstag | 11:00–22:30 | 10:30–22:30 |
| Sonntag, Feiertag (Bayern) | 12:00–22:30 | 11:30–22:30 |

## Besetzung

Die Regeln stehen an einer Stelle (`src/lib/staffing.ts`, `STAFFING_RULES`) und
werden im Tab „Tài liệu" direkt daraus angezeigt.

- **Bereiche:** Bếp (Küche), Phục vụ (Service/Bồi), Lái xe (Fahrer). Personen
  ohne Bereich zählen wie Service, bis der Admin sie zuordnet.
- **Hart:** von Öffnung bis Schluss immer mindestens 1 Bếp (ab Vorbereitung)
  und 1 Phục vụ (ab Öffnung). Der Scheduler gewichtet harte Regeln zehnfach
  (`hardRuleFactor`); sie werden auch gemeldet, wenn ein Bereich keine Person hat.
- **Weich:** Phục vụ Mo–Mi mittags 2 / abends 2, Do–So mittags 2 / abends 3.
  Bếp Vorbereitung genau 1, mittags 2 (täglich), abends 3 (Do–Sa, gern 4).
  Mittags = Öffnung–14:30, abends = 17:00–Schluss.
- **Fahrer:** vor allem abends. Kernzeit 18:00–21:00 (So/Feiertag 18:00–22:00):
  Mo–Sa 1 Fahrer, So 2. Fahrer zählen nicht zur Besetzung im Laden und dürfen in
  allen Öffnungszeiten arbeiten – Stunden, die abends keinen Platz haben, gehen
  in den Mittag (Vollzeitfahrer mit 173,81 h passen nicht in 3 h je Abend).
- **Tagesgewichte:** Mo–Mi 1,0, Do 1,3, Fr/Sa 1,5, So 1,3.

## Lohnabrechnung 06/2023–12/2024

`src/lib/ananPayroll.ts` enthält die Anw.-Std. je Monat, Eintritt und Austritt
sowie die Bereiche laut Angabe des Betriebs (`ANAN_ROLES`). Azubi bleibt Azubi,
ab 150 h/Monat Vollzeit, über 50 h Teilzeit, sonst Minijob.
`ananRoster("2024-12")` ist die Startbelegschaft der App. 12/2023 (keine
Stunden) und 04/2024 (nur 1 Zeile) fehlen in der Abrechnung
(`ANAN_MISSING_MONTHS`).

Alle Monate planen und prüfen:

```bash
npx vite-node scripts/export-anan.mts output/anan
```

Ergebnis je Monat: `<Monat>_Dienstplan.pdf` (eine Seite je Woche),
`<Monat>_Stundenzettel.pdf`, dazu `lich-tat-ca.csv` und `BAO-CAO.md`
(harte/weiche Regeln, Arbeitszeitgesetz, Verträge).

## Verträge

- **Monatsvertrag:** im 30-Minuten-Raster, nie überschritten (173,81 h → 173,5 h).
- **Wochenvertrag** (z. B. Azubi 39 h/Woche) als harte Wochengrenze; in
  eingetragenen Berufsschulzeiten kein Dienst.
- **Eintritt / Austritt** (`startDate`, `endDate`): Tage davor bzw. danach sind
  gesperrt. Die eingetragenen Stunden gelten für den restlichen Monat (wie in
  der Lohnabrechnung).
- Vollzeit: feste Dienste je Wochentag. Teilzeit/Minijob: bevorzugt Stoßzeiten.
- Höchstens 9 h bezahlte Arbeit je Tag, 6 Tage am Stück, 6 Tage je Woche.
  Pausen über 6 h 30 Minuten, über 8 h 60 Minuten.

## Entwicklung

React, TypeScript, Vite, Tailwind CSS, date-fns, jsPDF und Vitest.

```bash
npm install
npm run dev
npx tsc -b
npx vitest run
npm run build
```

Persistenz über LocalStorage und optional Supabase (`store_data`, Zeile
`store_id = "anan"`), konfiguriert mit `VITE_SUPABASE_URL` und
`VITE_SUPABASE_ANON_KEY`. Die Passwortsperre im Client ersetzt keine
Zugriffskontrolle.
