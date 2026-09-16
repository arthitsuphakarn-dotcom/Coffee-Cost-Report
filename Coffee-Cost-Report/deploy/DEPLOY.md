# Deploy: Ubuntu + Apache + pm2 (cpr-one, หนึ่งในหลายแอป)

Next.js 16 (App Router) — อ่าน MB51 จาก MySQL และตรวจ session กับฐาน cpr_one

```
Browser → ELB → Apache :443 (vhost cpr-one.com)
                 └─ ProxyPass /coffee-cost-report → Node (next start) :3000
                                                     ├─ ฐาน MB51 (รายงาน)
                                                     └─ ฐาน cpr_one (ตรวจ session)
```

แอปนี้ mount ที่ **`https://www.cpr-one.com/coffee-cost-report`** โดยแทรก ProxyPass
เข้าไปใน vhost เดิมของ cpr-one.com (ไม่ได้สร้าง vhost หรือ sub-domain ใหม่)
ค่า `basePath` อยู่ที่ [lib/core/basePath.ts](../lib/core/basePath.ts) ซึ่ง
`next.config.ts` import ไปใช้ — ถ้าย้าย mount point แก้ที่ไฟล์นั้นไฟล์เดียวแล้ว rebuild

Apache เสิร์ฟแอปนี้โดยตรงไม่ได้ (API routes ทุกตัวเป็น dynamic) ต้องรัน Node
process จริงแล้วให้ Apache ทำหน้าที่ reverse proxy เท่านั้น

---

## ตาราง port

Server โฮสต์หลายแอป แต่ละแอปต้องมี port ของตัวเอง — จดไว้กันชนกัน

| แอป | Port | URL path | ชื่อใน pm2 |
|---|---|---|---|
| Coffee Cost Report (www) | 3000 | `/coffee-cost-report` | `coffee-cost-report` |
| Coffee Cost Report (**www-dev**) | **3001** | `/coffee-cost-report` | `coffee-cost-report` |
| phpMyAdmin | 8080 | `/phpMyAdmin/` | _(ไม่ใช่ Node)_ |

**port ต้องตรงกับ ProxyPass ใน vhost ของเครื่องนั้น** ไม่ตรงคือ Apache ขึ้น 503
(`AH00957 ... attempt to connect to 127.0.0.1:<port> failed` ใน `/var/log/apache2/error.log`)
บน www-dev ให้ start ด้วย `PORT=3001 pm2 start ecosystem.config.js`

ตรวจว่า port ว่างไหม: `sudo ss -lntp | grep 3000`
ดูว่าตอนนี้มีแอป Node อะไรรันอยู่บ้าง: `pm2 list`

---

## 1. เตรียม Server (ทำครั้งเดียวต่อเครื่อง)

Apache กับ mod_proxy มีอยู่แล้วบน cpr-one — ต้องเพิ่ม Node กับ pm2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v                                   # ต้อง >= v20.9 (Next 16)
sudo npm install -g pm2
pm2 install pm2-logrotate                 # กัน log กินดิสก์
```

ให้ pm2 กลับมาเองหลัง server reboot (รันครั้งเดียวต่อเครื่อง แล้วทำตามคำสั่งที่มันพิมพ์ออกมา)

```bash
pm2 startup
```

## 2. วางโค้ด

GitHub ไม่รองรับ password แล้ว — ใช้ **SSH deploy key**

```bash
ssh-keygen -t ed25519 -C "ccr-deploy" -f ~/.ssh/id_ed25519_ccr -N ""
cat ~/.ssh/id_ed25519_ccr.pub      # เอาไปใส่ repo → Settings → Deploy keys (read-only)

printf 'Host github.com\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/id_ed25519_ccr\n  IdentitiesOnly yes\n' >> ~/.ssh/config
chmod 600 ~/.ssh/config
ssh -T git@github.com

