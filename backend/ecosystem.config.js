module.exports = {
  apps: [
    {
      name: 'servilo-api',
      script: './server.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster', // Enables Node.js cluster mode for load balancing
      watch: false,
      max_memory_restart: '1G', // Restart if memory exceeds 1GB
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      time: true
    }
  ]
};
