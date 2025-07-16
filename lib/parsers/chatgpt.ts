import type { Conversation } from '@/types/conversation';
import { JSDOM } from 'jsdom';

/**
 * Helper to safely inline external <link rel="stylesheet"> tags into <style> tags.
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
      if (!href || href.startsWith('https://cdn.jsdelivr.net') || href.includes('tailwind')) {
        return;
      }

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
        }
      } catch (err) {
        console.warn(`⚠️ Failed to fetch stylesheet ${href}:`, err);
      }
    })
  );

  return document;
}

/**
 * Parses a raw ChatGPT share HTML to extract only the conversation with styles.
 */
export async function parseChatGPT(html: string): Promise<Conversation> {
  // Inline all usable <link> styles
  const document = await inlineExternalStyles(html);

  // Extract only the conversation blocks
  const conversationBlocks = Array.from(
    document.querySelectorAll('div.markdown.prose.dark\\:prose-invert.w-full.break-words')
  );

  if (conversationBlocks.length === 0) {
    throw new Error('Conversation content not found');
  }

  // Construct the final minimal HTML with styles + content only
  const htmlContent = `
    <html>
      <head>${document.head.innerHTML}</head>
      <body class="dark">
        ${conversationBlocks.map(block => block.outerHTML).join('\n')}
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
