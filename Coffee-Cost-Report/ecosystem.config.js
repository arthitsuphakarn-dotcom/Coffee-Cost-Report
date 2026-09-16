
module.exports = {
  apps: [
    {
      name: "coffee-cost-report",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        // ต้องตรงกับ ProxyPass ใน vhost ของแต่ละเครื่อง — www-dev ใช้ 3001
        // สั่งทับตอน start ได้: PORT=3001 pm2 start ecosystem.config.js
        PORT: process.env.PORT || 3000,
        HOSTNAME: "127.0.0.1", 
        TZ: "Asia/Bangkok",
      },
      time: true, 
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "512M",
      watch: false,
    },
  ],
};
