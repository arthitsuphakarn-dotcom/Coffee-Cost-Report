# แผน: สรุปรายเดือน 301 + %STD แบบมีผลตามเดือน (effective-dated)

สถานะ: **ทำครบทั้ง 3 ก้อนแล้ว**
- **ก้อน A — ทำแล้ว 2026-08-28** (daily-reports/2026-08-28.md Round 4) —
  ใช้ %STD ค่าเดียวแบบปัจจุบัน, มติ §4.1(ก) ตัวเลขดิบ
- **ก้อน B (%STD effective-dated) — ทำแล้ว 2026-08-31**
  (daily-reports/2026-08-31.md) — `StdMaster` เก็บประวัติต่อ material, resolve
  ตามเดือนของ order/เดือนที่ดูอยู่
- **ก้อน C (Yield/Loss ใน Settlement Rule Report) — ทำแล้ว 2026-08-31**
  (daily-reports/2026-08-31.md) — ผูกกับ ก้อน A อย่างเป็นทางการ, ตัวเลขดิบ
  ไม่ normalize, เพิ่มแถว %Yield/%Loss, คอลัมน์ STD ใช้ค่าล่าสุด

เกี่ยวข้องกับงานที่ทำไปแล้ววันนี้: Settlement Rule Report popup + export
(daily-reports/2026-08-28.md Round 3).

---

## 1. สูตรจริงจาก reference file — `ตรวจ MB51_0769.xlsx` sheet `301`, ช่วง `A88:O99`

พื้นที่นี้ในไฟล์ต้นฉบับชื่อ **"Summary เพิ่มแต่ละสูตรเข้าไป"** — เป็นบล็อกสรุป
รวมของ sheet 301 (ทั้ง sheet = 1 ช่วงเวลา) แยกตามสายพันธุ์

| แถว | ความหมาย |
|---|---|
| R88 | หัวคอลัมน์: G `Semi` · H `สัดส่วน` · I `ราคา/Kg.` · J `% STD` · K `ปันใหม่ตาม STD` · L `ราคาหลังปัน` · M `Settlement Rule` · N `% Yield` · O `% Loss` |
| R89 | `Robusta` (ป้ายกลุ่ม) |
| R90 | `54002341 สารกาแฟโรบัสต้า` (สารตั้งต้น) — `E90 =SUMIF(B:B,A90,E:E)`, `F90 =SUMIF(B:B,A90,F:F)` (รวม Qty / Amount ของ material นี้ทั้ง sheet) |
| R91 | `57000003 Clean Robusta Size mix` |
| R92 | `57000004 Clean Robusta B` |
| R93 | รวมกลุ่ม Robusta |
| R94–99 | เหมือนกันสำหรับ `Arabica` (`54002340` + `57000000/01/02`) |
| R100 | `E100 =E93+E99` grand total |
| R101 | `E101 =E100-E79` = Diff เทียบ pivot ด้านบน (ตัวเช็คว่าตัวเลขตรง) |

### สูตรต่อแถว output (อ้างแถว 91, สาร = แถว 90)

| คอลัมน์ | สูตรต้นฉบับ | ความหมาย |
|---|---|---|
| H สัดส่วน | `=E91/$E$90` | ปริมาณเกรดนี้ ÷ **ปริมาณสารเข้า** |
| I ราคา/Kg. | `=F91/E91` | Amount ÷ Qty |
| J % STD | `95` (พิมพ์มือ) | ค่ามาตรฐานจาก SAP MM03 |
| K ปันใหม่ตาม STD | `=+F90*J91/100` | Amount สารเข้า × STD% ÷ 100 (ปันต้นทุนตามสัดส่วนมาตรฐาน) |
| L ราคาหลังปัน | `=K91/E91` | ต้นทุนปันใหม่ ÷ Qty |
| **M Settlement Rule** | **`=ROUND(H91,2)`** | **สัดส่วนจริง ปัด 2 ตำแหน่ง — ตัวเลขที่ต้องเอาไปใส่รายงาน** |
| N % Yield | `=SUM(H91:H92)` (แถวรวม) | ผลรวมสัดส่วนจริงของกลุ่ม |
| O % Loss | `=-100%-N92` (แถวรวม) | 100% − Yield |
| M แถวรวม | `=SUM(M91:M92)` | ผลรวม Settlement Rule ของกลุ่ม (≈ Yield) |

### ข้อสังเกตสำคัญ 2 ข้อ

