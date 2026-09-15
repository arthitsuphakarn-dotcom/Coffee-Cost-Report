/* ตรวจการเชื่อมต่อ MySQL — อ่านค่าจาก .env.local ของโปรเจกต์
 * ใช้: node --env-file=.env.local test-db.mjs            (จาก root ของ Next app)
 *      node --env-file=.env.local /path/to/test-db.mjs
 */
import net from "node:net";
import mysql from "mysql2/promise";

const cfg = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? {} : undefined,
};

const ok = (m) => console.log("  \x1b[32m✓\x1b[0m " + m);
const no = (m) => console.log("  \x1b[31m✗\x1b[0m " + m);

console.log("\n[1/5] ตรวจค่า environment");
for (const k of ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]) {
  const v = process.env[k];
  if (!v) { no(`${k} ไม่ได้ตั้งค่า`); process.exit(1); }
  ok(`${k} = ${k === "DB_PASSWORD" ? "*".repeat(Math.min(v.length, 8)) : v}`);
}

console.log("\n[2/5] ตรวจว่าต่อถึงเครื่องปลายทางไหม (TCP)");
await new Promise((res) => {
  const s = net.createConnection({ host: cfg.host, port: cfg.port, timeout: 8000 });
  s.on("connect", () => { ok(`ต่อถึง ${cfg.host}:${cfg.port}`); s.destroy(); res(); });
  s.on("timeout", () => { no(`หมดเวลา — VPN ต่ออยู่หรือยัง / firewall เปิด port ${cfg.port} ไหม`); process.exit(1); });
  s.on("error", (e) => { no(`ต่อไม่ได้: ${e.code} — ${e.message}`); process.exit(1); });
});

console.log("\n[3/5] ล็อกอิน MySQL");
let conn;
try {
  conn = await mysql.createConnection({ ...cfg, connectTimeout: 10000 });
  ok("ล็อกอินสำเร็จ");
  const [[v]] = await conn.query("SELECT VERSION() AS v, DATABASE() AS db, USER() AS u");
  ok(`เวอร์ชัน ${v.v} · database "${v.db}" · user ${v.u}`);
} catch (e) {
  no(`ล็อกอินไม่ผ่าน: ${e.code}`);
  console.log("     " + e.message);
  if (e.code === "ER_ACCESS_DENIED_ERROR") console.log("     → user/password ผิด หรือ host นี้ยังไม่ได้รับสิทธิ์");
  if (e.code === "ER_BAD_DB_ERROR")        console.log(`     → ไม่มี database ชื่อ "${cfg.database}"`);
  process.exit(1);
}

console.log("\n[4/5] ดูตารางที่มี");
const [tables] = await conn.query("SHOW TABLES");
if (!tables.length) no("ไม่มีตารางเลยใน database นี้");
else {
  ok(`พบ ${tables.length} ตาราง:`);
  for (const t of tables) console.log("     - " + Object.values(t)[0]);
}

console.log("\n[5/5] ตรวจตาราง MB51 (ถ้ามี)");
const names = tables.map((t) => Object.values(t)[0]);
const mb51 = names.find((n) => n.toUpperCase().includes("MB51"));
if (!mb51) {
  no("ไม่พบตารางที่ชื่อมีคำว่า MB51 — ข้อมูลอาจอยู่คนละ database (ลอง SHOW DATABASES)");
  const [dbs] = await conn.query("SHOW DATABASES");
  console.log("     database ที่ user นี้เห็น: " + dbs.map((d) => Object.values(d)[0]).join(", "));
} else {
  ok(`พบตาราง "${mb51}"`);
  const [[c]] = await conn.query(`SELECT COUNT(*) n FROM \`${mb51}\``);
  ok(`จำนวนแถว: ${Number(c.n).toLocaleString("th-TH")}`);
  const [cols] = await conn.query(`SHOW COLUMNS FROM \`${mb51}\``);
  const need = ["MB51_MATERIAL_CODE","MB51_ORDER","MB51_POSTING_DATE","MB51_UNIT","MB51_QUANTITY","MB51_AMOUNT","MB51_LOCATION","MB51_MVT","MB51_DESCRIPTION","MB51_BATCH"];
  const have = new Set(cols.map((c) => c.Field));
  console.log("\n  คอลัมน์ที่แอปต้องใช้:");
  for (const n of need) {
    const c = cols.find((x) => x.Field === n);
    if (c) ok(`${n.padEnd(22)} ${c.Type}${c.Null === "YES" ? " NULL ได้" : ""}`);
    else   no(`${n.padEnd(22)} ไม่พบ!`);
  }
  if (have.has("MB51_POSTING_DATE")) {
    const [[r]] = await conn.query(
      `SELECT MIN(MB51_POSTING_DATE) mn, MAX(MB51_POSTING_DATE) mx,
              SUM(MB51_ORDER IS NOT NULL AND MB51_ORDER <> 'NULL') withOrder
       FROM \`${mb51}\``);
    console.log("");
    ok(`ช่วงวันที่: ${r.mn} ถึง ${r.mx}`);
    ok(`แถวที่มี Order: ${Number(r.withOrder).toLocaleString("th-TH")}`);
    const [months] = await conn.query(
      `SELECT DATE_FORMAT(MB51_POSTING_DATE,'%Y-%m') m, COUNT(*) n
       FROM \`${mb51}\` WHERE MB51_ORDER IS NOT NULL AND MB51_ORDER <> 'NULL'
       GROUP BY m ORDER BY m`);
    console.log("\n  แถวที่มี Order แยกรายเดือน:");
    for (const r of months) console.log(`     ${r.m}  ${String(r.n).padStart(6)}`);
  }
}

await conn.end();
console.log("\n\x1b[32mเชื่อมต่อได้ ใช้งานได้\x1b[0m\n");
