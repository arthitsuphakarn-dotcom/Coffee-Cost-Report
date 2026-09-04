# Source File Analysis — ตรวจ MB51_0769.xlsx

Source: `Reference-File/ตรวจ MB51_0769.xlsx` (read-only reference, not to be
edited). Analyzed 2026-08-21 by reading every sheet with openpyxl
(formulas, not just values) since this workbook **is** the current manual
process the website needs to replace/support.

## Sheet inventory

| Sheet | Rows×Cols | Role |
|---|---|---|
| `MB51 328` | 938×41 | **Raw data.** Direct-ish export of SAP MB51 (material document list) for plant 0328, one row per material movement line. |
| `301` | 145×23 | Pivoted cost/loss report for Order prefix **301 = ห้อง Preclean** (green bean cleaning/grading) |
| `302` | 165×15 | Pivoted report for Order prefix **302 = ห้อง Roasting** |
| `303 ` (trailing space in name) | 221×43 | Pivoted report for Order prefix **303 = ห้อง Packaging** |
| `305` | 59×41 | Pivoted report for Order prefix **305** (retail-bag packing line, "CPR") |
| `Order 301-305 (เรียง)` | 86×6 | Lookup table: Order number → Semi-product name / room. Used by `VLOOKUP` from `MB51 328`. |
| `Order 301-305` | 32×12 | A second, differently-shaped pivot over the same 301-305 orders (appears to be a scratch/check pivot, not consumed by formulas elsewhere). |
| `301-305` | 418×7 | A combined raw pivot (all 4 order types stacked, fewer computed columns) — likely an intermediate/staging pivot. |
| `GL Name` | 14×3 | Lookup table: G/L account → account name (Thai) → plant code. Used by `VLOOKUP` from `MB51 328`. |
| `เกณฑ์กำลังการผลิต` | 7×7 | Production-capacity reference constants (kg/hour, kg/day, kg/month, kg/year) for one machine type (BOI card basis). Not obviously wired into any formula seen — likely a manual reference used when setting STD % by hand. |
| `สรุป` | 19×11 | Summary rollup sheet, but **contains `#REF!` errors** — broken formulas pointing at a deleted sheet/range. Not usable as-is. |
| `PVcode54#301`, `Remake` | small | Small scratch sheets, low row count, no formulas of consequence found. |

## Raw data: `MB51 328`

Row 1 headers (A→AN), standard SAP MB51 field export plus 5 extra
formula-driven helper columns appended at the end:

`Material, Material description, Plnt, MvT, Movement Type Text, Mat. Doc.,
SLoc, Batch, Order, Time, User Name, Item, Suppl.Inv, Reas., S, Reserv.no.,
Document Header Text, Text, Cost Ctr, G/L acct, PO, Vendor, Asset,
Reference, Manuf. Dte, EUn, Quantity in UnE, Amt.in Loc.Cur., Doc. Date,
Pstng Date, SLED/BBD, Entry Date, Quantity`

Appended helper columns (AH→AN), one formula per row, filled down:

| Col | Name | Formula (row 2 example) | Purpose |
|---|---|---|---|
| AH | Group order | `=LEFT(I2,3)` | First 3 digits of Order → routes the row to the matching order-type sheet (301/302/303/305) |
| AI | Code | `=LEFT(A2,2)` | First 2 digits of Material code |
| AJ | GL Name | `=VLOOKUP(T2,'GL Name'!A:B,2,0)` | G/L account name |
| AK | หมายเหตุ | (blank, manual) | Free-text note, manually filled in per row when needed |
| AL | ราคา | `=AB2/AA2` | Amount ÷ Quantity = unit price for that line |
| AM | Code สูตรผลิต | `=VLOOKUP(I2,'Order 301-305 (เรียง)'!A:B,2,0)` | Order → Semi-product name |
| AN | สูตรผลิต | `=VLOOKUP(I2,'Order 301-305 (เรียง)'!A:C,3,0)` | Order → room (Preclean/Roasting/etc.) |