1. **M (Settlement Rule) ไม่ใช้ %STD เลย** — %STD ไปโผล่แค่คอลัมน์ K/L (การปัน
   ต้นทุน). ⇒ การแก้ %STD **ไม่กระทบ Settlement Rule ย้อนหลังอยู่แล้วโดย
   ธรรมชาติ** กระทบแค่คอลัมน์ ปันใหม่ตาม STD / ราคาหลังปัน ของเดือนนั้น

2. **`M ÷ ΣM` (normalize ให้รวม = 100) = `q ÷ Σq_output`** ทางพีชคณิต
   (ตัวหาร "ปริมาณสารเข้า" ตัดกันหมด). ⇒ ตัวเลขในคอลัมน์รายเดือนของ Settlement
   Rule Report ที่ทำไปแล้ว **เท่ากับ Settlement Rule แบบ normalize อยู่แล้ว** —
   ดูข้อ 4

---

## 2. สิ่งที่ต้องทำเพิ่ม — 3 ก้อน

### ก้อน A — มุมมอง "สรุปรายเดือน 301" (ใหม่)

บล็อก `A88:O99` เดิมเป็นสรุป "ทั้ง sheet = ช่วงเดียว" → ทำใหม่ให้ **แตกราย
เดือน**: เลือกเดือน → เห็นบล็อก Robusta/Arabica ของเดือนนั้น ครบทุกคอลัมน์
(Semi / สัดส่วน / ราคา/Kg / %STD / ปันใหม่ตาม STD / ราคาหลังปัน / Settlement
Rule / %Yield / %Loss)

- คำนวณจาก 301 rows เฉพาะเดือนที่เลือก, `SUMIF` เป็น "รวมตาม material +
  เดือน", สายพันธุ์แยกจาก material code (ใช้ชุดเดียวกับ
  `lib/summaryDashboard.ts` / `lib/settlementRuleReport.ts`)
- **%STD ในบล็อกนี้ = ค่าที่มีผล ณ เดือนนั้น** (ดูก้อน B)
- เป็นแหล่งตัวเลข Settlement Rule (คอลัมน์ M) ที่ป้อนเข้า Settlement Rule
  Report — logic เดียวกัน คนละหน้าตา

### ก้อน B — %STD แบบมีผลตามเดือน (effective-dated)

**ตอนนี้:** `data/std-master.json` = `{ "<material>": <number> }` — ค่าเดียว
ทั้งระบบ ไม่มีมิติเวลา แก้ที่ input ในตาราง 301 → debounce เซฟผ่าน `/api/std`

**ต้องเป็น:** เก็บ**ประวัติ**ต่อ material

```jsonc
{
  "57000001": [
    { "from": "2026-01", "value": 80 },
    { "from": "2026-06", "value": 83 }   // มีผล มิ.ย. เป็นต้นไป
  ]
}
```

- resolver `stdPercentAsOf(master, material, "YYYY-MM")` = ค่าจาก entry
  ล่าสุดที่ `from <= เดือนนั้น` (ไม่มี → `null`)
- คอลัมน์ "สัดส่วน STD" ใน Settlement Rule Report = **entry ล่าสุดสุด**
  (`from` มากสุด) — ตรงกับที่ user บอก "ให้แสดงตัวเลขล่าสุดที่มีการเปลี่ยนแปลง"
- migration: ค่าเดิม (scalar) → ห่อเป็น `[{ from: <เดือนแรกของข้อมูล>, value }]`
  ตอนอ่านไฟล์ (อ่านไฟล์เก่าได้ ไม่พัง)
- order คร่อมเดือน (พบไม่บ่อย): ใช้เดือน posting **แรกสุด**ของ order เป็น
  เดือนอ้างอิงในการ resolve

### ก้อน C — ปรับ Settlement Rule Report (ที่ทำไปแล้ว) ให้ตรงสูตร

- คอลัมน์รายเดือน: ผูกกับ Settlement Rule (M) จากก้อน A อย่างเป็นทางการ
- แถวรวมท้ายกลุ่ม: เพิ่ม **%Yield / %Loss** ให้ตรงแถว N/O ของต้นฉบับ
- คอลัมน์ "สัดส่วน STD": เปลี่ยนไปใช้ resolver (ค่าล่าสุด) — ป้ายคอลัมน์เป็น
  `%STD (ล่าสุด)`

---

## 3. ผลกระทบต่อสิ่งที่ทำไปแล้ว / ไฟล์ที่ต้องแตะ

