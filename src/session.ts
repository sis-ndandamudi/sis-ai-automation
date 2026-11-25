import { chromium, type BrowserContext, type CDPSession, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from './config';

export class Session {
  private context?: BrowserContext;
  private page?: Page;
  private cdp?: CDPSession;
  private starting?: Promise<void>;
  private listeners = new Set<(frame: Buffer) => void>();
  lastFrame?: Buffer;

  constructor(readonly user: string) {}

  start(): Promise<void> {
    this.starting ??= this.init().catch(async (err) => {
      this.starting = undefined;
      await this.context?.close().catch(() => {});
      this.context = undefined;
      throw err;
    });
    return this.starting;
  }

  private async init() {
    const profileDir = path.resolve(config.dataDir, 'profiles', this.user);
    const videoDir = path.resolve(config.dataDir, 'videos', this.user);
    fs.mkdirSync(videoDir, { recursive: true });

    // Persistent profile keeps the manual login between restarts.
    this.context = await chromium.launchPersistentContext(profileDir, {
      ...(config.browserChannel ? { channel: config.browserChannel } : {}),
      headless: config.headless,
      viewport: config.viewport,
      recordVideo: { dir: videoDir, size: config.viewport },
    });
    this.page = this.context.pages()[0] ?? (await this.context.newPage());
    await this.page.goto(config.sisUrl, { waitUntil: 'domcontentloaded' });

    // Real frames from the real browser (not a simulation).
    this.cdp = await this.context.newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', async (f) => {
      const buf = Buffer.from(f.data, 'base64');
      this.lastFrame = buf;
      for (const l of this.listeners) l(buf);
      try {
        await this.cdp!.send('Page.screencastFrameAck', { sessionId: f.sessionId });
      } catch {}
    });
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 70,
      maxWidth: config.viewport.width,
      maxHeight: config.viewport.height,
      everyNthFrame: 1,
    });
  }

  onFrame(cb: (frame: Buffer) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private need(): Page {
    if (!this.page) throw new Error('Browser not started');
    return this.page;
  }

  click(x: number, y: number) { return this.need().mouse.click(x, y); }
  wheel(dy: number) { return this.need().mouse.wheel(0, dy); }
  type(text: string) { return this.need().keyboard.type(text); }
  press(key: string) { return this.need().keyboard.press(key); }

  async screenshot(label: string): Promise<string> {
    const page = this.need();
    const dir = path.resolve(config.dataDir, 'screenshots', this.user);
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `${stamp}-${label}.png`);
    await page.screenshot({ path: file });
    return file;
  }

  async stop() {
    try { await this.cdp?.send('Page.stopScreencast'); } catch {}
    await this.context?.close(); // closing is what saves the video file
    this.listeners.clear();
  }
}