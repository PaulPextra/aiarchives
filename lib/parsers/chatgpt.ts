import type { Conversation } from '@/types/conversation';
import { inlineExternalStyles } from './inlineExternalStyles';

export async function parseChatGPT(html: string): Promise<Conversation> {
  const document = await inlineExternalStyles(html);

  const blocks = Array.from(
    document.querySelectorAll('div.markdown.prose.dark\\:prose-invert.w-full.break-words')
  );

  if (blocks.length === 0) {
    throw new Error('Conversation content not found');
  }

  const htmlContent = `
    <html>
      <head>${document.head.innerHTML}</head>
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