| ไฟล์ | เปลี่ยนอะไร | ระดับ |
|---|---|---|
| `lib/types.ts` | `StdMaster` : `Record<string,number>` → `Record<string, StdEntry[]>` (+`StdEntry={from,value}`) | **breaking type** กระเทือนทุกที่ที่อ้าง |
| `lib/store.ts` | `loadStdMaster` (migrate ตอนอ่าน), `setStdMasterEntry(material, from, value)`, เพิ่ม `deleteStdMasterEntry`, เพิ่ม `stdPercentAsOf()` (หรือแยกไป `lib/stdMaster.ts`) | กลาง |
| `app/api/std/route.ts` | body: `{material, stdPercent}` → `{material, from, value}` + เพิ่ม DELETE | เล็ก |
| `lib/pivotOrderReport.ts` | `stdMaster[material]` (บรรทัด 66, 84) → `stdPercentAsOf(stdMaster, material, orderMonth)` ; ต้องรู้เดือนของ order จาก `postingDate` | กลาง |
| `lib/exportReport.ts` | ใช้ค่าจาก `report` ที่ resolve แล้ว → **ไม่ต้องแก้** | – |
| `app/api/export/route.ts` | ส่ง `stdMaster` เข้า `computeOrderReport` เหมือนเดิม (แค่ signature เปลี่ยน) | เล็ก |
| `components/Stage301Table.tsx` | `<input>` %STD ต่อแถว → **read-only แสดงค่า ณ เดือน order** + ทำหัวคอลัมน์ `%STD` เป็นปุ่มเปิด modal จัดการ (`onOpenStdManager`) — แพตเทิร์นเดียวกับปุ่ม Settlement Rule ที่เพิ่งทำ | กลาง |
| `components/ReportView.tsx` | ชนิด state `stdMaster` เปลี่ยน; `handleStdChange` → `(material, from, value)`; state `stdManagerOpen`, `monthly301` sub-view; ส่ง props ใหม่ | กลาง |
| `lib/settlementRuleReport.ts` *(ทำแล้ว)* | คอลัมน์เดือน = Settlement Rule (M) อย่างเป็นทางการ; เพิ่มแถว %Yield/%Loss ต่อกลุ่ม; คอลัมน์ STD ใช้ resolver (ค่าล่าสุด) | เล็ก–กลาง |
| `lib/exportSettlementRuleReport.ts` *(ทำแล้ว)* | สะท้อนแถว Yield/Loss ที่เพิ่ม | เล็ก |
| `components/SettlementRuleModal.tsx` *(ทำแล้ว)* | เพิ่มแถว Yield/Loss ในส่วนท้ายกลุ่ม; ป้ายคอลัมน์ STD | เล็ก |
| **ใหม่** `lib/monthly301Summary.ts` | `computeMonthly301Summary(rows, stdMaster)` → เดือน × สายพันธุ์ × material : ทุกคอลัมน์ A88:O99 | ใหม่ |
| **ใหม่** `components/Monthly301SummaryView.tsx` | UI ก้อน A (mockup 1) | ใหม่ |
| **ใหม่** `app/api/export-monthly-301/route.ts` | export ก้อน A | ใหม่ |
| `data/std-master.json` | migrate เป็นรูปแบบ history (หรือ auto-migrate ตอนอ่าน) | เล็ก |

**ก้อนที่เสี่ยง/งานเยอะสุด = B (เปลี่ยน %STD scalar → history)** เพราะกระเทือน
type + store + pivot + 2 API + 2 component. ก้อน A เป็นงาน**เพิ่ม** (ไฟล์ใหม่
เกือบหมด + 1 sub-view). ก้อน C เป็นการปรับเล็กบนของที่มีอยู่

**สิ่งที่ *ไม่* กระทบ:** กลไก modal เปิด/ปิด, route `/api/export-settlement-rule`,
ตัวloop เรนเดอร์คอลัมน์เดือน, ตาราง 301 ราย order (นอกจากช่อง %STD), แท็บ
302/303/305, Summary Dashboard

---

## 4. จุดต้องตัดสินใจก่อนลงมือ — มติ PM + BA (รอ user เคาะ)

### 4.1 คอลัมน์เดือนใน Settlement Rule Report

**มติ: ทำ (ก) ตัวเลขดิบ = `ROUND(q/สารเข้า,2)` + แถว %Yield/%Loss — ไม่ทำ toggle**

- BA: ตรง A88:O99 เป๊ะ, ตรงคำว่า "Settlement Rule ที่เกิดจริง", %Loss ของ
  Preclean เป็นข้อมูลจริงที่บัญชีต้นทุนต้องเห็น ไม่ควรกลบด้วยการ normalize
