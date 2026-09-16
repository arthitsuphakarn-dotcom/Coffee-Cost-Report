# Deploy: Ubuntu + Apache (cpr-one, หนึ่งในหลายแอป)

Next.js 16 (App Router) โหมด **file-based** — ไม่ต้องใช้ database

```
Browser → ELB → Apache :443 (vhost cpr-one.com)
                 └─ ProxyPass /coffee-cost-report → Node (next start) :3000 → data/*.json
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

| แอป | Port | URL path | systemd service |
|---|---|---|---|
| Coffee Cost Report | 3000 | `/coffee-cost-report` | `coffee-cost-report` |
| phpMyAdmin | 8080 | `/phpMyAdmin/` | _(มีอยู่เดิม)_ |
| _(แอปถัดไป)_ | 3001 | | |

ตรวจว่า port ว่างไหม: `sudo ss -lntp | grep 3000`

---

## 1. เตรียม Server (ทำครั้งเดียวต่อเครื่อง)

Apache กับ mod_proxy มีอยู่แล้วบน cpr-one — ต้องเพิ่มแค่ Node

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v                                   # ต้อง >= v20.9 (Next 16)
```

ตรวจว่า port ที่จะใช้ยังว่าง

```bash
sudo ss -lntp | grep 3000
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
> ตัว `APP_DIR` คือโฟลเดอร์ที่มี `package.json` อยู่

## 3. Build

ไม่ต้องสร้าง `.env.local` และไม่ต้องรัน `npm run db:check` — โหมดนี้ไม่แตะ DB

```bash
cd <APP_DIR>
npm ci
npm run build
mkdir -p data
```

## 4. systemd

แก้ `WorkingDirectory`, `ReadWritePaths`, `HOME` ให้ตรงกับ `APP_DIR` จริง
และ `User` ให้ตรงกับ user ที่ clone โค้ดมา (จะได้ `git pull` ได้โดยไม่ติด permission)

```bash
sudo cp deploy/systemd/coffee-cost-report.service /etc/systemd/system/
sudo nano /etc/systemd/system/coffee-cost-report.service
sudo systemctl daemon-reload
sudo systemctl enable --now coffee-cost-report
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/    # ต้องได้ 200
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
source code และ `data/*.json` (ข้อมูลต้นทุน) มีโอกาสถูกเสิร์ฟเป็นไฟล์ธรรมดา
โดยเฉพาะถ้าชื่อโฟลเดอร์ตรงกับ URL path พอดี

ให้ย้ายออกไปไว้นอก DocumentRoot

```bash
sudo mkdir -p /var/www/apps
sudo mv /var/www/html/coffee-cost-report /var/www/apps/coffee-cost-report
```

แล้วแก้ `WorkingDirectory`, `HOME`, `ReadWritePaths` ใน systemd unit ให้ตรง

## 7. ข้อมูลตั้งต้น

`data/` อยู่ใน `.gitignore` → บน server จะว่าง และ**ปุ่มอัปโหลดใน UI ยังถูก
comment ไว้** ([components/ReportView.tsx](../components/ReportView.tsx)) จึงต้อง
ส่งไฟล์ขึ้นเองจากเครื่อง dev

```bash
# รันบนเครื่อง dev
scp data/*.json <user>@<server>:/tmp/
# บน server
cp /tmp/*.json <APP_DIR>/data/ && sudo systemctl restart coffee-cost-report
```

## 8. Backup

ข้อมูลทั้งหมดอยู่ในไฟล์ JSON ไม่กี่ไฟล์ ไม่มี transaction ไม่มี lock

```bash
echo '0 2 * * * tar czf /var/backups/ccr-$(date +\%F).tar.gz -C <APP_DIR> data' | sudo crontab -
```

---

## Deploy รอบถัดไป

แก้ `APP_DIR` ใน `deploy/deploy.sh` ให้ตรงก่อน แล้ว

```bash
./deploy/deploy.sh main
```

## ตรวจปัญหา

