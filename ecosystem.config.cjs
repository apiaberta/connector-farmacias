module.exports = {
  apps: [{
    name: 'apiaberta-farmacias',
    script: 'src/index.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3007,
      MONGO_URI: 'mongodb://localhost:27017/apiaberta-farmacias'
    },
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000
  }]
}
