
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
        PORT: 3001,
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
