# Source File Analysis — Roasting Dashboard Initiative.xlsx

Source: `../Reference-File/Roasting Dashboard Initiative.xlsx` (read-only
reference). Analyzed 2026-08-21 by BA, reading every sheet's actual cell
formulas via `xlsx` (SheetJS) — not summarized from sheet names or values
alone — plus the workbook's embedded images and its external-link cache
(see below). This is a **second, separate** reference workbook from the
one already mapped in [`source-analysis.md`](source-analysis.md)
(`ตรวจ MB51_0769.xlsx`) — the two are not the same file and cover
different months (this one: Jan–Jul 2026; the original: July 2026 only).

## Sheet inventory

| Sheet | Rows×Cols | Role |
|---|---|---|
| `สรุป` | 98×18 | Monthly summary/yield rollup, three production stages, with a hand-entered ("โรงงาน") block and a pivot-cross-checked ("บัญชี") block per stage |
| `เงื่อนไข` | 64×10 | Static reference/config data — material-code lists and SLoc/movement-type filters that define "what counts as input vs. output" per stage. **No formulas at all** — every cell is a literal value. |
| `MB51 M. 1-7` | 6226×34 | Raw data — SAP MB51 export, months 1–7 (Jan–Jul) 2026, plant 0328 |
| `Dash` | 26×21 | A flattened, one-row-per-month restatement of `สรุป`'s three stage blocks side by side, for charting/dashboard consumption |

The workbook also carries an **external link** (`xl/externalLinks/externalLink1.xml`)
to a SharePoint file, decoded from its (garbled/mojibake) filename as
approximately `yield ห้องคั่ว + pack Update 18.8.2026.xlsx` — several
`สรุป` and `Dash` formulas (the "Diff" check columns, and the Preclean
grade-split columns K–Q on `สรุป`) pull from cached values of that
external file's own `PV ...` pivot-table sheets. Every "Diff" cross-check
in both `สรุป` and `Dash` evaluates to (numerically) zero, so the two
files agree — the external link is a **self-consistency check**, not a
source of new numbers we're otherwise missing, **except** for one part
(see เงื่อนไข/สรุป section below): the Preclean grade-split (A vs.
"Lot#1"/B) columns have no formula in this workbook at all — their
values are only the external file's cached pivot output.

## A. `MB51 M. 1-7` — raw data

**Header row (34 columns, A→AH)**:

```
Material, Material description, Plnt, MvT, Movement Type Text, Mat. Doc.,
SLoc, Batch, Order, Time, User Name, Item, Suppl.Inv, Reas., S,
Reserv.no., Document Header Text, Text, Cost Ctr, G/L acct, PO, Vendor,
Asset, Reference, Manuf. Dte, EUn, Quantity in UnE, Amt.in Loc.Cur.,
Doc. Date, Pstng Date, Code, Order1, Entry Date, Quantity
```

**Schema match against `lib/parse.ts`'s `REQUIRED_COLUMNS`**: all 7
required columns are present with **exactly** the same names as the old
`MB51 328` sheet — `Material`, `Material description`, `Order`, `EUn`,
`Quantity in UnE`, `Amt.in Loc.Cur.`, `Pstng Date`. No renamed or missing
required columns. The only structural differences are in the *non*-required
columns:
- Two helper formula columns near the end, `Code` (`=LEFT(A2,2)`, material
  code prefix) and `Order1` (`=LEFT(I2,3)`, order-type prefix) — same
  mechanic as the old workbook's "Group order"/"Code" helper columns, just
  fewer of them (no GL-name lookup, no price-per-unit helper, no
  Order→semi-product-name lookup this time). None of these helper columns
  are read by `lib/parse.ts` anyway — it derives the order prefix itself
  in code — so this doesn't affect parsing.
- The old sheet's `SLED/BBD` column is absent here; not a required column,
  no impact.

**Date range** (from actually scanning every `Pstng Date` cell, not
assumed from the sheet name): **2026-01-02 to 2026-07-31** — confirms
"M. 1-7" = months 1 through 7 of 2026, exactly as named, no surprises.