- screenshot เดิมที่รวม = 100 คือเวอร์ชัน normalize ไว้กรอก SAP (settlement
  rule ใน SAP ต้องรวม 100%). ถ้าต้องใช้ค่อยเพิ่ม **คอลัมน์แยก** "% สำหรับตั้ง
  ใน SAP" = `M ÷ ΣM × 100` ทีหลัง — ไม่ทำตอนนี้ ไม่ทำเป็น toggle (toggle =
  ความหมายกำกวม จำไม่ได้ว่าตอนนี้ดูอันไหน)
- ⚠️ ผลที่ user ต้องรับทราบ: ตัวเลขจะ **ไม่ตรง screenshot เดิม** (รวม ~98 ไม่ใช่
  100)

### 4.2 UX จัดการ %STD

**มติ: (2) change-log ต่อ material — เปิดใน modal จากหัวคอลัมน์ %STD**

- BA: user บอกเอง "%STD เปลี่ยนไม่บ่อย" ⇒ ข้อมูลเบาบาง เหมาะกับ list
  "ตั้งแต่ <เดือน> = <ค่า>" มากกว่าเมทริกซ์ (เมทริกซ์เหมาะกับข้อมูลแน่น)
- แต่ละ entry มีเดือนมีผลติดมาชัด ⇒ แก้/ลบประวัติผิดพลาดยากกว่าเมทริกซ์ (เมทริกซ์
  ชวนคลิกผิดช่องเดือน)
- งานน้อยกว่า — ก้อน B หนักสุดอยู่แล้ว
- เพิ่มบรรทัดอ่านอย่างเดียวบนสุด modal: "ค่าที่ใช้เดือน [ปัจจุบัน]: …" ไว้ดูตอน
  ปิดงบรายเดือน
- PM: (3) แก้ inline ตัดทิ้ง — material เดียวกันโชว์คนละค่าในแต่ละ order group
  สับสนแน่นอน

### 4.3 ที่วางของ "สรุปรายเดือน 301"

**มติเดิม: segmented control** — **ปรับตาม feedback user (Round 5): การ์ดยุบได้
ต่อท้ายบนสุดของหน้ารายออเดอร์ 301 ไปเลย, ไม่มีปุ่มสลับมุมมอง, ข้อมูลล้อตาม
MonthRangeFilter ด้านบน (ทุกเดือนในช่วงที่กรอง ซ้อนกัน)**

- user บอก "ไม่อยากกดอะไรมากมาย" → ไม่แยก view, แค่ toggle ยุบ/กาง
- ไม่มี dropdown เลือกเดือนของตัวเอง — ใช้ตัวกรองช่วงเดือนที่มีอยู่แล้ว
- Settlement Rule Report ยังเป็น modal ตามเดิม

### 4.4 ลำดับการทำ (de-risk)

1. **ก้อน A ก่อน** — ใช้ %STD ค่าเดียวแบบปัจจุบันไปพลาง (resolver = คืนค่าเดียว)
   ส่งของที่ user เห็นได้จริง + ตรวจเลข Settlement Rule (M) เทียบ reference ราย
   เดือน เสี่ยงต่ำ
2. **ก้อน C** — ปรับ Settlement Rule Report ให้ดึง logic จาก A + เพิ่มแถว
   Yield/Loss งานเล็ก
3. **ก้อน B สุดท้าย** — %STD effective-dating เป็นตัวแก้ type ที่กระเทือนกว้าง
   ทำตอน A/C นิ่งแล้วจะ debug ทีละเรื่อง ก่อน B ลง ระบบทำงานเท่าเดิมทุกอย่าง
   (history = 1 entry)
- ข้อดีเพิ่ม: ถ้า user เปลี่ยนใจเรื่อง UX %STD หลังเห็น A/C ทำงาน ก็ยังไม่เสียงาน

### 4.5 %Yield / %Loss เดือนที่ยังไม่มีข้อมูล — โชว์ว่าง (เหมือนตอนนี้)

---

## 5. Mockup UI (เร็ว ๆ — ยังไม่ผูกสูตรจริง)

### จอ 1 — สรุปรายเดือน 301 (ก้อน A)

