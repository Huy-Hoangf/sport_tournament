// Local Docker demo only. Never use these credentials on a public deployment.
module.exports = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '15432',
  DB_USERNAME: 'sport_demo',
  DB_PASSWORD: 'sport_demo_local',
  DB_NAME: 'sport_demo',
  DB_SSL: 'false',
  PORT: '3001',
  BIND_HOST: '127.0.0.1',
  FRONTEND_URL: 'http://localhost:3000',
  JWT_SECRET: 'local-sprint5-demo-only-signing-key-do-not-use-in-production',
};