**Key mechanic confirmed:** "แยกตาม Order ถ้าขึ้นต้นด้วย 301 จะแยกเป็น sheet
301" = filter `MB51 328` rows where `LEFT(Order,3) = '301'` (etc.) into
each order-type sheet, then pivot.

## Per-order-type report sheets — NOT one uniform template

This is the most important finding: **each order-type sheet has its own
column layout and formula logic**, tailored to that production stage. The
11-column pattern described in the request (`Semi, สัดส่วน, ราคา/Kg., %,
ปันใหม่ตาม STD, ราคาหลังปัน, Settlement Rule, %Yield, %Loss, สถานะ, Por
Ver`) matches **sheet `301` only**. The other three sheets differ:

### 301 — Preclean (matches the described pattern exactly)

Structure: pivot grouped by `Group order` (the SAP production order number,
e.g. `301000000204`). Each group is 3+ rows:
- **Header row** (bold row, order number in col A): the raw green-coffee
  input material (negative qty = issued), e.g. `54002340 สารกาแฟอาราบิก้า`
- **Detail rows** (one per output grade): the clean/graded output
  materials received (positive qty), e.g. `57000001 เมล็ดกาแฟ Clean
  Arabica Size L`, `57000002 ...Clean Arabica B`
- **Sum row** (`"<order> Sum"` in col A): totals/checks for the group

Column formulas (referencing the header row = `h`, first detail row =
`d1`, sum row = `s`):

| Col | Header | Formula (on detail rows) | Meaning |
|---|---|---|---|
| G | Semi | `=E{d1}+E{d2}+...` (header row only) | Total output qty for the group |
| H | สัดส่วน | `=E{row}/$E${h}` | This output's qty ÷ input qty (yield ratio, negative since input is negative) |
| I | ราคา/Kg. | `=F{row}/E{row}` | Amount ÷ qty = cost per kg for this line |
| J | % | **manual input** (e.g. `80`, `3`, `95`) | STD (standard/target) yield % per output grade — hand-entered per material, not derived from MB51 |
| K | ปันใหม่ตาม STD | `=-F{h}*J{row}/J{sum}` | Reallocates the input cost across outputs in proportion to STD % (cost allocation, not actual-yield-based) |
| L | ราคาหลังปัน | `=K{row}/E{row}` | Reallocated cost ÷ qty = cost/kg after STD reallocation |
| M | Settlement Rule | `=ROUND(H{row},2)` | Rounded actual-yield ratio (this is what SAP settlement rule % should be set to) |
| N | % Yield | `=SUM(H{detail rows})` (sum row only) | Total actual yield % for the order |
| O | % Loss | `=-100%-N{sum}` (sum row only) | Loss % = shortfall from 100% |
| P | สถานะ | text, e.g. `"Adj Settlement Rule Done"` | Manual/free-text status flag per order |
| Q | Por Ver | `101` (header row), manual | A version/type code, manually entered |

So for 301: **only column J (STD %) and the sum row's status text (col P)
are manual inputs** — everything else is formula-derivable from `MB51
328` + the STD % table. This sheet is the closest thing to a
"just pivot it" report.

### 302 — Roasting (different shape, now implemented for real)

Columns: `Semi(ใส่สาร), สัดส่วนผสม, สัดส่วน, (blank), ราคาต่อหน่วย, Yield,
Loss, สูตร FG, Por Ver`. Verified formula-by-formula 2026-08-21 (row
references are order `302000000311`: header row 4, group rows 4-7, sum
row 8):

