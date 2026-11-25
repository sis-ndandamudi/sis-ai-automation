export const config = {
  port: Number(process.env.PORT ?? 4200),
  sisUrl: process.env.SIS_URL ?? 'https://sischartsdevgem.amkaicloud.com/login/',
  dataDir: process.env.DATA_DIR ?? 'data',
  viewport: { width: 1280, height: 720 },
  headless: process.env.HEADLESS !== 'false',
  maxSessions: Number(process.env.MAX_SESSIONS ?? 5),
  browserChannel: process.env.BROWSER_CHANNEL ?? 'chrome',
};