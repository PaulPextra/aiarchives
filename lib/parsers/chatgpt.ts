import type { Conversation } from '@/types/conversation';
import * as cheerio from 'cheerio';
import { inline } from 'css-inline';

/**
 * Scrapes only the conversation (user ↔ assistant) from a ChatGPT share URL,
 * with all stylesheets inlined.
 * @param html - The raw HTML string of the ChatGPT share page.
 * @returns A Promise resolving to a Conversation object containing the model, processed HTML content, scrape timestamp, and source HTML byte length.
 */
export async function parseChatGPT(html: string): Promise<Conversation> {
  try {
    // Load HTML into cheerio for parsing
    const $ = cheerio.load(html);

    // Select the conversation container (adjust selector based on ChatGPT's DOM structure)
    // Assuming conversation messages are in divs with classes like 'message-user' and 'message-assistant'
    const conversationElements = $('.message-user, .message-assistant');

    if (conversationElements.length === 0) {
      throw new Error('No conversation messages found in the provided HTML.');
    }

    // Create a new container for the conversation
    const conversationHtml = $('<div class="chatgpt-conversation"></div>');

    // Append each message to the container, preserving structure
    conversationElements.each((_, element) => {
      conversationHtml.append($(element).clone());
    });

    // Extract all <style> tags from the original HTML
    const styles = $('style').map((_, el) => $(el).html()).get().join('\n');

    // Add styles to the conversation HTML
    conversationHtml.prepend(`<style>${styles}</style>`);

    // Convert the conversation HTML to a string
    let conversationHtmlString = $.html(conversationHtml);

    // Inline the styles using css-inline
    try {
      conversationHtmlString = await inline(conversationHtmlString, {
        remove_style_tags: true, // Remove original <style> tags after inlining
        extra_css: '', // Add any additional CSS if needed
      });
    } catch (inlineError) {
      console.warn('Failed to inline styles:', inlineError);
      // Proceed with non-inlined styles if inlining fails
    }

    // Return the Conversation object
    return {
      model: 'ChatGPT',
      content: conversationHtmlString,
      scrapedAt: new Date().toISOString(),
      sourceHtmlBytes: Buffer.byteLength(html),
    };
  } catch (error) {
    throw new Error(`Failed to parse ChatGPT conversation: ${error.message}`);
  }
}