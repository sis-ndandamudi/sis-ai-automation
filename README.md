# SIS AI Automation

Phase 1: live SIS browser (real Chrome via Playwright), manual login, screenshots, video recording.

    npm install
    npm run build
    npm start

Open http://localhost:4200 (others: `http://HOST-MACHINE.sisfirst.com:4200`).
Settings via environment variables: PORT, SIS_URL, DATA_DIR, HEADLESS, MAX_SESSIONS, BROWSER_CHANNEL.
The data/ folder holds login sessions, videos and screenshots. Never commit it.