```
แท็บ 301  [ รายออเดอร์ | ●สรุปรายเดือน ]        เดือน: [ ก.ค. 2026 ▾ ]   [Export ⬇]

Robusta
Code       Material                       Semi    สัดส่วน  ราคา/Kg  %STD*  ปันใหม่ตาม STD  ราคาหลังปัน  Settlement Rule
54002341   สารกาแฟโรบัสต้า              38,120   100.00%   32.10    –           –             –            –
57000003   Clean Robusta Size mix                 95.80%   31.80    95     1,158,430.00   31.55        0.96
57000004   Clean Robusta B                         2.00%   28.40     3        36,540.00   30.10        0.02
รวม Robusta                                        97.80%                                              Σ 0.98
                                                                                    %Yield 97.80%   %Loss 2.20%

Arabica
Code       Material                       Semi    สัดส่วน  ราคา/Kg  %STD*  ปันใหม่ตาม STD  ราคาหลังปัน  Settlement Rule
54002340   สารกาแฟอาราบิก้า            120,540   100.00%   61.40    –           –             –            –
57000000   Clean Arabica Size S&M                  1.10%   58.90    15        …             …            0.01
57000001   Clean Arabica Size L                   98.44%   61.20    80        …             …            0.98
57000002   Clean Arabica B                         0.46%   55.30     3        …             …            0.00
รวม Arabica                                       100.00%                                              Σ 0.99
                                                                                    %Yield 100.00%  %Loss 0.00%

* %STD = ค่าที่มีผล ณ ก.ค. 2026 (อ่านอย่างเดียว — แก้ที่ปุ่ม "จัดการ %STD" บนหัวตารางราย order)
Diff เทียบ pivot: Qty 0.00  Amount 0.00  ✓
```

### จอ 2 — Settlement Rule Report (ปรับจากที่ทำแล้ว — ก้อน C)

```
Settlement Rule Report                                                   [Export ⬇] [✕]

Robusta                       %STD    ม.ค.  ก.พ.  มี.ค.  เม.ย. พ.ค. มิ.ย. ก.ค.   Average
                             (ล่าสุด)
54002341 สารกาแฟโรบัสต้า        –
57000003 Clean Robusta mix      95     95.9  90.4  93.1  95.6  92.0 95.7 96.0    94.7
57000004 Clean Robusta B         3      2.0   7.8   4.7   2.2   6.0  2.3  2.0     3.9
% Yield (Σ Settlement Rule)             97.9  98.2  97.8  97.8  98.0 98.0 98.0
% Loss                                   2.1   1.8   2.2   2.2   2.0  2.0  2.0

Arabica                        %STD    ม.ค.  ก.พ.  ...
54002340 สารกาแฟอาราบิก้า       –
57000000 Clean Arabica S&M      15      7.4  12.7  ...
57000001 Clean Arabica L        80     85.8  81.2  ...
57000002 Clean Arabica B         3      6.8   6.1  ...
% Yield                                100.0  100.0
% Loss                                   0.0    0.0

สัดส่วน STD  Sheet > 301 > Summary สูตร > %STD ช่อง J   (แสดงค่าล่าสุดที่เปลี่ยน)
สัดส่วนเกิดจริง  Sheet > 301 > Summary สูตร > Settlement Rule ช่อง M

[ ◉ ตัวเลขจริง (รวม = %Yield) | ○ ปรับให้รวม = 100% ]   ← toggle จุดตัดสินใจข้อ 4.1
```

### จอ 3 — modal "จัดการ %STD" (ก้อน B, ตัวเลือกที่แนะนำ = เมทริกซ์)

```
จัดการ %STD  (มาตรฐานจาก SAP T-Code MM03 — กรอกมือ)                              [✕]

ค่า %STD มีผล "ตั้งแต่เดือนที่กรอกเป็นต้นไป" ไม่กระทบเดือนก่อนหน้า
(กระทบเฉพาะคอลัมน์ ปันใหม่ตาม STD / ราคาหลังปัน — ไม่กระทบ Settlement Rule)

Material                     ม.ค.26  ก.พ.  มี.ค.  เม.ย.  พ.ค.  มิ.ย.  ก.ค.  ...
57000000 Clean Arabica S&M     15      ·      ·      ·      ·     12     ·
57000001 Clean Arabica L       80      ·      ·      ·      ·     83     ·
57000002 Clean Arabica B        3      ·      ·      ·      ·      ·      ·
57000003 Clean Robusta mix     95      ·      ·      ·      ·      ·      ·
57000004 Clean Robusta B        3      ·      ·      ·      ·      ·      ·

·  = สืบทอดค่าเดือนก่อนหน้า        ตัวเลขทึบ = จุดที่เปลี่ยนค่า (คลิกช่องเพื่อแก้/ลบ)

ค่าล่าสุด (โชว์ในคอลัมน์ "สัดส่วน STD" ของ Settlement Rule Report):
   S&M 12 · L 83 · B 3 · Robusta mix 95 · Robusta B 3
```

ตัวเลือกที่เบากว่า (change-log ต่อ material):

```
57000001  Clean Arabica Size L
   ตั้งแต่ ม.ค. 2026    80
   ตั้งแต่ มิ.ย. 2026    83     [ลบ]
   [ + เพิ่ม:  เดือน [ ▾ ]   ค่า [   ]  ]
```
