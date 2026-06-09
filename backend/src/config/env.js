export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  storageDir: process.env.STORAGE_DIR || '/app/data',
  google: {
    clientId:    process.env.GOOGLE_CLIENT_ID || '',
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

export const maxFileSizeBytes = () => config.maxFileSizeMb * 1024 * 1024;

export const isDropboxConfigured = () =>
  Boolean(config.dropbox.appKey && config.dropbox.appSecret);
