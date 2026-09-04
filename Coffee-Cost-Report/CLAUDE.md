# Coffee-Cost-Report — Project Charter

This project is one of the workspace's sibling projects — see the
workspace-root [`../CLAUDE.md`](../CLAUDE.md) for the PMO operating model
(one entry point, Agent-tool dispatch to department Project Owners,
one-direction reporting back to PMO, daily-report convention). This file
holds only what's specific to this project.

## What this is

A web report/dashboard for **บัญชีต้นทุนสินค้า** (cost accounting) to view
and export monthly coffee-production cost, bean-loss, and yield reports —
replacing (or fronting) a manual Excel pivot-table process. Started
2026-08-21. PMO read and fully mapped the reference workbook
(`../Reference-File/ตรวจ MB51_0769.xlsx`), the user confirmed phase-1 scope
same day, and PMO built + verified a working MVP against the real
reference data in that first session.

Full data/formula analysis: [`docs/source-analysis.md`](docs/source-analysis.md).
**Read that file before touching any pivot logic** — the source workbook
is not one uniform template; each production stage has its own pivot
shape and its own verified formula breakdown there.

## Status (2026-08-21, 305 updated 2026-08-26) — all 4 stages implemented for real

This entire status section reflects one long first session; the
round-by-round history (5 rounds — scope confirmation, Excel-fidelity UI,
a real multi-input-material data-loss bug fix, month filtering, and
implementing 302/303's actual formulas) is preserved in
[`daily-reports/2026-08-21.md`](daily-reports/2026-08-21.md). This
section is the current-state snapshot; read the daily report for *why*.

**Confirmed with the user**: file upload is the ingestion method for now
(an RPA job already lands MB51 into a database daily — a future phase
should read from that directly; [`lib/store.ts`](lib/store.ts) is the
seam for that swap). STD% (301) and unit-weight-per-material (303) are
both accounting-editable master data with no confirmed business rule
behind them yet — mirrors how accounting fills them in today. 303/305's
manual daily defect-log entry (the "web entry form + import function"
the user wants) is explicitly not built — still blocked on an on-site
conversation with production/QA that hasn't happened yet.

**What's implemented, per stage** (all verified against the real
reference file's actual numbers, not synthetic data):
- **301 (Preclean)**: full formula set — [`lib/pivotOrderReport.ts`](lib/pivotOrderReport.ts),
  `Stage301Table.tsx`. Every material an order touches gets its own row
  (role: input/output/neutral) — no merging.
- **302 (Roasting)**: full formula set, fully MB51-derivable, no manual
  data needed — [`lib/pivot302.ts`](lib/pivot302.ts), `Stage302Table.tsx`.
  A real copy-paste bug was found and *not* reproduced (see
  `docs/source-analysis.md`). Not implemented: the "สูตร FG" cross-reference
  to sheet 303 (no reliable Order→Order mapping exists in MB51).
- **303 (Packaging)**: core Yield/Loss and price are real and
  MB51-derivable — [`lib/pivot303.ts`](lib/pivot303.ts), `Stage303Table.tsx`.
  Needs an editable "grams per unit" master value per output material
  (`data/unit-weight-master.json`, `/api/unit-weight`) since MB51 has no
  weight field. Not implemented: the ~20-column manual daily
  defect-reason log — separate sub-table in the source, genuinely needs
  the pending on-site conversation.
- **305 (retail repacking, "CPR" brand)**: full real formula set, verified
  2026-08-26 against both reference files —
  [`lib/pivot305.ts`](lib/pivot305.ts), `Stage305Table.tsx`. Same shape as
  303 (one BAG-unit blend input + PC/EA consumables → BAG output), but
  since input *and* output are both bag-counted (not KG), yield needs a
  grams-per-bag weight on **both** sides, not just the output — reuses
  `FG_UNIT_WEIGHT_GRAMS` + the editable `UnitWeightMaster` fallback.
  Verified this matters: the small `ตรวจ MB51_0769.xlsx` reference sample
  only had 1:1-same-size orders, but the fuller
  `Roasting Dashboard Initiative.xlsx` data has orders that repack one
  500g bag into two 250g bags — a naive bag-count ratio would show 200%
  "yield" there; the weight-based calc correctly shows ~100% once both
  materials' weights are known, and "-" (not a wrong number) when a
  material's weight isn't yet confirmed. Not implemented: the ~10-column
  manual daily defect-reason log, same reason as 303 (needs the pending
  on-site conversation with production/QA).

**UI**: 4 tabs (301/302/303/305) sharing one upload + month filter
(parsed from MB51's `Pstng Date`, [`lib/dates.ts`](lib/dates.ts)), each
rendering its own stage-specific table component since 302/303's real
column sets genuinely differ from 301's. Excel-like styling (grid
borders, gray header, bold Sum row), expand-all/collapse-all plus a
per-order toggle (collapsing shows only that order's Sum row; the order
number stays visible as a muted label on the first material row too, so
scrolling a long expanded order doesn't lose its anchor). Quantity/Amount
columns keep their real SAP sign (negative = issued); ratio columns
(สัดส่วน, %Yield, %Loss, Settlement Rule) are positive 0–1 fractions
instead of the source's negative-fraction convention — a deliberate
readability change, kept since round 1. `สถานะ`/`Por Ver` were tried
briefly then fully removed (not just hidden) since their business
meaning was never confirmed.

`xlsx` is installed from the SheetJS CDN tarball, not npm — the
npm-published package has unpatched CVEs.

Not done yet: authentication/access control, hosting/deployment
(currently local dev only — `npm run dev`), 303/305's manual defect-log
UI, DB-backed ingestion, and `สถานะ`/`Por Ver`.

**Round 6, same day**: BA analyzed a second, separate reference workbook,
`../Reference-File/Roasting Dashboard Initiative.xlsx`
([`docs/roasting-dashboard-analysis.md`](docs/roasting-dashboard-analysis.md)),
per the user's request to update the raw data from its `MB51 M. 1-7` sheet
and add a new Summary Dashboard page based on its `เงื่อนไข`/`สรุป` sheets.
User then answered all 4 open questions same day (sheet detection:
generalize; dashboard scope: include Preclean; grade split: pure material
code; external SharePoint file: not needed) and PMO implemented it.

**Sheet detection generalized**: `lib/parse.ts` now matches any sheet
starting with "MB51" instead of hardcoding `"MB51 328"` — both this
file's `MB51 M. 1-7` and the original file's `MB51 328` upload correctly.

**New Summary Dashboard tab** ("แดชบอร์ดสรุป", first tab): one row per
month, Preclean → Roasting → Packing, mirroring the reference workbook's
`Dash` sheet — [`lib/summaryDashboard.ts`](lib/summaryDashboard.ts),
`components/SummaryDashboardTable.tsx`. Important: this does **not** use
the sign-based input/output inference the 301/302/303 tabs use — that was
tried first and came out 10–34% off. The dashboard instead classifies
every row by SLoc + movement type + material code, exactly as `เงื่อนไข`
defines it, and every one of the 7 available months' Preclean/Roasting/
Packing input and output figures now matches the reference workbook's own
cached numbers exactly (to the cent) — except FG→kg, which needs real
per-material gram weights accounting hasn't entered yet (same
`UnitWeightMaster` field the 303 tab already uses). Two real bugs were
found and fixed during this work — full detail in
`docs/roasting-dashboard-analysis.md`'s "Implementation" section: (1) the
source `เงื่อนไข` sheet itself has a copy-paste error (Packing's input
movement type is written as "101/102", should be "261/262" — a third
source-file bug, matching the two already found in the original
`ตรวจ MB51_0769.xlsx`, not reproduced); (2) an early version of this app's
own code summed reversal rows' absolute value instead of netting them,
causing a real ~10-30% overcount — caught and fixed via full 7-month
verification before shipping, not left in.

`RawMovementRow` gained two new required fields, `sLoc` and `mvt` (from
MB51's `SLoc`/`MvT` columns) — present in both reference files, needed
only by the dashboard. It also gained one optional field, `batch` (from
MB51's "Batch" column, e.g. "130825-TTW") — not required to parse a file,
only used for the by-supplier chart below.

**Round 7 continued, same day**: user shared a reference screenshot of a
richer "Coffee Roasting Performance & Monitoring" dashboard and asked for
the same look, plus one formula correction: **%Yield 3 = FG ÷ Output
Roasting** (this month's Roasting output), not ÷ Packing's own netted
input — the two are usually close but not the same figure by definition.
Fixed in `lib/summaryDashboard.ts`'s `packingSummary` (now takes
`roastingOutputQuantity` as an explicit parameter for the yield
denominator; `inputQuantity` — Packing's own consumption — is kept as a
separate, informational field).

**New**: `components/DashboardOverview.tsx` — 5 KPI cards (grouped by
stage, amber/sky/orange) + 3 trend charts (`recharts`, newly added
dependency) on top of the existing table: `%Yield 1 Trend` (line),
`Lot Number 1 (Cumulative)` split by variety (Arabica 57000002 / Robusta
57000004 — the two Lot#1 codes), and `%Yield 1 Trend By Supplier` (grouped
bar). Supplier code is derived from MB51's `Batch` column using the exact
formula the user provided: `=IFERROR(REGEXREPLACE(Batch, "[^A-Za-z/]",
""),"-")` — verified the output batch on a Preclean order carries the
*same* batch string as its input (the process doesn't relabel it), so
supplier attribution works by tagging each row's own batch independently,
no explicit order-level join needed. `SummaryDashboardTable.tsx` restyled
to match the reference (colored group header bands, numbered rows,
9-column set matching the source `Dash` sheet — dropped the "Output รวม"
and "%Yield รวม" columns the earlier version added, since the reference
only shows the combined yield as a KPI card, not a table column).

**Month filter replaced with a range picker**: `components/MonthRangeFilter.tsx`
(a `<details>`-based chip + panel, quick presets + explicit from/to
selects) replaces the old single-month `<select>`. `ReportView.tsx`'s
`selectedMonth` state became `monthFrom`/`monthTo`, defaulting to the full
available range. `/api/export` takes `from`/`to` query params instead of
`month`.

A static HTML preview of the new dashboard (real verified Jan–Jul 2026
numbers, not live-connected to the app) was published as a Claude
Artifact at the user's request, so they could see the look without
running the dev server locally.

**Round 9, same day**: user asked to bring the *real* Next.js app's visual
design up to match the Artifact preview, not just the dashboard tab.
Applied the Artifact's full token system app-wide:
- `app/layout.tsx`/`app/globals.css`: swapped the scaffold's Geist fonts
  for **Sarabun** (body/display, Thai+Latin) and **IBM Plex Mono** (data/
  tabular numbers) via `next/font/google`; added the light+dark CSS custom
  properties (`--bg`, `--surface`, `--text`, `--preclean(-soft/-line)`,
  `--roasting(-soft/-line)`, `--packing(-soft/-line)`, `--up`, `--down`)
  registered as Tailwind v4 theme tokens via `@theme inline`, so components
  use plain classes (`bg-preclean-soft`, `text-roasting-line`, etc.).
- `components/reportTableStyles.ts`, `ReportView.tsx`,
  `DashboardOverview.tsx`, `SummaryDashboardTable.tsx`,
  `MonthRangeFilter.tsx` restyled onto these tokens — same warm-neutral
  background, same three stage accent colors (Preclean=sage green,
  Roasting=roast brown, Packing=deep teal) as the Artifact, same KPI-card/
  cluster-label layout.
- One real bug caught while restyling: `border-l-4 border-l-${accent}`
  (template-literal class interpolation) doesn't work in Tailwind — the
  compiler only picks up classes that appear as literal strings in source,
  so dynamically-built class names are silently dropped. Fixed with a
  `Record<Accent, string>` lookup of fully literal class strings instead.
  Verified the fix by grepping the actual generated dev CSS for
  `.bg-preclean-soft` etc. to confirm the utilities exist, not just that
  the build succeeded (a Tailwind bug like this doesn't fail the build —
  it just silently produces unstyled elements).

**Round 10, same day**: user asked to expand the Artifact into a full
tabbed preview (Dashboard + 301/302/303/305), which — because building it
required knowing the exact current column layout precisely enough to
represent it honestly — surfaced 2 real regressions from Round 7's
toggle-to-top restructuring: `Stage301Table.tsx`'s "Semi" column and
`Stage302Table.tsx`'s "ใส่สาร" column had gone completely blank (never
moved to the new Sum-row-at-top, and the old `i === 0` display on material
rows was deleted without replacement). Both fixed.

**Round 11, same day — confirmed FG unit-weight formula**: user gave the
exact formula for "Yield 3 (tons)" as SQL-style pseudocode (their own
production reporting query) — 7 FG codes (59000001/02/04/07/11/14,
59100000) at 500g, one (59000008) at 250g, everything else excluded
(`ELSE 0`). This resolves the long-open "unit-weight master data" question
for those 8 codes. New [`lib/fgUnitWeights.ts`](lib/fgUnitWeights.ts)
(`FG_UNIT_WEIGHT_GRAMS`), used two ways:
- **Summary Dashboard** (`lib/summaryDashboard.ts`): uses this table
  *only*, no fallback — matches the user's exact `ELSE 0` semantics.
  `PackingMonthSummary.missingUnitWeight` replaced with
  `excludedMaterials: string[]` (informational, not a warning — nothing is
  "missing," it's a confirmed exclusion).
- **303 tab** (`lib/pivot303.ts`, `Stage303Table.tsx`): confirmed table
  first, falls back to the editable `UnitWeightMaster` for anything else —
  the per-order tab stays usable for materials outside the confirmed 8.
  Confirmed materials now render as plain text (not an editable input) in
  the "น้ำหนัก/หน่วย (g)" column.

**Verified against all 7 months of the source's cached FG totals**:
matches exactly for 6 months; July is off by exactly 206 kg, traced to one
real omission — material `59000003` ("...Classic 1 bag ขนาด **500 G.**",
own description literally says 500g) appeared once (412 bags, July 1) but
isn't in the given formula's list. **Flagged to the user, not silently
added** — the formula might deliberately exclude it for a reason not
visible from the data alone.

`npm run lint` and `npm run build` clean throughout.

**2026-08-24 — second %Yield 3 formula added, shown side by side with the
first**: user confirmed there are actually two distinct %Yield 3 figures in
use, both worth showing at once, not one replacing the other:
1. **"เทียบ Raw Material"** — `abs(YIELD 3(FG) tons ÷ INPUT RM tons)` — this
   is exactly the existing `combinedYield` field (FG ÷ Roasting's own
   input), already computed in `lib/summaryDashboard.ts` and already the
   one value the %Yield 3 KPI card showed before this change.
2. **"ที่เคยส่งให้"** ("the one previously given/sent") —
   `YIELD 3(FG) ÷ Output Roasting` — the Round 7 source-confirmed formula,
   already computed as `packing.yield` and already shown per-month in
   `SummaryDashboardTable`, but not previously surfaced on the KPI card.

No new calculation logic was needed — both values already existed, just not
together in one place. `DashboardOverview.tsx`'s `KpiCard` gained an
optional `subs` (two-badge) mode — bottom-left/bottom-right instead of one
centered pill — used only by the %Yield 3 card: "ที่เคยส่งให้" bottom-left,
"เทียบ Raw Material" bottom-right (per the user's explicit corner request),
each with a `title` tooltip naming its formula. Same change mirrored in the
standalone Artifact preview (`Roasting Yield Monitor`,
`https://claude.ai/code/artifact/eb33d660-b77c-4e77-89ab-86356dea0ca6`) —
its full current HTML had never been saved locally (hand-authored directly
to the artifact in Round 8), so it was recovered via `WebFetch` (which
saves the complete raw source to a local tool-results file, not just the
markdown-summarized reply) before editing, to avoid rebuilding the whole
multi-tab preview from scratch. `npm run lint` and `npm run build` clean.

**2026-08-25 — data reload + cross-filter dashboard**: user corrected a
real source-data error in `Roasting Dashboard Initiative.xlsx` (Mat. Doc
`4906355071`'s Batch, one of two Preclean input lines mistagged
`251211-TTW` instead of `260122-RPT`, which had caused supplier RPT's
March %Yield to compute as 101.58% — impossible, since output can't exceed
input). PMO diagnosed the root cause independently (per the user's
"won't reveal the right answer" request) by reconstructing the pre-fix
state against the raw file — confirmed `computeBySupplier`'s per-row batch
attribution logic in `lib/summaryDashboard.ts` was already correct; the
bug was purely in the source data. Re-uploaded the corrected file via
`curl.exe` (PowerShell's own multipart upload attempts failed with a
"Failed to parse body as FormData" environment quirk — not an app bug) —
`data/latest-upload.json` now holds 2,343 rows from today.

Added real cross-filter interactivity to `components/DashboardOverview.tsx`:
shared `selectedMonthKey`/`selectedSupplier` state drives the KPI cards
(swap total ↔ selected month), a `ReferenceLine` + enlarged dots highlight
the selected month on all 3 charts, the summary table row highlights and
is itself clickable, and clicking a supplier's legend entry on the
by-supplier bar chart isolates it (dims the rest). Also fixed that chart's
Y-axis, previously hardcoded to `[0, 100]` — which would have visually
clipped the exact kind of >100% anomaly just diagnosed instead of showing
it — to auto-extend above 100 with a dashed reference line marking the
100% ceiling. Full detail: `daily-reports/2026-08-25.md`.

**2026-08-25, continued — settled on one font, no separate mono for
numbers**: user found the table numbers confusing; first fix (swap
IBM Plex Mono → JetBrains Mono for better 0/O and 1/l/I disambiguation)
was rejected — user wanted **Sarabun everywhere**, one font total, not a
clearer mono. `app/layout.tsx` now loads only `Sarabun`; `app/globals.css`'s
`--font-mono` token points at `var(--font-sarabun)` so the existing
`font-mono` classNames across the table components still work unchanged.
If table typography comes up again, start from this confirmed
one-font preference, not a data-mono proposal.

**2026-08-25, continued — real cross-filter + variety/supplier dropdowns,
caught a real recharts v3 bug via browser testing**: user pushed back that
the first cross-filter attempt wasn't real (supplier selection only dimmed
bars in one chart, didn't filter the others) and asked for variety
(อาราบิก้า/โรบัสต้า) and Supplier dropdown filters, done with dev+tester
rigor. `computeSummaryDashboard` (`lib/summaryDashboard.ts`) now takes
`{ variety, supplier }` and genuinely filters the underlying rows — every
KPI, the Yield1/Lot1 charts, and the table all derive from one filtered
dataset. Scoped honestly: variety/supplier can only be attributed at
**Preclean** (green coffee in, clean beans out) — Roasting's output onward
blends varieties/lots (e.g. "A80+R20"), so those fields return `null`/
empty with a `filtersActive` flag rather than a misleading zero, and the
UI shows "-" for Roasting/Packing while a filter is active. Green-coffee
variety codes confirmed directly from the raw file: `54002340` = อาราบิก้า,
`54002341` = โรบัสต้า.

Verified for real in a running browser (no project skill for this existed
yet; used `playwright-core` installed standalone into the session
scratchpad, driving the already-running dev server with the real system
Chrome) rather than trusting `npm run build`/`npm run lint` alone — and
that's what caught a real bug neither build nor lint could: this project's
`recharts` (`^3.10.1`) changed its chart-root `onClick` event shape between
v2 and v3 (`activePayload` was removed; replaced by `activeIndex`/
`activeLabel`), so the month-click-to-filter feature silently did nothing
at runtime despite compiling and type-checking cleanly. Fixed by reading
`activeIndex` instead. Full detail, including the exact verification steps
and a curious Playwright gotcha (`.click({force:true})` on an SVG dot
doesn't reliably trigger recharts v3's click handler the way a real
hover-then-click does) in `daily-reports/2026-08-25.md`'s Round 4.

**2026-08-26 — 305's real formulas, replacing the 301-shaped placeholder**:
user asked to check 305's real data and rebuild it as its own sheet/table
(previously it just reused 301's pivot logic verbatim as a stand-in). The
small `ตรวจ MB51_0769.xlsx` reference sample only has 6 simple 305 orders
(one BAG input → one same-size BAG output, always exactly 1:1) — checking
that alone would have led to a naive bag-count-ratio yield formula. Cross-
checked against the fuller, currently-loaded `Roasting Dashboard
Initiative.xlsx` data (31 real orders) before finalizing, and found 305 is
actually structurally identical to 303 (blend input + PC/EA packaging
consumables → bag output), with the added wrinkle that input and output
bag sizes aren't always equal (some orders repack one 500g bag into two
250g bags) — a bag-count ratio would show 200% there. Implemented a real
weight-based Yield/Loss instead (`lib/pivot305.ts`, new
`components/Stage305Table.tsx`, `lib/exportReport305.ts`), reusing
`FG_UNIT_WEIGHT_GRAMS` + the editable `UnitWeightMaster` fallback for
*both* the input and output side (303 only ever needed it for the output,
since 303's input is already KG-denominated). Verified against the live
data: known-weight orders compute correctly (order `305000000020`: 1,903
bags in and out, both confirmed 500g → exactly 100%); orders touching a
material outside the confirmed table (`59000005`, `59000012`, `59000013`)
correctly show "-" rather than a wrong number, and filling in the weight
via the UI's editable input live-recomputes to the right answer (verified
`36 bags × 500g → 72 bags × 250g` comes back as exactly 100%, not the 200%
a naive count ratio would have given). Verified in a running browser
(`playwright-core` in the session scratchpad, real system Chrome, same
method as 2026-08-25) — no new console errors from the 305 tab specifically
(one pre-existing hydration warning in `Stage301Table.tsx`, unrelated,
confirmed present before this session's changes too). `npm run lint` (0
errors, same 1 pre-existing unrelated warning) and `npm run build` clean.
Full detail: `daily-reports/2026-08-26.md`.

**2026-08-26, continued — first real input on the pending defect-log
conversation**: user shared a photo of the actual paper form
(ใบสรุปงานประจำวัน) roasting/packing staff fill by hand today, which is
the first real content toward the on-site production/QA conversation the
303/305 defect-log item has been blocked on since 2026-08-21. Discussion
only — no mockup/prototype started, per the user's explicit instruction.
Confirmed so far: the physical form travels between ห้องคั่ว and ห้องแพ็ค
(both rooms write on the same sheet across one production run, and its
handwritten order refs show one sheet spans both a 302 and a 303 order
number), but only one person keys it into Excel afterward; **Loss% is
confirmed to be a calculated field, not manual entry** (the actual
formula still isn't known — needs the real Excel file, not just the paper
photo). Still open: the Loss% formula itself, whether the equipment/
container fields (ถัง/ราว) belong in this app or are a separate
plant-asset-tracking concern, the exact field→303-vs-305 mapping, and
which of 4 proposed solution directions (1:1 digitize the paper form /
normalize into repeating line-items / split by owner / parallel-run
before cutover) to pursue. Full detail: `daily-reports/2026-08-26.md`
Round 2.

**2026-08-28 — page-bottom grand-total row on all 4 order tabs**: added a
`<tfoot>` "รวมทั้งหมด (N Order)" row to `Stage301/302/303/305Table.tsx`
(shared `tfootCell`/`tfootNum` styles in `reportTableStyles.ts`), summing
each order's Sum-row values column by column; percent/ratio columns left
blank. Since these tables' per-order Sum rows are mass-balance residual
rows, the Quantity/Amount grand total is near-zero by design (a page-wide
mass-balance check) — flagged to the user in case they wanted gross
input/output throughput instead. `npm run lint`/`npm run build` clean.
Full detail: `daily-reports/2026-08-28.md`.

**2026-08-28, Round 3 — Settlement Rule Report popup + export (301 tab)**:
clicking the 301 tab's "Settlement Rule" column header opens a modal
(`components/SettlementRuleModal.tsx`) showing the yearly "Settlement Rule
Report" the accounting team keeps in the source's "Summary สูตร" area —
Robusta / Arabica blocks, each grade's monthly settlement rule % (=
grade's net received qty ÷ variety's total clean output that month × 100,
a composition share that sums to 100 per month column by construction),
`สัดส่วน STD` from `stdMaster`, Average = plain mean of the monthly
figures. Formula reverse-engineered from a user screenshot and verified
cell-by-cell against the live data (±1 on integer rounding). New:
`lib/settlementRuleReport.ts` (`computeSettlementRuleReport`, shared by
popup + export), `lib/exportSettlementRuleReport.ts`,
`app/api/export-settlement-rule/route.ts` (whole upload, no month filter —
it's a yearly cross-tab). Variety per output row is read from the material
code, reusing `lib/summaryDashboard.ts`'s split. Known gap:
`data/std-master.json` only has real %STD for 57000001/57000002 — the
other grades show 0 until accounting enters them. `npm run lint` (0
errors) / `npm run build` clean. Full detail: `daily-reports/2026-08-28.md`
Round 3.

**2026-08-28, Round 4 — "สรุปรายเดือน 301" view (ก้อน A)**: after a
PM+BA design pass (decisions recorded in
`docs/monthly-301-summary-and-std-effective-date-plan.md` §4), built the
first piece: a per-month breakdown of the source's `A88:O99` "Summary
เพิ่มแต่ละสูตร" block, reached via a `[ รายออเดอร์ | สรุปรายเดือน ]`
segmented control inside the 301 tab. Per selected month → Robusta/Arabica
blocks with the full A88:O99 column set (Semi / สัดส่วน / ราคา/Kg / %STD /
ปันใหม่ตาม STD / ราคาหลังปัน / Settlement Rule) + %Yield/%Loss per group +
a mass-balance "ผลต่าง" row. Key formula facts read straight from the
cells: **Settlement Rule = `ROUND(สัดส่วน, 2)` only — does NOT use %STD**
(%STD feeds only ปันใหม่ตาม STD = `|F_สาร| × %STD ÷ 100`); and
`M ÷ ΣM` ≡ `q ÷ Σq_output`, so Round 3's Settlement Rule Report month
cells were already the normalised version. Shows raw numbers (column
totals = %Yield ~99.7, not forced to 100) per decision §4.1(ก). New:
`lib/monthly301Summary.ts` (`computeMonthly301Summary`, shared by view +
export), `lib/exportMonthly301Summary.ts`,
`app/api/export-monthly-301/route.ts` (`?month=` optional; whole upload,
no month filter), `components/Monthly301SummaryView.tsx`. Verified the
July export cell-by-cell against the reference workbook's own computed
`E90:O101` (all Qty/Amount/สัดส่วน/Settlement Rule/%Yield/%Loss tie out
exactly; "ผลต่าง" −753 / 1,453,138.79 = source row 100 — confirms
`ตรวจ MB51_0769.xlsx` holds July data). `npm run lint` (0 errors) /
`npm run build` clean. Still to do (planned): ก้อน B (%STD
effective-dated — the type-breaking change) and ก้อน C (add Yield/Loss
rows to the Settlement Rule Report). Full detail:
`daily-reports/2026-08-28.md` Round 4.

**Round 5, same day — reshaped the monthly summary per user feedback**:
dropped the `[ รายออเดอร์ | สรุปรายเดือน ]` segmented control (too much
clicking). The monthly summary now renders as a **collapsible card
pinned above the per-order 301 table** (toggle open/closed, default
open), showing **every month in the current top month-range filter,
stacked** — no independent month picker. `computeMonthly301Summary` now
runs on `filteredRows` (not the whole upload) so it tracks the
`MonthRangeFilter` automatically; `/api/export-monthly-301` switched from
`?month=` to `?from=&to=`. `npm run lint`/`npm run build` clean. Detail:
`daily-reports/2026-08-28.md` Round 5.

**2026-08-31 — ก้อน B (%STD effective-dated) + ก้อน C (Settlement Rule
Report Yield/Loss rows), closing out
`docs/monthly-301-summary-and-std-effective-date-plan.md`**: user confirmed
Round 1's near-zero grand-total (2026-08-28) is correct as-is, then asked
for both remaining plan chunks in one go. **%STD is now effective-dated
master data**: `StdMaster` (`lib/types.ts`) changed from
`Record<string, number>` to `Record<string, StdEntry[]>`
(`{from: "YYYY-MM", value}`), resolved via new `lib/stdMaster.ts`'s
`stdPercentAsOf`/`latestStdPercent`; `lib/store.ts` auto-migrates old scalar
values to a single sentinel-dated entry (`from = "0000-01"`, sorts before
any real month) on read, so every past month keeps resolving to what it
always did. `lib/pivotOrderReport.ts` resolves each order's %STD against
its **earliest** posting month (handles the rare month-crossing order).
`Stage301Table.tsx`'s %STD column is now read-only; its header opens a new
change-log modal, `components/StdManagerModal.tsx` (list history + add/
delete per material, reusing `SettlementRuleReport`'s already-computed
material list — no new material-scanning logic). **Settlement Rule Report
now officially sources from the monthly summary** (`lib/settlementRuleReport.ts`
calls `computeMonthly301Summary` internally instead of re-deriving its own
normalized ratio) — numbers are now **raw** (`ROUND(qty÷green-input,2)`,
matching source column M) rather than rescaled to sum to 100, the explicit
PM+BA decision; gained %Yield/%Loss rows per variety section (replacing the
old "รวม = 100" row), and its STD column now shows the latest history entry,
labeled "%STD (ล่าสุด)". `npm run lint` (0 errors, same 8 pre-existing
warnings) / `npm run build` clean. Verified functionally (POSTed a new %STD
entry, confirmed May stayed on the old value while June/July picked up the
new one via `/api/export-monthly-301`, then deleted the test entry) and in
a real browser (`playwright-core`, real Chrome) — both new modals open via
their actual buttons and render correctly, no new console errors. Full
detail: `daily-reports/2026-08-31.md`. This closes every chunk (A/B/C) of
the plan doc.

**2026-08-31, continued — defect-log direction lean, still deferred**: user
leans toward building the 303/305 daily defect-log as its **own separate
data-entry function for on-site staff to fill in themselves** (ห้องคั่ว/
ห้องแพ็ค keying it directly), rather than folding it into the existing
per-order report tables — closest to the "split by owner" direction among
the 4 proposed in the 2026-08-26 note above, though not fully decided.
**Explicitly not started** — user asked to hold this until later; still
blocked on the same open items (Loss% formula, ถัง/ราว scope,
303-vs-305 field mapping) pending the real Excel file / on-site
conversation. No code changed.

**2026-08-31, continued — "สรุปรายเดือน 301" repivoted: months as columns,
not stacked blocks**: user found the Round-5-2026-08-28 layout (one full
block stacked per month) grows too tall with many months in range; shared
a reference screenshot with months as side-by-side column groups. Confirmed
scope (keep all 9 existing A88:O99 columns per month, not the reference's
3) and rebuilt `components/Monthly301SummaryView.tsx` as one wide table per
variety — 2-row header (month spans a colSpan of 9, then the 9 sub-columns
repeated), footer rows (รวม/%Yield/%Loss) landing values under the correct
sub-column per month via literal per-column cells. New
`lib/monthly301Summary.ts` `Monthly301Total` — a "รวมทั้งหมด" column built
by feeding the whole filtered range through the same per-month formula as
one period (not a sum of monthly ratios), %STD resolved as of the latest
month in range. Export (`lib/exportMonthly301Summary.ts`) kept its existing
one-block-per-month sheet layout (no vertical-growth problem in a
spreadsheet) but gained a matching "รวมทั้งหมด" block. `npm run lint`/
`npm run build` clean; verified in a real browser that the card stays
compact regardless of month count and the scrolled-right "รวมทั้งหมด"
column's numbers match the whole-period totals. Full detail:
`daily-reports/2026-08-31.md` Round 4.

**2026-08-31, continued — Round 4's pivot merged into one combined table**:
user's reference screenshot showed Robusta and Arabica in a **single**
table (not two), with subtotal rows per variety and one final grand-total
row at the bottom — recognized that bottom row's numbers as exactly this
project's own already-verified `diffQuantity`/`diffAmount` (source A88:O99
row 100, `E100=E93+E99`). Merged the two `VarietyTable`s into one
`CombinedTable` in `Monthly301SummaryView.tsx`: Robusta rows + subtotal,
Arabica rows + subtotal, then one "รวมทั้งหมด (Robusta + Arabica)" row —
replacing the separate diff strip from Round 4 with the same numbers shown
inline where the source actually places them. `npm run lint`/`npm run
build` clean; verified in browser. Full detail:
`daily-reports/2026-08-31.md` Round 6.

**2026-08-31, continued — %Yield/%Loss moved from rows to columns**: user
flagged these should be vertical (columns), matching the reference
screenshot's header (`... Settlement Rule | % Yeild | % Loss`). `SUB_COLS`
in `Monthly301SummaryView.tsx` grew from 9 to 11 — %Yield/%Loss are now
trailing sub-columns repeated per period (blank on material rows, filled
on the "รวม {variety}" row), replacing the two extra horizontal bars from
Round 6. `npm run lint`/`npm run build` clean; verified in browser. Full
detail: `daily-reports/2026-08-31.md` Round 7.

**2026-08-31, continued — subtotal-row gaps filled, whole-range total
period hidden**: "รวม {variety}" row now also shows Quantity/Amount
(mass-balance Σ, near zero) and สัดส่วน (literal Σ, does not land near zero
— green's proportion is stored as +100% not -100%) totals. The extra
"รวมทั้งหมด" period column-group (whole filtered range as one period) is
commented out per user request — not deleted; `summary.total` is still
computed, so it's a one-line restore if wanted back. `npm run lint`/`npm
run build` clean; verified in browser. Full detail:
`daily-reports/2026-08-31.md` Round 8.

**2026-08-31, continued — dropped variety label bars, added a divider,
hid the export's total block too**: removed the "Robusta"/"Arabica" label
`<tr>` at the top of each variety section in
`Monthly301SummaryView.tsx`, replaced with a plain spacer `<tr>` between
the two. Also commented out (not deleted) the "รวมทั้งหมด" whole-range
block in `lib/exportMonthly301Summary.ts` — Round 8 only hid it on-screen,
this extends the same change to the Excel export. `npm run lint`/`npm run
build` clean; verified in browser and by downloading the export. Full
detail: `daily-reports/2026-08-31.md` Round 9.

**2026-08-31, continued — full export review (Rounds 6-9 had all drifted
from the on-screen view)**: user caught that %Yield/%Loss were still wrong
in the Excel export (separate rows, value under Settlement Rule) — turned
out every structural change since Round 6 (merged table, %Yield/%Loss as
columns, Quantity/Amount/สัดส่วน totals, dropped label rows) had only been
applied on-screen, never to `lib/exportMonthly301Summary.ts`. Root cause:
the "รวม {variety}" row's totals were computed inline in
`Monthly301SummaryView.tsx` instead of in `lib/monthly301Summary.ts`, so
view and export each had their own copy to drift. Fixed by moving
`quantityTotal`/`amountTotal`/`proportionTotal` onto `Monthly301Section`
itself (single source of truth, same pattern this project already uses
elsewhere) and rewriting `pushPeriod` in the export to structurally mirror
`CombinedTable`/`VarietySection` exactly — one 13-column header row per
period (added %Yield/%Loss as real columns), no per-variety label rows, a
blank divider between varieties, and the "รวมทั้งหมด (Robusta + Arabica)"
row matching the on-screen label. `npm run lint`/`npm run build` clean;
verified by downloading the July export cell-by-cell (matches both the
screen and the already-verified 2026-08-28 Round 4 source figures) and
re-confirming the on-screen view still renders correctly after the shared-
field refactor. Full detail: `daily-reports/2026-08-31.md` Round 10.

**2026-09-01 — full export audit (all 6 export functions vs the on-screen
views)**: user asked to verify every Excel export matches what the web
shows and fix any that don't. Method: read each export against its table
component + pivot, then generate the real `.xlsx` files from
`data/latest-upload.json` and inspect them cell-by-cell.
`exportMonthly301Summary.ts` and `exportSettlementRuleReport.ts` were
already correct (the 2026-08-31 Round 10 shared-field refactor holds). The
four per-stage exports (`lib/exportReport{,302,303,305}.ts`, the 301/302/
303/305 tabs' Export button) had all drifted:
- **301**: a real bug — the `{order} Sum` row put `totalLoss` in the
  "สัดส่วน" column; also missing `semiQuantity`/`totalStdPercent`/
  `totalReallocatedCost` on the Sum row, wrote `%STD` on every material row
  (view shows it only on `role === "output"`), and had no grand-total
  `<tfoot>` row.
- **302**: Sum row missing `totalInputQuantity`/`totalMixRatio`/
  `totalPricePerKg`; no grand-total row.
- **303**: still had the "น้ำหนัก/หน่วย (g)" column the view removed; no
  grand-total row.
- **305**: worst — still the old 301-placeholder shape: missing `MvT`/`G`/
  `KG` columns (added to the view 2026-08-26), still had "น้ำหนัก/หน่วย
  (g)", Sum row showed Quantity/Amount the view leaves blank, no
  grand-total row.
- **All four**: percentage columns were written as raw 0–1 fractions while
  the view shows `formatPercent` (×100) — added a `pct()` helper matching
  `exportMonthly301Summary.ts`; renamed `Yield`/`Loss` headers to `% Yield`/
  `% Loss`, `Row Labels` → `Order`.
`npm run lint` (0 errors, same 8 warnings) / `npm run build` clean; the
regenerated files were verified cell-by-cell against the view formulas.
One item left for the user: `exportSettlementRuleReport.ts`'s `%STD
(ล่าสุด)` keeps 2 decimals while the popup rounds to integer — not changed
(export arguably more correct). The Dashboard Summary tab has no export.
Full detail: `daily-reports/2026-09-01.md`.

## Project Owners

- `.claude/agents/coffee-cost-report-ba.md` (BA).
- `.claude/agents/coffee-cost-report-uxui.md` (UX-UI — instantiated
  2026-09-01 at the user's request, once phase 2 began. Standing work: the
  303/305 on-site daily defect-log data-entry function, data-coverage/
  freshness visibility for the DB-connected version, and a usability pass
  over the existing report/dashboard. Visual design system is settled —
  not in scope.).
- `.claude/agents/coffee-cost-report-devops.md` (DevOps — instantiated
  2026-09-01 for phase 2. Owns hosting/runtime off local-dev, read
  connectivity to the DBA MB51 database, secrets, the master-data DB tables
  + migration discipline, the scheduled data-refresh mechanism, and CI.
  Nothing provisioned yet — waits on Dev starting the DB read path.).
- Dev not yet instantiated — PMO has been building this project directly;
  stand it up when the phase-2 `lib/store.ts` rewrite work is dispatched.

## Phase 2 — DB-connected data source (decided 2026-09-01)

Confirmed with the user, replacing the file-upload ingestion described
throughout the status notes above:

- **Connect the app directly to the DBA's database** that already holds the
  SAP MB51 data (RPA-fed, plant 0328). Drop in-app file upload entirely.
- The RPA keeps only ~6 months rolling; **the user will backfill older data
  into the DB directly** and the retention target is **1 year**. So the app
  is a read-only consumer — **no in-app month-by-month accumulation, no
  in-app history store** (an earlier plan, dropped once the user took
  ownership of DB backfill).
- Dev work: DB access/secret layer; rewrite the [`lib/store.ts`](lib/store.ts)
  read path to map the DBA column names (`MB51_MATERIAL_CODE`, `MB51_ORDER`,
  `MB51_POSTING_DATE`, `MB51_LOCATION`, `MB51_MVT`, `MB51_BATCH`,
  `MB51_QUANTITY`, `MB51_AMOUNT`, `MB51_DESCRIPTION`, a unit column) →
  `RawMovementRow`; treat the literal string `NULL` as empty; move the two
  master-data files (%STD, unit-weight) into DB tables; scheduled read +
  cache (RPA updates daily); reconcile one overlapping month against the
  already-verified reference figures; deploy off local-dev.
- Estimate: ~1.5–2 weeks for one dev, plus a hosting/datastore decision
  (currently local-dev only) and DevOps to provision it.
- Still to confirm with DBA: read credentials; which unit column equals the
  old Excel "EUn" (must distinguish KG / BAG / PC for 303/305 yield — the
  sample export showed BAG/BOX/PC but no KG); and that the RPA's
  delete-then-reload of its 6-month window will not wipe the user's
  backfilled historical rows.
- Reference: DBA sample export analyzed at
  `../Reference-File/mb51_plant0328.csv` (4,398 rows, Mar–Aug 2026, all 4
  stage prefixes present, process-order numbers in `MB51_ORDER`).

## Daily reports

Once this project spans more than one session, follow the workspace
convention: `daily-reports/YYYY-MM-DD.md` per session, read the latest one
first when resuming. First report: `daily-reports/2026-08-21.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