| Col | Header | Formula | Meaning |
|---|---|---|---|
| G | ใส่สาร | `=SUM(E4:E6)` (header row only) | Sum of just the **input** rows (clean-bean grades consumed) — 302 orders commonly blend 2-4 grades, unlike 301's single input |
| H | สัดส่วนผสม | `=E{row}/G{header}` (input rows) | Each input grade's share of the total blend recipe |
| I | สัดส่วน | `=E{row}/E{output row}` (all rows) | Row's qty as a share of total roasted output — for input rows this reads as "kg of this grade per kg of finished roast" |
| K | ราคาต่อหน่วย | `=F{row}/E{row}` (all rows) | Amount ÷ qty, same pattern as everywhere else |
| L | Yield | `=E{output}/G{header}` (sum row only) | Output qty ÷ total input qty |
| M | Loss | `=100%+L{sum}` (sum row only) | Loss = shortfall from 100% |
| N | สูตร FG | `='303 '!AM{n}` (sum row only) | **Not a calculation** — pulls the finished-good material's *description text* from a specific row in sheet `303 ` (confirmed by checking `303 `'s `AM` column: it's `=C{output row}`, i.e. just the FG name). Not implemented: no reliable Order→Order mapping between 302 and 303 exists in MB51 — the source's mapping is a hardcoded row reference, which would mean guessing which 303 order corresponds to which 302 order. |
| O | Por Ver | manual, varies (301/401/201...) | Still unconfirmed, not implemented, same as other stages |

**Bug found in the source file**, not replicated: order `302000000312`'s
K column (ราคาต่อหน่วย) formulas are `=F16/E16`, `=F17/E17`, `=F18/E18` —
pointing 3 rows into the *next* order's block instead of self-referencing
(`=F13/E13` etc., which is what every other order in the sheet does).
Classic copy-paste-without-adjusting-the-anchor error. Implemented the
evidently-intended self-referencing formula instead of reproducing the
bug.

**Implemented**: `lib/pivot302.ts` — ใส่สาร/สัดส่วนผสม/สัดส่วน/ราคาต่อหน่วย/
Yield/Loss, verified against the source's actual computed numbers for
multiple orders (see `daily-reports/2026-08-21.md`). Not implemented:
สูตร FG (fragile cross-reference, see above) and Por Ver (unconfirmed).

### 303 — Packaging (partially implemented — core yield is real, daily defect log is not)

By far the widest sheet (43 columns), but it's really **two separate
sub-tables bolted together**: a clean input/output/yield pivot (columns
A-K, AI-AO) that's fully MB51-derivable, and a manual daily
defect-tracking log (columns L-AF) that isn't.

**The real yield calc** (verified 2026-08-21 against order
`303000000309`, roasted-blend input on row 8, bag output on row 7):

| Col | Header | Formula | Meaning |
|---|---|---|---|
| AI | ต่อหน่วย | `=F{row}/E{row}` (all rows) | Price per unit — works uniformly whether the row's unit is KG (roasted blend) or PC/EA (packaging consumables: box, film, valve) |
| AK | Yield | `=(E{output}*500/1000)/E{blendInput}` (first row of group only) | Output bag count × grams-per-bag ÷ 1000 = output kg, ÷ the roasted-blend input's (negative) kg qty |
| AJ | Loss | `=100%+AK{row}` | Same shortfall-from-100% pattern as elsewhere |

The `*500` is **hardcoded grams-per-bag directly in the formula**, not
looked up from anywhere — every output material in this reference file
happens to be a 500g bag, so it always works out, but MB51 has no weight
field and a different bag size would silently break it. **Not safe to
hardcode.** Implemented instead as an editable "น้ำหนัก/หน่วย (กรัม)"
(grams per unit) master value per output material — same UX pattern as
301's STD%, defaults empty until accounting sets it, persisted in
`data/unit-weight-master.json`. The blend-input material is identified
generically as "the input material whose unit is KG" rather than a fixed
row reference (holds for all 27 orders checked in this file — every 303
order has exactly one KG-unit input and the rest are PC/EA packaging
consumables).

