// lib/scrapeChatGPTConversationContainer.ts
import puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';
import fs        from 'node:fs/promises';

const ARTICLE_SEL = 'article[data-testid^="conversation-turn"]';
const FONT_EXT    = /\.(woff2?|ttf|otf)(\?[^)]+)?$/i;

/* ───────────────────────── 1️⃣  Render page & inline <link>  ───────────────────────── */
async function renderWithInlineLinks(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page    = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  // force-paint lazy code blocks
  await page.evaluate(async () => {
    window.scrollTo({ top: document.body.scrollHeight });
    await new Promise(r => setTimeout(r, 500));
  });

  // <link rel="stylesheet"> ➜ <style>
  await page.evaluate(async () => {
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    for (const l of links) {
      if (!l.href) continue;
      try {
        const css   = await (await fetch(l.href)).text();
        const tag   = document.createElement('style');
        tag.textContent = css;
        tag.setAttribute('data-inlined-from', l.href.split('?')[0]);
        l.replaceWith(tag);
      } catch {/* ignore */ }
    }
  });

  const html = await page.content();
  await browser.close();
  return html;
}

/* ────────── 2️⃣  Optional: embed @import’d CSS & font binaries as data:URIs ────────── */
async function inlineImportsAndFonts(full: string): Promise<string> {
  const dom          = new JSDOM(full);
  const { document } = dom.window;

  for (const style of Array.from(document.querySelectorAll<HTMLStyleElement>('style'))) {
    const baseHref = style.getAttribute('data-inlined-from') ?? document.baseURI;
    let css        = style.textContent ?? '';

    /* expand @import url(...) */
    const importRe = /@import\s+(?:url\()?['"]?([^'")]+)['"]?\)?[^;]*;/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(css))) {
      try {
        const abs = new URL(m[1], baseHref).href;
        const txt = await (await fetch(abs)).text();
        css = css.replace(m[0], txt);
      } catch {/* ignore */ }
    }

    /* embed font binaries */
    const urlRe = /url\((['"]?)([^'")]+)\1\)/g;
    const repls: { from: string; to: string }[] = [];
    while ((m = urlRe.exec(css))) {
      const abs = new URL(m[2], baseHref).href;
      if (!FONT_EXT.test(abs)) continue;
      try {
        const buf  = Buffer.from(await (await fetch(abs)).arrayBuffer());
        const mime = 'font/' + (abs.split('.').pop() ?? 'woff2');
        repls.push({ from: m[0], to: `url(data:${mime};base64,${buf.toString('base64')})` });
      } catch {/* ignore */ }
    }
    repls.forEach(r => { css = css.split(r.from).join(r.to); });
    style.textContent = css;
  }
  return dom.serialize();
}

/* ────────── 3️⃣  Locate & keep ONLY the scroll container that owns the articles ────── */
function cropToConversationContainer(full: string): string {
  const dom          = new JSDOM(full);
  const { document } = dom.window;

  /** helper: climb ancestors until we hit the flex/overflow-y-auto wrapper */
  function findContainer(): HTMLElement | null {
    const firstArticle = document.querySelector(ARTICLE_SEL) as HTMLElement | null;
    if (!firstArticle) return null;

    let node: HTMLElement | null = firstArticle.parentElement;
    while (node && node !== document.body) {
      const cls = node.className as string;
      /* heuristic: ‘flex’, ‘flex-col’, & ‘overflow-y-auto’ are always present */
      if (cls.includes('overflow-y-auto') && cls.includes('flex') && cls.includes('flex-col')) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  const container = findContainer();
  if (!container) return full;                 // fallback: give full HTML

  document.body.innerHTML = '';                // strip everything else
  document.body.appendChild(container.cloneNode(true));

  return dom.serialize();
}

/* ────────── 4️⃣  PUBLIC API ────────── */
export async function scrapeChatGPTConversationContainer(
  url: string,
  opts: { debugSaveFull?: string; debugSaveCropped?: string } = {}
) {
  /* stage 1 */
  const rendered = await renderWithInlineLinks(url);

  /* stage 2 (fonts) — comment the next line out if you don’t need full offline-font support */
  const fontSafe = await inlineImportsAndFonts(rendered);

  if (opts.debugSaveFull) await fs.writeFile(opts.debugSaveFull, fontSafe);

  /* stage 3 */
  const cropped   = cropToConversationContainer(fontSafe);
  if (opts.debugSaveCropped) await fs.writeFile(opts.debugSaveCropped, cropped);

  return cropped;         // ← single file, container only, fully styled
}
