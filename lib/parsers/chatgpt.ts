import type { Conversation } from '@/types/conversation';
import { JSDOM } from 'jsdom';

/**
 * Extracts the styled ChatGPT conversation blocks from raw HTML.
 * @param html Raw HTML string from a ChatGPT share page
 * @returns A structured Conversation object
 */
export async function parseChatGPT(html: string): Promise<Conversation> {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Extract <style> from external links and inline them
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]') as NodeListOf<HTMLLinkElement>);

  await Promise.all(
    links.map(async link => {
      const href = link.href;
      if (!href) return;

      try {
        const res = await fetch(href);
        const css = await res.text();
        const style = document.createElement('style');
        style.textContent = css;
        style.setAttribute('data-inlined-from', href.split('?')[0]);
        link.replaceWith(style);
      } catch {
        // Ignore failed fetch
      }
    })
  );

  // Select all conversation blocks
  const blocks = Array.from(
    document.querySelectorAll('div.markdown.prose.dark\\:prose-invert.w-full.break-words')
  );

  if (blocks.length === 0) {
    throw new Error('No ChatGPT conversation blocks found.');
  }

  // Compose final HTML document
  const content = `
    <html>
      <head>${document.head.innerHTML}</head>
      <body class="dark">
        ${blocks.map(block => block.outerHTML).join('\n')}
      </body>
    </html>
  `;

  return {
    model: 'ChatGPT',
    content,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(content),
  };
}