| อาการ | สาเหตุที่พบบ่อย |
|---|---|
| 503 Service Unavailable | Node ตาย → `systemctl status coffee-cost-report` |
| 502 proxy error | ยังไม่ได้ `a2enmod proxy proxy_http` |
| กดแล้วขึ้น 404 / โหลด CSS ไม่ได้ | `basePath` กับ ProxyPass ไม่ตรงกัน |
| เห็น directory listing ของ source | โค้ดยังอยู่ใต้ `/var/www/html` → ขั้นตอนที่ 6 |
| หน้าเว็บขึ้นแต่ไม่มีข้อมูล | `data/` ว่าง → ทำขั้นตอนที่ 7 |
| กด export แล้ว error | `data/` เขียนไม่ได้ / `ReadWritePaths` ผิด path |
| `/api/reports/301` คืน 500 | ปกติ — route นี้ใช้ DB และยังไม่มีใครเรียกใช้ |
| วันที่เพี้ยน | `TZ=Asia/Bangkok` ใน systemd unit |
| `Password authentication is not supported` | ใช้ SSH deploy key (ขั้นตอนที่ 2) |
| login cpr-one แล้วยังเด้งกลับหน้า login | `CPR_ONE_DB_*` ผิด/ต่อ DB ไม่ได้ → `journalctl` หา `[auth]` · หรือเปิดผ่าน IP/โดเมนอื่นที่ไม่ใช่ `*.cpr-one.com` จึงไม่ได้รับ cookie |
| API ตอบ 401 | ไม่มี cookie `cpr_one_session` / session หมดอายุ (6 ชม.) / logout แล้ว |

```bash
sudo journalctl -u coffee-cost-report -f
sudo tail -f /var/log/apache2/coffee-cost-report-error.log
```

---

## ยังไม่มี — ควรทำก่อนใช้งานจริง

- **สิทธิ์รายเมนู** — ตอนนี้ตรวจแค่ว่า login ผ่าน CPR-one แล้วและ user ยัง active
  ยังไม่ได้ดูว่า role ของ user มีเมนู Coffee Cost Report หรือไม่

## การเข้าถึง: ต้อง login ผ่าน CPR-one

`cpr-one/oauth/authenticate.php` สร้าง cookie `cpr_one_session` (domain `cpr-one.com`,
6 ชม.) + แถวใน `cpr_one.user_sessions` ทุกครั้งที่ login สำเร็จ ทั้งแบบ username/password
และ Cognito/Citrix แอปนี้ตรวจ cookie นั้นกับฐาน cpr_one:

- `proxy.ts` — ไม่มี cookie → หน้าเว็บ redirect ไปหน้า login ของ cpr-one, `/api/*` ตอบ 401
- `lib/auth/session.ts` — page และ route handler ทุกตัวตรวจ token กับ `user_sessions`
  (ยังไม่หมดอายุ) + `u_user.STATUS = '1'` · route ใหม่ต้องเรียก `rejectWithoutSession()` ด้วย
- logout ใน cpr-one (`php/main_service.php`, `oauth/logout.php`) ยกเลิก token ผ่าน
  `oauth/lib/central_session.php`

ต้องเพิ่มใน `.env.local` บน server (ดูตัวอย่างใน `.env.example`):

```bash
CPR_ONE_DB_HOST=...
CPR_ONE_DB_NAME=cpr_one
CPR_ONE_DB_USER=...        # แนะนำ user ที่มีแค่ SELECT บน user_sessions, u_user
CPR_ONE_DB_PASSWORD=...
```

dev บน localhost ไม่ได้รับ cookie ของ cpr-one.com — ตั้ง `CPR_ONE_AUTH_BYPASS=true`
ใน `.env.local` ของเครื่อง dev (production ไม่สนค่านี้)
- **ปุ่มอัปโหลด MB51 ถูก comment ไว้** — ผู้ใช้อัปเดตข้อมูลเองไม่ได้
- **`data/` ไม่มี lock** — ถ้าเปิดอัปโหลดแล้วมีคนใช้พร้อมกัน ไฟล์จะทับกัน