**Order-prefix distribution** (first 3 digits of `Order`, 6225 data rows):
`301` = 485 rows, `302` = 755, `303` = 960, `305` = 143, blank/no-order =
3882 (non-production movements, correctly skipped by `parse.ts`'s
"rows with no production order are out of scope" filter — same behavior
as the original file). **305 data is present** in the raw rows even
though neither `เงื่อนไข` nor `สรุป` in this workbook ever reference it —
this workbook's own analysis scope is 301/302/303 only (see below), but
the raw export itself doesn't exclude 305, so uploading it would still
populate the app's existing 305 tab (still on its placeholder formulas).

### What "อัพเดตข้อมูลทั้งหมด" (update all the data) concretely requires

**This is a schema/config change to the app, not just a re-upload —
but a small one.** `lib/parse.ts` hardcodes:

```ts
const SOURCE_SHEET_NAME = "MB51 328";
...
const sheetName = workbook.SheetNames.includes(SOURCE_SHEET_NAME) ? SOURCE_SHEET_NAME : workbook.SheetNames[0];
```

This workbook's raw sheet is named `MB51 M. 1-7`, not `MB51 328`, and it
is **not** the first sheet in the file (`สรุป` is first, `เงื่อนไข` second,
`MB51 M. 1-7` third). So today, uploading this file as-is would make
`parse.ts` fall back to `workbook.SheetNames[0]` = `สรุป`, which has none
of the 7 required columns, and the upload would fail with the "ไม่พบ
คอลัมน์" error — **not** silently ingest the wrong sheet, but it would
reject a file whose actual data is perfectly compatible. Once the sheet
name is either (a) recognized directly (e.g. accept `MB51 M. 1-7` as a
second known name, or generalize the match to "any sheet name starting
with `MB51`") or (b) the user renames the sheet to `MB51 328` before
uploading as a no-code-change workaround, the existing upload flow needs
no further change — every column the parser reads matches exactly.

## B. `เงื่อนไข` — conditions

Contrary to the name ("conditions"), **this sheet contains zero formulas**
— it is a hand-maintained reference/lookup table, not computed logic. It
defines, for two of the three production stages, exactly which material
codes and which SAP movement filters count as "input" vs. "output" for
that stage — i.e., it's the classification rule that the app currently
has to *infer* (by quantity sign, or "the input whose unit is KG") stated
explicitly instead. Three blocks:

**Block 1 — "Yield Rosting+Pack" (rows 1–23)**, combined Roasting+Packing
view:
- Room "Roasting" (`Order` = `302`): input material codes = `Code 57`,
  `SLoc = P002`, `Mvt = 261, 262` — the specific clean-bean grade codes
  are listed (`57000000` Arabica S&M, `57000001` Clean Arabica L,
  `57000002` Clean Arabica B, `57000003` Clean Robusta mix, `57000004`
  Clean Robusta B).
- Room "Packing" (`Order` = `303`): output material codes = `Code 59`
  (finished-good bag codes, `59000001`–`59100000`, 15 distinct FG
  materials listed with Thai descriptions), `SLoc = M001`, `Mvt = 101, 102`.
- A note, `หา KG`: `(จำนวน BAG * ปริมาณ /1000)` — "bag count × [weight] ÷
  1000". **The weight value itself is not given anywhere in this
  workbook** — same open gap already flagged in `source-analysis.md` for
  the original file's hardcoded `*500`. One of the embedded screenshot
  images (see below) confirms this isn't a hypothetical concern: real
  production data in this file has **both 500g and 250g bag materials**
  bucketed separately ("500 BAG" / "250 BAG" rows), so a single hardcoded
  weight constant would be wrong for part of the FG list even within one
  month.

**Block 2 — "Yield Rosting" (rows 26–39)**, Roasting stage alone
(`Order = 302`): input = `Code 57` clean-bean grades at `SLoc P002`,
`Mvt 261, 262` (same list as block 1); output = `Code 57` **roasted
blend** codes at `SLoc P003`, `Mvt 101, 102` — a *different* set of
material codes (`57000100` A80+R20, `57000101` A100, `57000102` A40+R60,
`57000103` calibrate A80+R20, `57000104` มวลชน Extreme A50+R50,
`57000105` R100, `57000106` มวลชน Gold Blend A80+R20). Confirms: 302's
input and output share the same 2-digit material-code prefix (`57`) but
are disjoint 8-digit code ranges — `...000-004` = clean beans in,
`...100-106` = roasted blends out.

**Block 3 — "Yield Packing" (rows 42–64)**, Packing stage alone
(`Order = 303`): input = the same roasted-blend codes from block 2
(`57000100`–`106`) at `SLoc P003`, `Mvt 101, 102`; output = the same FG
code list from block 1 (`Code 59`) at `SLoc M001`, `Mvt 101, 102`.

**No 301 (Preclean) block exists in `เงื่อนไข` at all.** This workbook's
own explicit scope, per this sheet, is **Roasting (302) + Packing (303)
only** — matching the workbook's title, "Roasting Dashboard Initiative."
`สรุป`'s Preclean rows (below) exist as upstream context, but their
input/output material-code rule is stated directly in `สรุป`'s own row
labels (see next section), not sourced from `เงื่อนไข`.

**How this feeds `สรุป`**: `เงื่อนไข` is not formula-linked to `สรุป` at
all (no cell in `สรุป` references `เงื่อนไข`) — it's documentation of the
filter rule a human (or the external pivot tables) applied when building
`สรุป`'s numbers, not a live input. The two sheets agree in content
(material codes, SLoc, Mvt) but are not mechanically connected within
this file.

## C. `สรุป` (summary) and `Dash`

### `สรุป` — five stacked monthly blocks, months as rows

All months Aug–Dec are present as blank rows (formulas exist but all
inputs are empty, several evaluate to a literal `7` — Excel's div/0
guard rendering as an error code that this workbook apparently never
corrected, e.g. `F30=E30/D30` with both empty → `7`, not `#DIV/0!` as
such but the same "not real data" signal). **Only Jan–Jul are populated.**

1. **"ห้อง Roasting + Packing" — โรงงาน (factory) view (rows 1–17)**:
   per month, `A (kg.)` + `R (kg.)` (Arabica/Robusta clean-bean input to
   Roasting) → `RM รวม` (`=SUM`) → `FG` (Packing's finished output) →
   `Yield` (`=FG/RM รวม`) → `Loss` (`=100%-Yield`). Row 17 = column sums
   across all 12 month-rows. This is the **combined Roasting+Packing
   yield** — input clean beans in, output finished bags out, skipping
   over the intermediate roasted-blend step.

2. **"บัญชี" (accounting) view (rows 19–36)**: same shape and same
   numbers as block 1, but `E` (FG) for some months is itself a formula
   pulling from the external linked file's `PV ห้อง Packing` pivot
   sheet, and column `H` is a **cross-check**: `=-D-GETPIVOTDATA(...)`
   against the external file's own Roasting pivot, evaluating to 0 for
   every populated month. Row 36 `Diff` = row17 − row35 (factory view
   minus accounting view) = 0 across every column. **Conclusion: this
   block exists purely to prove the "โรงงาน" hand-rolled numbers agree
   with the pivot-table-derived numbers** — it is not a second data
   source, and the app doesn't need to reproduce this reconciliation
   step (there's nothing to reconcile once the numbers come from one
   MB51 parse instead of two independently-typed sheets).

3. **"Preclean Order 301" (rows 39–54)**: `Code 54, Mvt 261 262, SLoc
   P001` (green coffee, input) → `Code 57, Mvt 101 102, SLoc P002`
   (clean beans, output) → `Yield`/`Loss`. This is the **input/output
   material-code rule for 301**, stated here directly since `เงื่อนไข`
   doesn't cover it. **Columns K–Q** (`A`, `A Lot#1`, `R`, `R Lot#1`,
   `A+R`, `A+R Lot#1`, `%A+R`) are a grade split (main grade vs. a
   "Lot#1" sub-grade) — **every one of these formulas
   (`='[1]PV 57 Preclean '!C14` etc.) pulls from the external file's
   cached pivot table, with no formula anywhere in this workbook (or
   any visible rule) showing *how* that pivot classifies a row into "A"
   vs. "Lot#1."** Comparing against `เงื่อนไข`'s block-1 material list
   (`57000002` "Clean Arabica **B**", `57000004` "Clean Robusta **B**"
   are the only "B"-suffixed codes among the 301-output material list
   also referenced in that block), material code is a *plausible*
   classifier for Lot#1 = the "B"-grade materials — but this is an
   inference from adjacent context, not a confirmed rule, since the
   actual classification lives only in the external pivot's cache. Not
   safe to implement as a guess.

4. **"Roasting Order 302" (rows 56–70)**: `Code 57, Mvt 261 262, SLoc
   P002` (clean beans in) → `Code 57, Mvt 101 102, SLoc P003` (roasted
   blend out) → `Yield`/`Loss` — matches `เงื่อนไข` block 2 exactly.
   Input columns `B`/`C` are literal references to block 2's own `B23`/
   `C23` cells (`=B23`), so Roasting's input in this block is the same
   number as the factory-view block's input, just re-shown.

5. **"Packing Order 303" (rows 73–90)**: `Code 57` (input, = Roasting's
   output) → `Code 59, Mvt 101 102, SLoc M001` (FG out) →
   `Yield`/`Loss`, matching `เงื่อนไข` block 3. An extra column `G`,
   **"Yield ตามที่โรงงานปรึกษาคุณวิโชติ"** ("yield per consultation with
   Khun Wichot") = `FG ÷ Preclean's RM total (D42)` — a third yield
   metric spanning **all three stages** (green coffee in → finished bag
   out), attributed by name to a specific person's methodology rather
   than derived independently. January's value: 158,910 ÷ 216,376.5 =
   73.4%.

6. **Rows 94–98**: a single one-off worked example (January only, not
   repeated per month) breaking Preclean's output into "เกรดรวม" (total
   grade, `=201,893.84`) and "เกรดB" (`=13,342.4`), summing to the
   group's Semi output — same "A vs. B/Lot1" split as block 3's K–Q
   columns, same caveat about not knowing the real classification rule.

### `Dash`

**Decision: relevant, and used below as the layout reference for the new
Summary Dashboard page — it is the same `สรุป` data restated in the shape
a dashboard would actually want it in.** Reasoning: the user's request
named only `เงื่อนไข` and `สรุป`, but `Dash` sits in the same workbook,
computes nothing new (every value either matches or is directly checked
against `สรุป`'s cells), and is structurally exactly "one row per month,
one column-group per stage" — which is a far more dashboard-appropriate
shape than `สรุป`'s five stacked month-block tables. Checked whether it
was instead a chart/image-only sheet before deciding: it is not — no
embedded Excel chart objects exist anywhere in this workbook (`xl/charts`
is absent from the file); the "Dash" sheet has one attached image
(`image4.png`, a formatted-table screenshot of its own data, not a chart)
plus the live cell table. So "Dash" means *dashboard-shaped table*, not
*chart*, in this workbook.

Structure (one row per month, `T2` = grand total row 15):
- **Preclean** (`B`–`H`): Input, Diff (vs. `สรุป` D42), Yield1 (A-grade
  output), Lot1 (B-grade output), Tall (`=SUM(Yield1,Lot1)`), Diff,
  %Yield1.
- **Roasting** (`J`–`O`): Input RM, Diff, Output Roasting, Diff, %Yield2.
- **Packing** (`P`–`S`): FG, Diff, %Yield3.
- **`T` — "%Yield ต้น-ปลาย"** (start-to-end): `FG total (P15) ÷ Roasting
  input total (J15)` = −80.4% for the 7 populated months — this is the
  **same combined Roasting+Packing yield metric as `สรุป` block 1/2**,
  just computed from `Dash`'s own row-15 column sums instead. It does
  **not** span all the way back to Preclean (that's `สรุป`'s separate
  "Khun Wichot" metric, not reproduced in `Dash`).
- Rows 19–26: a small secondary block converting the grand totals to
  tons and re-deriving the same combined %Yield (`P21 = -80.4%`,
  matching `T15`) — a display-format variant, not new data.

Every `Diff` column across the sheet evaluates to ~0 (floating-point
noise at most, e.g. `9.9e-10`), confirming `Dash`'s numbers and `สรุป`'s
numbers are the same dataset viewed two ways.

### Embedded images (checked, not additional info)

The workbook has 4 embedded PNGs (on `สรุป` and `เงื่อนไข`, not `Dash`
itself in the way expected — actually one is on `Dash`'s sheet1 mapping,
see below) — all are **static screenshots of these same tables at an
earlier point** (Jan–Apr only, vs. the live formulas' Jan–Jul), used here
only to sanity-check formula intent, not as a source of new requirements
or a chart-design reference:
- Two on `สรุป`: a wide Preclean→Roasting→Packing combined table, and a
  narrower Roasting+Packing-only table — both match the block shapes
  above.
- One on `เงื่อนไข`: a screenshot of the actual SAP pivot used to compute
  FG kg from bag counts, which is what confirmed the 500g/250g
  multi-weight finding above.
- One on `Dash`: a screenshot of `Dash`'s own Roasting+Packing block for
  three months — confirms `Dash`'s live cell data (already captured
  above) rather than adding anything new.

## Business meaning (extends the existing flow, same as `source-analysis.md`)

```
Green coffee (Code 54, SLoc P001) --[301 Preclean]--> Clean beans by grade (Code 57 x00-x04, SLoc P002)
Clean beans (Code 57 x00-x04)     --[302 Roasting]--> Roasted blend (Code 57 x100-x106, SLoc P003)
Roasted blend (Code 57 x100-x106) --[303 Packing]---> Finished bags (Code 59, SLoc M001)
```

Same 3 of the 4 stages already implemented in the app (301/302/303); this
workbook adds no new stage and doesn't reference 305 at all in its
analysis sheets (only in the raw export, incidentally).

## Proposal: what the new Summary Dashboard page should show

Scoped strictly to what's confirmed above — no invented metrics:

1. **A month-by-month table, one row per month present in the uploaded
   data** (mirroring `Dash`'s shape, which is the most dashboard-ready
   layout found), with three column groups:
   - **Preclean**: input (green coffee, kg), output (clean beans, kg),
     %Yield. *(Grade-split "A vs. Lot1" columns excluded — no confirmed
     classification rule, see open question 1 below.)*
   - **Roasting**: input (clean beans, kg), output (roasted blend, kg),
     %Yield.
   - **Packing**: input (roasted blend, kg — same figure as Roasting's
     output), output (FG, kg — via bag-count × grams/bag ÷ 1000, same
     unresolved per-material weight master already flagged in
     `source-analysis.md`), %Yield.
   - **Combined %Yield (Roasting+Packing)**: FG ÷ Roasting input — this
     is the workbook's own headline KPI (`สรุป` block 1, `Dash` column
     `T`), so it should be the dashboard's most prominent number, not
     buried as one more column.
   - A totals/grand-total row, same as `สรุป` row 17 and `Dash` row 15.
2. **Data source**: the same uploaded-MB51-batch used by the existing
   301/302/303/305 tabs — the input/output classification per stage
   should use `เงื่อนไข`'s explicit `SLoc` + `Mvt` + material-code-range
   rule (confirmed above) rather than the current app's inference-based
   role tagging (quantity sign / "input whose unit is KG"), since this
   file makes the real rule explicit for 302/303 (301's rule is stated in
   `สรุป`'s row labels, not `เงื่อนไข`, but is equally explicit). This is
   a refinement worth flagging to Dev, not something this BA pass is
   deciding — implementation is out of scope for this doc.
3. **Not proposed**: the "Khun-Wichot-methodology" 3-stage combined
   yield, the accounting-vs-factory reconciliation block, and the
   Preclean grade-split — all three depend on either a named person's
   undocumented method or the external file's un-derivable pivot
   classification. Reproducing them without the real rule would mean
   guessing a business rule, which this department doesn't do.

## Implementation (2026-08-21, same day, by PMO)

Built directly following this analysis and the user's confirmed answers
(sheet detection: generalize to any name starting with "MB51"; dashboard
scope: include Preclean; grade split: pure material code, per the two
codes above; external SharePoint file: not needed).

**`lib/parse.ts`**: sheet-name matching generalized from the hardcoded
`"MB51 328"` to "first sheet whose name starts with MB51" — both this
file's `MB51 M. 1-7` and the original `MB51 328` now upload correctly.
`RawMovementRow` gained two new fields, `sLoc` and `mvt` (from MB51's
`SLoc`/`MvT` columns) — needed for the dashboard's classification below.

**`lib/summaryDashboard.ts`** (new): computes the new Summary Dashboard
tab. Critically, this does **not** reuse the sign-based input/output
inference the 301/302/303 tabs use (net quantity negative/positive) —
that was tried first and came out 10–34% off against this workbook's own
cached `Dash` numbers, because it pulls in other postings on the same
order that aren't part of the actual material flow. Switched to the
precise rule `เงื่อนไข` itself defines — SLoc + movement type (MvT) +
material code — and verified every one of the 7 months' Preclean,
Roasting, and Packing input/output figures against `Dash`'s cached values
until they matched **exactly** (to the cent). The classification table:

| Stage    | Direction | SLoc | MvT     | Material             |
|----------|-----------|------|---------|-----------------------|
| Preclean | input     | P001 | 261/262 | starts with "54"      |
| Preclean | output    | P002 | 101/102 | clean-bean codes (57000000–04) |
| Roasting | input     | P002 | 261/262 | clean-bean codes |
| Roasting | output    | P003 | 101/102 | roasted-blend codes (57000100–06) |
| Packing  | input     | P003 | 261/262 | roasted-blend codes |
| Packing  | output    | M001 | 101/102 | FG codes (59000001–59100000) |

**A third source-file bug, found during this verification**: `เงื่อนไข`'s
own "Yield Packing" block (rows 41–54) states Packing's input side uses
MvT "101 102" — but that's copy-pasted from the block above it (Roasting's
*output* row), and using it literally makes Packing's input compute to 0
for every month (no rows match). The real data uses "261 262" (goods
issue), consistent with every other input side in the workbook. Confirmed
by matching `Dash`'s cached Packing-input value only once corrected — not
reproduced in the app, same policy as the two formula bugs already found
in the original `ตรวจ MB51_0769.xlsx` file (see `source-analysis.md`).

**A real bug caught during implementation, not in the source file**: an
early version of `summaryDashboard.ts` summed `Math.abs(quantity)` per row
for every input-side movement, including MvT 262/reversal rows — but 262
is a reversal of a 261 issue (opposite sign), so summing its absolute
value instead of netting it double-counted every reversed row (30–50%
overcounts). Fixed by netting signed quantities first and taking the
absolute value once at the end, matching how the 301/302/303 tabs already
handle same-order reversals.

**Verification result**: all 7 months (Jan–Jul 2026) match `Dash`'s cached
Input/Output figures for Preclean, Roasting, and Packing exactly, for
every stage except the FG→kg conversion, which needs real per-material
gram weights (`UnitWeightMaster`, same editable field the 303 tab already
uses) — still empty in this session, so the dashboard's Packing-output and
combined-yield numbers will read low/wrong until accounting fills those in
(same open item as `source-analysis.md`'s existing unit-weight gap, now
directly affecting the dashboard too, not just the 303 tab).

**UI**: `components/SummaryDashboardTable.tsx`, added as a new
"แดชบอร์ดสรุป" tab in `ReportView.tsx` (first tab, before 301/302/303/305).
Columns mirror `Dash` exactly — Preclean's `yield` is grade-A output ÷
input only (matching `Dash`'s own `%Yield 1` formula), not total output;
no `%Loss` columns anywhere, since `Dash` doesn't have them and Preclean's
grade split isn't a loss (Lot#1 is still sellable coffee, just a lower
grade).

## Open questions — resolved same day (2026-08-21) by the user

1. **Preclean's "A" vs. "Lot#1" (B-grade) split** — **resolved: pure
   material code** (the guess above was confirmed correct). Implemented
   in `lib/summaryDashboard.ts`'s `LOT1_MATERIAL_CODES`.
2. **Grams-per-bag for FG output materials** — still open, unchanged; see
   `source-analysis.md`'s unit-weight master data item. Now also affects
   the new dashboard's Packing-output and combined-yield figures, not just
   the 303 tab.
3. **The external SharePoint link** — **resolved: not needed**, this
   workbook is sufficient as the reference.
4. **Should the Summary Dashboard include Preclean** — **resolved: yes**,
   implemented as proposed above.
4. **Should the Summary Dashboard include 301 (Preclean)** even though
   this workbook's own `เงื่อนไข` sheet scopes itself to Roasting+Packing
   only, while `สรุป`/`Dash` do include Preclean as context? Proposal
   above includes it (since `สรุป`/`Dash` both do, and 301 is already a
   fully-implemented app tab) — flagging in case the user actually wants
   a narrower Roasting+Packing-only dashboard matching `เงื่อนไข`'s literal
   scope and the workbook's title.
