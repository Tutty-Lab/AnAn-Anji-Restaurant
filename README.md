# Dienstplan & Stundenzettel — Restaurant AnAn & Restaurant Anji

Eine App für zwei Restaurants desselben Betriebs (Bayern). React-Anwendung für
Wochenplanung innerhalb eines Monats und deutsche Stundenaufzeichnungen. Die
Oberfläche ist auf Vietnamesisch. Erstellt aus
[`template-studenzettell`](https://github.com/Tutty-Lab/template-studenzettell)
(Remote `template`); Aufbau mit mehreren Läden wie in
[`Shin-Coco-Nieu-Restaurant`](https://github.com/Tutty-Lab/Shin-Coco-Nieu-Restaurant).

| Laden | `store_id` | Anschrift | Bereiche |
|---|---|---|---|
| Restaurant AnAn | `anan` | Elvirastr. 12, 80636 München | Bếp, Phục vụ, Lái xe |
| Restaurant Anji | `anji` | Donnersbergerstr. 30, 80634 München | Bếp, Bồi |

## Ein Betrieb, zwei Läden

- Jeder Laden hat eigene Mitarbeiter, eigene Pläne, ein eigenes Passwort, eine
  eigene Zeile in Supabase (`store_data`) und einen eigenen LocalStorage-Schlüssel
  (`stundenzettel-app:v1:<store_id>`; der alte AnAn-Schlüssel ohne Suffix wird
  beim ersten Laden übernommen).
- Monat und Jahr stehen oben in der Kopfzeile und gelten für beide Läden. Die
  Reihe unter den Tabs wählt den angezeigten Laden. **„Tạo lịch"** plant beide.
- Die App öffnet sich mit dem eigenen Passwort eines der beiden Läden; das
  Startpasswort gilt nur, solange keiner ein eigenes gesetzt hat.
- Alles, was die Läden unterscheidet (Besetzungsregeln, Tagesgewichte,
  Nachfragekurve, Bezeichnungen, Bereiche), steht als `StoreProfile` in
  `src/lib/staffing.ts` (`ANAN_PROFILE`, `ANJI_PROFILE`). Planer, Prüfung,
  Độ phủ und Tab „Tài liệu" lesen nur das Profil.

## Mitarbeiter in beiden Läden

Thi Thuy Nhu, Huy Nam Nguyen und Hong Son Le stehen in beiden
Lohnabrechnungen und tragen denselben `personKey` (`src/lib/stores.ts`). Neue
Verbindungen setzt der Tab „Nhân viên" im Feld „Cũng làm ở quán khác"
(`src/lib/sharedPerson.ts`, aus Shin-Coco-Nieu).

- **Eine Person arbeitet an einem Tag nur in einem Laden.** „Tạo lịch" plant
  AnAn, dann Anji (`planAcrossStores`); Tage aus AnAn sind in Anji gesperrt.
- **Arbeitszeitgesetz für den Menschen:** höchstens 6 Tage am Stück und 6 Tage je
  Woche, beide Läden zusammen. Der zuerst geplante Laden bekommt höchstens so
  viele Tage je Woche, wie es dem Anteil seiner Vertragsstunden entspricht
  (Huy Nam: AnAn 28,2 h von 202 h → 1 Tag/Woche).
- Eine Hand-Änderung, die jemanden doppelt einplant oder über 6 Tage bringt,
  meldet die App rot oben auf der Seite (`crossStoreConflicts`,
  `crossStoreRunIssues`).
- Hong Son Le: Anji 03–06/2024, AnAn 10/2024 – nie im selben Monat.
- Lohndaten Anji: „AnAn_Anji_BangLuong_ChamCong_2023_2024.pdf", gegen die
  einzelnen Lohnabrechnungen geprüft (dazu 12/2023 Ha Phuong Nguyen 32,45 h).

## Arbeitszeit (beide Läden)

Die Arbeitszeit beginnt 30 Minuten vor der Öffnung – dann bereitet 1 Person
die Küche vor.

| Tag | Öffnung | Arbeitszeit |
| --- | --- | --- |
| Montag–Freitag | 11:00–14:30 und 17:00–22:30 | 10:30–14:30 und 17:00–22:30 |
| Samstag | 11:00–22:30 | 10:30–22:30 |
| Sonntag, Feiertag (Bayern) | 12:00–22:30 | 11:30–22:30 |

## Besetzung

- **Hart (beide):** immer mindestens 1 Bếp (ab Vorbereitung) und 1 Phục vụ/Bồi
  (ab Öffnung). Der Scheduler gewichtet harte Regeln zehnfach
  (`hardRuleFactor`); sie werden auch gemeldet, wenn ein Bereich keine Person hat.
- **Weich (beide, AnAn/Anji):** Service T2–T5: mittags 12–14 2–3 / 3 (Anji),
  18–20 3–4, 20–21 2, 21–Schluss 1. Fr–So: mittags ≥ 2 / 3, abends 18–22 ≥ 3 / 4,
  Schluss 2. Küche: Vorbereitung 1, mittags 2 / 3, Fr–So abends 18–21 3 / 4.
  AnAn-Fahrer: Kernzeit 18:00–21:00 (So/Feiertag 18:00–22:00): Mo–Sa 1, So 2.
- Reicht das Personal nicht, fallen weiche Lücken bevorzugt auf Mo–Mi
  (Fr–So ×3, Mo–Mi ×0,5); harte Regeln wiegen ×100.
- Weiche Zahlen gelten nur in den Stoßzeiten: mittags = 12:00–14:00, abends =
  18:00–22:00. Beim Öffnen (11–12, 17–18), 14:00–14:30 und Sa/So 14:30–17:00
  reicht 1 Bếp + 1 Phục vụ/Bồi. Schluss 22:00–22:30 (weich): 2 Phục vụ/Bồi, 1 Bếp.
- **Tagesgewichte (beide):** Mo–Do 1,0, Fr/Sa/So 1,5 (am stärksten Fr, Sa, So).

## Lohnabrechnung

`src/lib/ananPayroll.ts` (06/2023–12/2024) und `src/lib/anjiPayroll.ts`
(05/2023–12/2024): Anw.-Std. je Monat, Ein- und Austritt, Bereiche und Azubi
laut Liste des Betriebs. Ab 150 h/Monat Vollzeit. `storeRoster(id, "2024-12")`
ist die Startbelegschaft je Laden.

Alle Monate beider Läden planen und prüfen – genau wie „Tạo lịch":

```bash
npx vite-node scripts/export-all.mts output
```

Ergebnis: `output/anan/` und `output/anji/` mit `<Monat>_Dienstplan.pdf` (eine
Seite je Woche), `<Monat>_Stundenzettel.pdf`, `lich-tat-ca.csv`, `BAO-CAO.md`,
dazu `output/NGUOI-LAM-2-QUAN.md` (Personen in beiden Läden).

## Verträge

- **Monatsvertrag:** im 30-Minuten-Raster, nie überschritten (173,81 h → 173,5 h).
- **Eintritt / Austritt** (`startDate`, `endDate`): Tage davor bzw. danach sind
  gesperrt; die eingetragenen Stunden gelten für den restlichen Monat.
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

Supabase: `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` (oder die
`NEXT_PUBLIC_*`-Namen der Vercel-Integration). `VITE_STORE_ID_PREFIX` (z. B.
`test-`) lenkt lokal auf Testzeilen um. Die Passwortsperre im Client ersetzt
keine Zugriffskontrolle.
