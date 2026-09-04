# Coffee-Cost-Report — ระบบรายงานต้นทุนการผลิต/Loss เมล็ดกาแฟ

Web report for the cost-accounting department (บัญชีต้นทุนสินค้า) to view
and export monthly coffee production-cost, bean-loss, and yield reports.

**Start any new session on this project by reading the latest file in
[`daily-reports/`](daily-reports/) first.**

## Origin

Client provided a reference Excel workbook,
[`../Reference-File/ตรวจ MB51_0769.xlsx`](../Reference-File/ตรวจ%20MB51_0769.xlsx),
containing one raw SAP MB51 export sheet (`MB51 328`) plus 4 hand-built
pivot-table sheets (`301`, `302`, `303 `, `305`) — one per production
order-type/stage — that compute cost allocation, yield %, and loss % each
month. This is the process the website is meant to support. Full
sheet-by-sheet, formula-by-formula analysis:
[`docs/source-analysis.md`](docs/source-analysis.md).

## Status — 2026-08-21 (one long first session, see `daily-reports/`)

A second reference workbook, `../Reference-File/Roasting Dashboard
Initiative.xlsx`, added a **Summary Dashboard tab** ("แดชบอร์ดสรุป", first
tab) — one row per month, Preclean → Roasting → Packing yield, mirroring
that workbook's `Dash` sheet, classified by SLoc + movement type +
material code (not the sign-based inference the other tabs use — that
was measurably less accurate here). Verified exactly against the source's
7 months of cached numbers, except FG→kg conversion which needs real
per-material gram weights. Full detail: `docs/roasting-dashboard-analysis.md`.

The dashboard tab was then redesigned to match a reference screenshot:
5 KPI cards, 3 trend charts (`%Yield 1 Trend`, `Lot Number 1 (Cumulative)`
by Arabica/Robusta, `%Yield 1 Trend By Supplier` — supplier parsed from
MB51's `Batch` column), and a restyled Production Summary table. The
month filter became a range picker (from/to, with quick presets) instead
of a single-month dropdown.

**301, 302, and 303 are implemented with their own real, verified
formulas** — each stage turned out to compute genuinely different things
(301: STD-based cost reallocation; 302: blend-mix and output ratios; 303:
weight-based yield), not one template reused four times, and each was
checked against the source file's actual numbers before being trusted.
**305 hasn't been reviewed yet** and still runs on 301's placeholder
logic (marked with a "รอสูตรจริง" badge in the UI).

What's still explicitly out of scope, pending an on-site conversation
with production/QA the user has mentioned but not yet had: 303's ~20
manual daily defect-reason columns (QA เบิก, โรบอทตีแตก, ฟิล์มยับ, etc.) —
a separate sub-table in the source that the core Yield/Loss calc doesn't
actually depend on, so it was safe to implement 303 for real without it.
The user wants a web entry form plus an import function for this data
eventually.

Two pieces of master data that the source hardcodes but this app makes
editable instead (since neither has a confirmed business rule, and both
mirror how accounting already works today): **STD%** per material (301's
cost-reallocation input) and **grams per unit** per output material
(303's yield calc — the source hardcodes "500g" directly in formulas,
which breaks for any other bag size).

Full round-by-round history — including a real data-loss bug found and
fixed (302/303 orders can have several input materials; the report used
to keep only one) and a copy-paste formula bug found in the source file
itself (not reproduced) — is in
[`daily-reports/2026-08-21.md`](daily-reports/2026-08-21.md). Current
state is summarized in [`CLAUDE.md`](CLAUDE.md).

## Running it

```
npm install
npm run dev
npm run db:check    # ตรวจสอบการเชื่อมต่อ MySQL และ log ผลใน terminal
```

Open http://localhost:3000 (or whatever port it prints), upload an MB51
Excel export (must contain a sheet named `MB51 328` with a `Pstng Date`
column), switch between the 301/302/303/305 tabs, optionally filter by
month, fill in the editable master fields (STD%, grams/unit) inline, and
download the computed report as Excel per stage.

## MySQL environment

MySQL connection placeholders are in `.env`; copy `.env.example` when
setting up another environment and replace the placeholder values:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=coffee_cost_report
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DATABASE_URL=mysql://your_mysql_user:your_mysql_password@localhost:3306/coffee_cost_report
DB_CONNECTION_LIMIT=10
DB_SSL=false
```

The current Phase 1 application still reads and writes local JSON files in
`data/`. These variables are prepared for the upcoming database integration;
the connection pool is available from `lib/database/connection.ts`, but the
DB query layer and table mapping have not been added yet.

## Structure

คู่มือโครงสร้างโปรเจกต์ฉบับภาษาไทย (โฟลเดอร์ทีละส่วน + data flow):
[`docs/คู่มือโครงสร้างโปรเจกต์.md`](docs/%E0%B8%84%E0%B8%B9%E0%B9%88%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B9%82%E0%B8%84%E0%B8%A3%E0%B8%87%E0%B8%AA%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%87%E0%B9%82%E0%B8%9B%E0%B8%A3%E0%B9%80%E0%B8%88%E0%B8%81%E0%B8%95%E0%B9%8C.md).

- `app/` — Next.js pages and API routes (`upload`, `std`, `unit-weight`, `export`).
- `lib/ingestion/parse.ts` — reads an MB51 sheet into raw rows.
- `lib/core/dates.ts` — turns a row's posting date into a "YYYY-MM" month key
  and a Thai month label, for the month filter.
- `lib/reports/pivotOrderReport.ts` — sheet 301's formulas.
- `lib/reports/pivot302.ts`, `pivot303.ts`, `pivot305.ts` — stage-specific formulas.
- `lib/reports/summaryDashboard.ts` — the Summary Dashboard tab's monthly
  Preclean/Roasting/Packing aggregation (SLoc + movement type + material
  code classification, not sign-based).
- `lib/exports/` — builders for downloadable Excel reports.
- `lib/persistence/store.ts` — file-backed persistence (uploaded batch, STD% and
  unit-weight master data); the seam where a future DB-backed data
  source plugs in.
- `components/stages/` — one table component per stage, since their real column sets differ.
- `components/dashboard/` — the Summary Dashboard tab (KPI cards, charts, table).
- `components/filters/`, `components/modals/`, `components/summaries/` — supporting UI flows.
- `components/shared/reportTableStyles.ts` — shared table styles.
- `docs/source-analysis.md` — full sheet-by-sheet, formula-by-formula
  analysis of the reference workbook, including the two copy-paste bugs
  found in the source file itself.
- `.claude/agents/coffee-cost-report-ba.md` — BA Project Owner.
- `daily-reports/` — per-session progress log.
