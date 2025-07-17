import type { Conversation } from '@/types/conversation';
import { JSDOM } from 'jsdom';

/**
 * Extract ChatGPT conversation blocks from HTML input without modifying styles.
 * @param html Raw HTML string
 */
export async function parseChatGPT(html: string): Promise<Conversation> {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Grab only the core conversation blocks
  const blocks = Array.from(
    document.querySelectorAll('div.markdown.prose.dark\\:prose-invert.w-full.break-words')
  );

  if (blocks.length === 0) {
    throw new Error('Conversation content not found');
  }

  // Leave all <link> styles untouched and embed conversation only
  const htmlContent = `
    <html>
      <head>
        ${document.head.innerHTML}
      </head>
      <body class="dark">
        ${blocks.map((b) => b.outerHTML).join('\n')}
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
