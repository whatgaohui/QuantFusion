import { NextResponse } from 'next/server';

/**
 * Redirect to the working market brief endpoint.
 * The original implementation used a non-existent `generateMarketBrief` export.
 * The canonical brief endpoint is /api/fusion/market/brief which uses
 * createChatCompletion + getFinnhubApiKey properly.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      brief: 'AI Market Brief has been migrated. Please use /api/fusion/market/brief for the latest market brief.',
      source: 'redirect',
      is_offline: true,
    },
    error: null,
  });
}
