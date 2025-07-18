import { NextRequest, NextResponse } from 'next/server';
import { getConversationRecord } from '@/lib/db/conversations';
import { s3Client } from '@/lib/storage/s3';
import { dbClient } from '@/lib/db/client';
import { loadConfig } from '@/lib/config';

let isInitialized = false;

/**
 * Initialize services if not already initialized
 */
async function ensureInitialized() {
  if (!isInitialized) {
    try {
      const config = loadConfig();
      await dbClient.initialize(config.database);
      s3Client.initialize(config.s3);
      isInitialized = true;
    } catch (error) {
      // If S3 client is already initialized, that's fine
      if (error instanceof Error && error.message.includes('already initialized')) {
        isInitialized = true;
      } else {
        throw error;
      }
    }
  }
}

/**
 * GET /api/conversation/[id]
 *
 * Retrieves the full conversation data including content and metadata
 *
 * @param request - The incoming request
 * @param context - Route context containing the conversation ID
 *
 * Response:
 * - 200: { conversation: ConversationRecord, content: string } - The conversation data and content
 * - 404: { error: string } - Conversation not found
 * - 500: { error: string } - Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await ensureInitialized();
    const id = (await params).id;

    // Get conversation record from database
    const record = await getConversationRecord(id);

    // Get conversation content from S3
    const content = await s3Client.getConversationContent(record.contentKey);

    return NextResponse.json({
      conversation: record,
      content: content,
    });
  } catch (error) {
    console.error('Error retrieving conversation:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Internal error, see logs' }, { status: 500 });
  }
}
