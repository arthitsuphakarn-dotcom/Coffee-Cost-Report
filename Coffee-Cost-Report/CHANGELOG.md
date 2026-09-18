# Changelog & System Updates

บันทึกประวัติการพัฒนา การเปลี่ยนแปลง และการปรับปรุงระบบ Coffee-Cost-Report อย่างเป็นทางการ

---

## [2026-09-18] — ตรวจสอบระบบ Session, แก้ปัญหา Redirect, และปรับตาราง MB51

### 1. การสืบค้นและวินิจฉัย (Investigation & Architecture Analysis)
- **ระบบ Check Session ร่วมกับ CPR-one**:
  - วิเคราะห์การทำงาน 2 ระดับ:
    - **Layer 1 (Optimistic Proxy)**: ตรวจ Cookie `cpr_one_session` เบื้องต้นใน `proxy.ts` หากไม่มีจะตัดจบส่งไป Login ทันที
    - **Layer 2 (Database Verification)**: ตรวจสอบจริงกับฐานข้อมูล MySQL `cpr_one` ใน `lib/auth/session.ts` และ `lib/database/userSessionRepository.ts` โดยการนำ Token มา Hash ด้วย **SHA-256** แล้ว Query เทียบเวลาหมดอายุใน Timezone `Asia/Bangkok`
- **วินิจฉัยปัญหาติด Redirect วนกลับไปที่ CPR-one (`framepage.php`)**:
  - ชี้แจง 4 สาเหตุหลัก:
    1. **Domain Mismatch**: เบราว์เซอร์เปิดด้วย `cpr-one.com` (ไม่มี `www.`) ทำให้ Cookie ไม่ถูกส่งข้ามโดเมน
    2. **ขาดการตั้งค่า DB**: ใน `.env.local` ยังขาดคอนฟิกชุด `CPR_ONE_DB_*` สำหรับเชื่อมต่อตาราง `user_sessions`
    3. **Session หมดอายุ**: Session ของ CPR-one มีอายุ 6 ชม.
    4. **Iframe Restriction**: นโยบาย SameSite/Partitioned Cookies ของเบราว์เซอร์เมื่อโหลดผ่าน `framepage.php`
- **การประเมินโครงสร้างและคุณภาพโค้ด (Architecture Review)**:
  - สรุปภาพรวมพิมพ์เขียวจาก `CLAUDE.md`
  - ประเมินจุดแข็งตามมาตรฐาน Clean Architecture (แยก Pure Business Logic ใน `lib/reports/`, Type safety ครบถ้วน, Security ในการ Query DB) และข้อเสนอแนะในการต่อยอด Phase 2

### 2. การเปลี่ยนแปลงและปรับปรุงโค้ด (Changed & Refactored)
- **เปลี่ยนตารางดึงข้อมูล MB51**:
  - แก้ไขค่าเริ่มต้นของตารางดึงข้อมูลจาก `mb51` เป็น **`mb51_0328`** ใน `lib/database/mb51Repository.ts`
  - รองรับการ Override ผ่าน Environment Variable `DB_MB51_TABLE` ได้ตามปกติ
- **Code Cleanup (นำ Access Log ที่ไม่จำเป็นออก)**:
  - ลบฟังก์ชัน `describeUser` และการเรียกใช้งาน `accessLog` ทั้งหมดออกจาก `lib/auth/session.ts` เพื่อลดความซ้ำซ้อนของ Log บน PM2 / Server Console
  - ลบฟังก์ชัน `accessLog` ออกจาก `lib/auth/sessionConfig.ts` เพื่อป้องกัน Dead Code

### 3. การตรวจสอบความถูกต้อง (Verification)
- ตรวจสอบ Type safety ด้วย `npx tsc --noEmit` ผ่านสมบูรณ์ (0 errors)
- ตรวจสอบ Linter ด้วย `npm run lint` ผ่านสมบูรณ์ (0 errors)
