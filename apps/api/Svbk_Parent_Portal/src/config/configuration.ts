export default () => ({
  port: parseInt(process.env.PORT ?? '3002', 10) || 3002,
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '123456',
    name: process.env.DB_NAME || 'svbk_parent_portal',
    sync: process.env.DB_SYNC === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'parent_portal_jwt_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'parent_portal_refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  otp: {
    expiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES ?? '2', 10) || 2,
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'SVBK Parent Portal <no-reply@svbk.edu.in>',
  },
  demoMode: process.env.DEMO_MODE === 'true',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
});