git clone git@github.com:arthitsuphakarn-dotcom/Coffee-Cost-Report.git
```

> **repo มีโฟลเดอร์ซ้อน** — Next app อยู่ชั้นใน `Coffee-Cost-Report/Coffee-Cost-Report/`
> ตัว `APP_DIR` คือโฟลเดอร์ที่มี `package.json` และ `ecosystem.config.js` อยู่

## 3. ตั้งค่าและ build

สร้าง `.env.local` ใน `APP_DIR` (ไฟล์นี้อยู่ใน `.gitignore` ไม่ถูก deploy ทับ) — ต้องมีทั้ง
ฐาน MB51 (`DB_*`) และฐาน cpr_one สำหรับตรวจ session (`CPR_ONE_DB_*`) ถ้าขาด `CPR_ONE_DB_*`
ทุกคนจะถูกส่งกลับหน้า login

```bash
cd <APP_DIR>
npm ci
npm run db:check      # ตรวจว่าต่อฐาน MB51 ได้
npm run build
mkdir -p data
```

## 4. รันด้วย pm2

config อยู่ที่ [ecosystem.config.js](../ecosystem.config.js) — ใช้ `cwd: __dirname` จึงไม่ต้อง
แก้ path เวลาย้ายโฟลเดอร์ และ `PORT`/`TZ` ตั้งไว้ในนั้นแล้ว

```bash
cd <APP_DIR>
pm2 start ecosystem.config.js
pm2 save                                                            # จำไว้ให้กลับมาเองหลัง reboot
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/coffee-cost-report   # ต้องได้ 307 (ไม่มี cookie)
```

คำสั่งที่ใช้บ่อย

```bash
pm2 list                                  # แอปไหนรันอยู่บ้าง
pm2 logs coffee-cost-report               # ดู log สด
pm2 restart coffee-cost-report            # restart
pm2 describe coffee-cost-report           # ดู cwd / env / uptime / restart count
```

## 5. Apache

cert ของ cpr-one.com เป็น wildcard และ `mod_proxy` เปิดอยู่แล้ว (บล็อก
`/phpMyAdmin/` ใช้อยู่) จึง **ไม่ต้องขอ cert ใหม่ และไม่ต้อง a2enmod**

แทรกเนื้อหาใน `deploy/apache/coffee-cost-report-vhost-snippet.conf` เข้าไปใน
`<VirtualHost *:443>` ของ cpr-one.com (วางต่อจากบล็อก `/technician_pm/ui`)

```bash
sudo cp /etc/apache2/sites-available/<vhost>.conf /etc/apache2/sites-available/<vhost>.conf.bak
sudo nano /etc/apache2/sites-available/<vhost>.conf
sudo apache2ctl configtest && sudo systemctl reload apache2
```

> **สำรอง vhost เดิมก่อนแก้เสมอ** — ไฟล์นี้คุมทุกแอปบน cpr-one
> (`/customer-centric/api`, `/test-cprweb`, `/capex/api`, `/bud/api`,
> `/technician_pm/ui`, `/phpMyAdmin/`) แก้พลาดคือล่มทั้งหมด

## 6. ห้ามวางโค้ดไว้ใต้ DocumentRoot

`DocumentRoot` ของ cpr-one คือ `/var/www/html` ถ้า `APP_DIR` อยู่ข้างใต้นั้น
source code, `.env.local` (มีรหัสผ่าน DB) และ `data/*.json` มีโอกาสถูกเสิร์ฟเป็นไฟล์ธรรมดา
โดยเฉพาะถ้าชื่อโฟลเดอร์ตรงกับ URL path พอดี

ให้ย้ายออกไปไว้นอก DocumentRoot

```bash
sudo mkdir -p /var/www/apps
sudo mv /var/www/html/coffee-cost-report /var/www/apps/coffee-cost-report
```

แล้วรัน `pm2 delete coffee-cost-report` และ `pm2 start ecosystem.config.js` จาก path ใหม่
(`cwd` มาจาก `__dirname` จึงไม่ต้องแก้ config)

## 7. ข้อมูลตั้งต้น

`data/` อยู่ใน `.gitignore` → บน server จะว่าง และ**ปุ่มอัปโหลดใน UI ยังถูก
comment ไว้** ([components/ReportView.tsx](../components/ReportView.tsx)) จึงต้อง
ส่งไฟล์ขึ้นเองจากเครื่อง dev

```bash
# รันบนเครื่อง dev
scp data/*.json <user>@<server>:/tmp/
# บน server
cp /tmp/*.json <APP_DIR>/data/ && pm2 restart coffee-cost-report
```

## 8. Backup

```bash
echo '0 2 * * * tar czf /var/backups/ccr-$(date +\%F).tar.gz -C <APP_DIR> data' | sudo crontab -
```

---

## Deploy รอบถัดไป

แก้ `APP_DIR` ใน `deploy/deploy.sh` ให้ตรงก่อน แล้ว

```bash
./deploy/deploy.sh main
```

script จะ `git reset --hard`, `npm ci`, `npm run build` แล้ว `pm2 startOrReload` + `pm2 save` ให้

## การเข้าถึง: ต้อง login ผ่าน CPR-one

`cpr-one/oauth/authenticate.php` สร้าง cookie `cpr_one_session` (domain `cpr-one.com`,
6 ชม.) + แถวใน `cpr_one.user_sessions` ทุกครั้งที่ login สำเร็จ ทั้งแบบ username/password
และ Cognito/Citrix แอปนี้ตรวจ cookie นั้นกับฐาน cpr_one:

- `proxy.ts` — ไม่มี cookie → หน้าเว็บ redirect ไปหน้า login ของ cpr-one, `/api/*` ตอบ 401
- `lib/auth/session.ts` — page และ route handler ทุกตัวตรวจ token กับ `user_sessions`
  (ยังไม่หมดอายุ) + `u_user.STATUS = '1'` · route ใหม่ต้องเรียก `rejectWithoutSession()` ด้วย
- logout ใน cpr-one (`php/main_service.php`, `oauth/logout.php`) ยกเลิก token ผ่าน
  `oauth/lib/central_session.php`

ต้องมีใน `.env.local` บน server:

```bash
CPR_ONE_DB_HOST=...
CPR_ONE_DB_NAME=cpr_one
CPR_ONE_DB_USER=...        # แนะนำ user ที่มีแค่ SELECT บน user_sessions, u_user
CPR_ONE_DB_PASSWORD=...
```

dev บน localhost ไม่ได้รับ cookie ของ cpr-one.com — ตั้ง `CPR_ONE_AUTH_BYPASS=true`
ใน `.env.local` ของเครื่อง dev (production ไม่สนค่านี้)

## ดูว่าใครเข้าใช้งานบ้าง

ทุก request ที่ตรวจ session ผ่าน จะเขียน log 1 บรรทัด

```bash
pm2 logs coffee-cost-report --lines 200 | grep "\[access\]"
```

```
[access] somchai.j (สมชาย ใจดี) · GET / · จาก 10.20.30.40
```

ปิด log นี้ได้ด้วย `AUTH_ACCESS_LOG=false` ใน `.env.local`
ฝั่ง browser: เปิดหน้าเว็บแล้วกด F12 → Console จะเห็น `[session] เข้าใช้งานโดย ...`
ของ session ตัวเอง ([components/shared/SessionConsoleLog.tsx](../components/shared/SessionConsoleLog.tsx))

## ตรวจปัญหา

| อาการ | สาเหตุที่พบบ่อย |
|---|---|
| 503 Service Unavailable | Node ตาย (`pm2 list`) **หรือ port ไม่ตรงกับ ProxyPass** → ดู `sudo tail /var/log/apache2/error.log` ว่ามันพยายามต่อ port อะไร แล้วเทียบกับ `sudo ss -lntp \| grep next` |
| 502 proxy error | ยังไม่ได้ `a2enmod proxy proxy_http` |
| กดแล้วขึ้น 404 / โหลด CSS ไม่ได้ | `basePath` กับ ProxyPass ไม่ตรงกัน |
| **เข้าได้โดยไม่ต้อง login** | process ที่ Apache ต่ออยู่เป็น build เก่า → `pm2 describe coffee-cost-report` ดู cwd/uptime และ `ps -ef \| grep next` ว่ามี process ค้างนอก pm2 ไหม |
| เห็น directory listing ของ source | โค้ดยังอยู่ใต้ `/var/www/html` → ขั้นตอนที่ 6 |
| login cpr-one แล้วยังเด้งกลับหน้า login | `CPR_ONE_DB_*` ผิด/ต่อ DB ไม่ได้ → `pm2 logs` หา `[auth]` · หรือเปิดผ่าน IP/โดเมนอื่นที่ไม่ใช่ `*.cpr-one.com` จึงไม่ได้รับ cookie |
| API ตอบ 401 | ไม่มี cookie `cpr_one_session` / session หมดอายุ (6 ชม.) / logout แล้ว |
| กด export แล้ว error | `data/` เขียนไม่ได้ (สิทธิ์ไฟล์ของ user ที่ pm2 รันอยู่) |
| วันที่เพี้ยน | `TZ=Asia/Bangkok` ใน `ecosystem.config.js` |
| `Password authentication is not supported` | ใช้ SSH deploy key (ขั้นตอนที่ 2) |

```bash
pm2 logs coffee-cost-report
sudo tail -f /var/log/apache2/coffee-cost-report-error.log
```

---

## ยังไม่มี — ควรทำก่อนใช้งานจริง

- **สิทธิ์รายเมนู** — ตอนนี้ตรวจแค่ว่า login ผ่าน CPR-one แล้วและ user ยัง active
  ยังไม่ได้ดูว่า role ของ user มีเมนู Coffee Cost Report หรือไม่
- **ปุ่มอัปโหลด MB51 ถูก comment ไว้** — ผู้ใช้อัปเดตข้อมูลเองไม่ได้
- **`data/` ไม่มี lock** — ถ้าเปิดอัปโหลดแล้วมีคนใช้พร้อมกัน ไฟล์จะทับกัน
- **pm2 ไม่มี sandbox แบบ systemd** — unit เดิมเคยจำกัดไว้ว่าเขียนได้เฉพาะ `data/`
  (`ProtectSystem`, `ReadWritePaths`) ตอนนี้ต้องคุมด้วยสิทธิ์ไฟล์และ user ที่รัน pm2 แทน
