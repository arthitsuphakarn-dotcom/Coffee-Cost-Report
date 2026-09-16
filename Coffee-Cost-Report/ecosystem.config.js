// pm2 config — รันจากโฟลเดอร์นี้: pm2 start ecosystem.config.js
//
// cwd = โฟลเดอร์ที่ไฟล์นี้อยู่ (ที่เดียวกับ package.json) ทำให้ย้ายโฟลเดอร์แล้วไม่ต้องแก้ config
// และ Next อ่าน .env.local จาก cwd นี้เอง — ค่า DB/CPR_ONE_DB ทั้งหมดอยู่ในไฟล์นั้น ไม่ใส่ในนี้
module.exports = {
  apps: [
    {
      name: "coffee-cost-report",
      cwd: __dirname,
      // เรียก next ตรง ๆ ไม่ผ่าน npm เพื่อให้ pm2 คุม process จริง ไม่ใช่ตัว npm ครอบอีกชั้น
      script: "node_modules/next/dist/bin/next",
      args: "start",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1", // รับเฉพาะ localhost ให้ Apache เป็นตัวหน้า
        TZ: "Asia/Bangkok",
      },
      time: true, // ใส่เวลาหน้าทุกบรรทัด log — จำเป็นกับ log [access]
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "512M",
      watch: false,
    },
  ],
};