**Explicitly not implemented** — the manual daily defect/loss log,
filled in daily by QA/production staff, not derivable from SAP data at
all: `QA เบิก(ถุง), ห้องคั่ว(g), ห้องแพ็ค(g), รวม(kg), เครื่องจักร, QA เบิก,
โรบอทตีแตก (robot breakage), วาล์วเสีย (valve defect), สตก เสีย,
เปลี่ยนตั้งฟิล์ม (film changeover), ฟิล์มยับ (film wrinkled), นน.ขาด
(weight short), ดับเบิ้ล (double bag), ซองวาล์วแตก (valve-bag torn),
Repack, ระบุวันที่ผิด (wrong date printed)`, plus the `check`/`Diff`
columns (G, H, I, J, Q, AF) that cross-reference those manual entries —
this data is per-day, not per-order, and gets rolled up into the monthly
order total. One of those check formulas (`Q4 = G8+P4`) also looks like
another copy-paste error (references a different row's G value with no
evident reason), reinforcing that this section of the source shouldn't
be treated as a clean spec even once the manual-entry question is
resolved. This whole sub-table is the "web entry form + import function"
the user asked for as a future phase — still pending the on-site
conversation with production/QA the project docs already flag as open.

**Implemented**: `lib/pivot303.ts` — input/output pivot, ราคาต่อหน่วย,
Yield/Loss (once unit weight is set), verified against the source's
actual numbers for order `303000000309` (outputWeightKg=760,
yield=100%, matching `AK4`/`AJ4` exactly).

### 305 — Retail repacking (same style as 303, verified 2026-08-26)

Columns: `Row Labels, Material, Material description, EUn, MvT, Sum of
Quantity in UnE, Sum of Amt.in Loc.Cur., check, ..., Por Ver, วันที่, [~10
manual defect columns], Diff, ..., ต่อหน่วย, Yield, ..., G, KG`. Structurally
the same shape as 303: each order consumes one BAG-denominated "blend"
input (a finished bag product being repacked/relabeled, e.g. "GOLD BLEND
ALL CAFE' 500G") plus several PC/EA packaging consumables (valve, film,
box, sticker), and produces one or more BAG output(s) — identified
generically as "the input material whose unit is BAG", same discipline as
303's "the input material whose unit is KG" (holds for 29 of 31 orders in
the live `Roasting Dashboard Initiative.xlsx` data; the other 2 net to
zero across every material — fully-reversed orders with nothing to
report — same skip rule as everywhere else).

**Real formula columns**: `AC` (ต่อหน่วย) = `=G{row}/F{row}`, same
price-per-unit pattern as every other stage; `AD` (Yield) = in the source,
a fragile per-pair row-offset formula (`=F{nextRow}/F{row}`) that only
works because the small `ตรวจ MB51_0769.xlsx` reference sample happens to
have exactly one input/output pair per order, both the same 500g bag size
(so Yield always evaluates to -1, i.e. 100%). **This does not generalize**:
checked against the fuller `Roasting Dashboard Initiative.xlsx` data (31
real orders) and found several orders where a 500g input bag is repacked
into two 250g output bags — a raw bag-count ratio would show 200% "yield",
which is wrong. Implemented as a real weight-based calc instead: both the
blend input and each BAG output are converted to kg via a grams-per-bag
lookup (reusing `FG_UNIT_WEIGHT_GRAMS`, `lib/fgUnitWeights.ts`, with the
same editable `UnitWeightMaster` fallback 303 uses — grams-per-bag is a
property of the material code itself, so the same table applies whether
that code shows up as 303's output or 305's input), then
`Yield = outputKg / inputKg`. Verified against the live data: orders whose
materials are all in the confirmed table compute correctly (e.g. order
`305000000020`: 1,903 bags in and out, both 500g → exactly 100%); orders
touching a material outside the confirmed table (e.g. `59000005`,
`59000012`, `59000013` — none of which are in `FG_UNIT_WEIGHT_GRAMS`)
correctly come back as "unknown" (flagged via `missingUnitWeight`, shown
as "-" in the UI) rather than a wrong number, until accounting fills in
that material's weight via the same editable master-data field 303 uses.

