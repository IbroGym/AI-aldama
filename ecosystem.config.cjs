module.exports = {
  apps: [
    {
      name: "bus-stop-kiosk",
      script: "C:/Windows/System32/cmd.exe",
      args: "/c npm run start:public",
      cwd: "C:/Users/играгим/Desktop/bus-stop-system-architecture",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
}
