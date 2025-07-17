import type { Conversation } from '@/types/conversation';
import { JSDOM } from 'jsdom';

/**
 * Safely inlines external <link rel="stylesheet"> tags into <style> blocks.
 */
async function inlineExternalStyles(html: string): Promise<Document> {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const links = Array.from(
    document.querySelectorAll('link[rel="stylesheet"]') as NodeListOf<HTMLLinkElement>
  );

  await Promise.all(
    links.map(async (link) => {
      const href = link.href;
      if (!href) return;

      try {
        const res = await fetch(href);
        const css = await res.text();

        const style = document.createElement('style');
        try {
          style.textContent = css;
          style.setAttribute('data-inlined-from', href.split('?')[0]);
          link.replaceWith(style);
        } catch (innerErr) {
          console.warn(`⚠️ Could not apply CSS from ${href}:`, innerErr);
          link.remove(); // fallback: just remove the <link>
        }
      } catch (err) {
        console.warn(`⚠️ Failed to fetch stylesheet ${href}:`, err);
        link.remove();
      }
    })
  );

  return document;
}

/**
 * Extracts the styled ChatGPT conversation from provided HTML.
 */
export async function parseChatGPT(html: string): Promise<Conversation> {
  const document = await inlineExternalStyles(html);

  const conversationBlocks = Array.from(
    document.querySelectorAll('div.markdown.prose.dark\\:prose-invert.w-full.break-words')
  );

  if (conversationBlocks.length === 0) {
    throw new Error('Conversation content not found');
  }

  const htmlContent = `
    <html>
      <head>${document.head.innerHTML}</head>
      <body class="dark">
        ${conversationBlocks.map((block) => block.outerHTML).join('\n')}
      </body>
    </html>
  `;

  return {
    model: 'ChatGPT',
    content: htmlContent,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(htmlContent),
  };
}