**Not implemented, same reasons as 303**: the ~10 manual daily
defect-reason columns (QA เบิก, ห้องคั่ว(g)/ห้องแพ็ค(g), โรบอทตีแตก,
วาล์วเสีย, ซองยับ, นน.ขาด, ดับเบิ้ล, ซองวาล์วแตก, Repack) and their
"check"/Diff columns — needs the pending on-site conversation with
production/QA. Also not implemented: the reference file's "สูตร CPR
Coffee Bean" / "สูตร Calibrate" rows below the pivot (rows 40-57) — a
fixed-row BOM/recipe reference table (raw materials per finished bag),
not part of the per-order report and not derivable per-order from MB51.

**Implemented**: `lib/pivot305.ts` — ราคาต่อหน่วย, weight-based Yield/Loss
(once unit weight is set for both sides), `components/Stage305Table.tsx`.

## Business meaning (coffee production flow)

```
Green coffee (สารกาแฟ) --[301 Preclean: clean/grade]--> Clean beans by grade (L/B/mix/...)
Clean beans           --[302 Roasting: roast/blend]---> Roasted blend (A80+R20 etc.)
Roasted blend          --[303 Packaging: bag & pack]---> Finished bags (Super Blend 500g etc.)
                        --[305 alt packing line]------> CPR-branded retail bags
```

Cost accounting (บัญชีต้นทุนสินค้า) closes this monthly: pull MB51 for the
period, split by order prefix, and for each stage compute actual yield %,
loss %, and a cost reallocation across output grades — used to value
inventory/COGS and to flag abnormal loss for follow-up.

## Open questions (updated 2026-08-21 — several resolved, see below)

**Resolved:**
- ~~Which order types are in scope~~ → phase 1 = 301, confirmed with the
  user; 302 and 303's core (MB51-derivable) formulas were reviewed and
  implemented same day (301/302/303 all real now, 305 still a
  placeholder).
- ~~Data refresh workflow~~ → an RPA job already lands MB51 into a
  database daily; file upload is the phase-1 stand-in, architected to
  swap later.
- **Inter-sheet dependency (302→303 "สูตร FG")** → confirmed it's just a
  finished-good name lookup (`='303 '!AM{n}` resolves to `=C{output
  row}`, a text label), not a numeric dependency — but still not
  implemented, since there's no reliable Order→Order mapping between the
  two stages in MB51 to know *which* 303 row corresponds to a given 302
  order.

**Still open:**
1. **Manual data-entry UI** for 303/305's daily defect/loss reasons — no
   spreadsheet formula can invent this data; needs the on-site
   conversation with production/QA the user mentioned wanting to have.
2. **Where does STD % (col J on sheet 301) come from** for new periods?
   Currently hand-typed per material, no confirmed business rule — user
   still needs to ask accounting.
3. **Unit weight per output material (grams/bag)** for 303/305's yield
   calc — the source hardcodes "500" per formula; the website now asks
   for it as editable master data instead, but there's no source of
   truth for *what* those weights should be beyond someone typing them
   in once. Worth asking whether a proper material master (weight,
   grade, etc.) exists anywhere else in the business's systems.
4. **`เกณฑ์กำลังการผลิต`** (capacity constants) and **`สรุป`** (broken
   `#REF!` summary) — are these still-used references, or dead
   artifacts from an earlier version of this workbook? `สรุป` should not
   be used as a spec since its formulas are already broken.

**Resolved 2026-08-26:**
- ~~305 hasn't been reviewed yet~~ → reviewed and implemented for real
  (`lib/pivot305.ts`, `components/Stage305Table.tsx`) — see the "305 —
  Retail repacking" section above. Same open item as 303: the manual
  daily defect-log columns still need the on-site conversation.
