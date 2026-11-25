import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config';
import { findSession, createSession, stopSession, stopAll } from './sessions';
import type { Session } from './session';

const app = express();
app.use(express.static(path.resolve(__dirname, '..', 'public')));
app.get('/api/health', (_req, res) => { res.json({ ok: true }); });

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const cleanName = (s: string | null) =>
  (s ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);

wss.on('connection', (ws, req) => {
  const user = cleanName(new URL(req.url ?? '', 'http://localhost').searchParams.get('user'));
  if (!user) { ws.close(1008, 'name required'); return; }

  const send = (o: object) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(o)); };
  let unsub: (() => void) | undefined;

  const attach = (s: Session) => {
    unsub?.();
    unsub = s.onFrame((buf) => { if (ws.readyState === WebSocket.OPEN) ws.send(buf); });
    if (s.lastFrame) ws.send(s.lastFrame);
  };

  send({ type: 'hello', user, viewport: config.viewport });
  const existing = findSession(user);
  if (existing) { attach(existing); send({ type: 'status', state: 'running' }); }
  else send({ type: 'status', state: 'idle' });

  ws.on('message', async (raw) => {
    let m: any;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    try {
      if (m.type === 'start') {
        const s = findSession(user) ?? createSession(user);
        attach(s);
        await s.start();
        send({ type: 'status', state: 'running' });
        return;
      }
      const s = findSession(user);
      if (!s) return;
      switch (m.type) {
        case 'click': await s.click(Number(m.x), Number(m.y)); break;
        case 'wheel': await s.wheel(Number(m.dy)); break;
        case 'type': await s.type(String(m.text)); break;
        case 'press': await s.press(String(m.key)); break;
        case 'screenshot': {
          const file = await s.screenshot('manual');
          send({ type: 'screenshot', file: path.basename(file) });
          break;
        }
        case 'stop':
          await stopSession(user);
          send({ type: 'status', state: 'stopped' });
          break;
      }
    } catch (err) {
      send({ type: 'error', message: (err as Error).message });
    }
  });

  ws.on('close', () => unsub?.());
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`SIS AI Automation listening on http://0.0.0.0:${config.port}`);
});

const shutdown = async () => { await stopAll(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);