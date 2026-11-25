import { Session } from './session';
import { config } from './config';

const sessions = new Map<string, Session>();

export const findSession = (user: string) => sessions.get(user);

export function createSession(user: string): Session {
  if (sessions.size >= config.maxSessions) throw new Error('Too many active sessions on this server');
  const s = new Session(user);
  sessions.set(user, s);
  return s;
}

export async function stopSession(user: string) {
  const s = sessions.get(user);
  if (!s) return;
  sessions.delete(user);
  await s.stop();
}

export async function stopAll() {
  await Promise.all([...sessions.keys()].map(stopSession));
}