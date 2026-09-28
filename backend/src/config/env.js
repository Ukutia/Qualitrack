const nodeEnv = process.env.NODE_ENV || 'development';

function booleanEnv(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  storageDir: process.env.STORAGE_DIR || '/app/data',
  // Clave para cifrar los archivos en reposo (HDU09). Si se omite, se deriva
  // de JWT_SECRET.
  docEncryptionKey: process.env.DOC_ENCRYPTION_KEY || '',
    requestTokenEncryptionKey: process.env.REQUEST_TOKEN_ENCRYPTION_KEY || '',
  allowSubdayRequestIntervals: booleanEnv(
    process.env.ALLOW_SUBDAY_REQUEST_INTERVALS,
    nodeEnv !== 'production'
  ),
  requestSchedulerIntervalMs: Math.max(
    1000,
    parseInt(process.env.REQUEST_SCHEDULER_INTERVAL_MS || '15000', 10) || 15000
  ),
  requestEmailRetrySeconds: Math.max(
    10,
    parseInt(process.env.REQUEST_EMAIL_RETRY_SECONDS || '60', 10) || 60
  ),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10) || 587,
    username: process.env.SMTP_USERNAME || '',
    password: process.env.SMTP_PASSWORD || '',
    useTls: booleanEnv(process.env.SMTP_USE_TLS, true),
    from: process.env.MAIL_FROM || '',
  },
  brevoApiKey: process.env.BREVO_API_KEY || '',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri:  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/cloud/google/callback',
  },
  dropbox: {
    appKey:      process.env.DROPBOX_APP_KEY || '',
    appSecret:   process.env.DROPBOX_APP_SECRET || '',
    redirectUri:  process.env.DROPBOX_REDIRECT_URI || 'http://localhost:4000/api/cloud/dropbox/callback',
  },
};

export const isGoogleConfigured = () =>
  Boolean(config.google.clientId && config.google.clientSecret);

export const isDropboxConfigured = () =>
  Boolean(config.dropbox.appKey && config.dropbox.appSecret);

export const maxFileSizeBytes = () => config.maxFileSizeMb * 1024 * 1024;
