import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Cron job for daily stock updates - runs at 4:10 PM IST (10:10 UTC)
export async function GET(request: NextRequest) {
  try {
    console.log('Starting daily stock update cron job')

    // Get all stock symbols from database
    const stocks = await db.stock.findMany({
      select: { symbol: true }
    })

    if (stocks.length === 0) {
      console.log('No stocks to update')
      return NextResponse.json({ message: 'No stocks to update' })
    }

    const symbols = stocks.map(stock => stock.symbol)
    console.log(`Found ${symbols.length} stocks to update`)

    // Import yahoo route functionality
    const { POST: yahooPost } = await import('../../../yahoo/route')

    const results = {
      success: [] as string[],
      failed: [] as string[],
      total: symbols.length
    }

    // For cron jobs, we can be more aggressive with rate limiting since it's automated
    // Yahoo Finance allows ~2000 requests/hour, so we use 2-second delays for faster processing
    const DELAY_BETWEEN_REQUESTS = 2000 // 2 seconds (faster than manual refresh)
    const BATCH_SIZE = 100 // Larger batches for cron jobs
    const BATCH_DELAY = 30000 // 30 second delay between batches

    // Process in batches to avoid overwhelming the API
    const batches = []
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      batches.push(symbols.slice(i, i + BATCH_SIZE))
    }

    console.log(`Processing ${batches.length} batches of ${BATCH_SIZE} stocks each`)

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} stocks)`)

      for (let i = 0; i < batch.length; i++) {
        const symbol = batch[i]

        try {
          console.log(`Updating ${symbol} (${batchIndex * BATCH_SIZE + i + 1}/${symbols.length})`)

          // Create a mock request for the yahoo API
          const mockRequest = new Request('http://localhost:3000/api/yahoo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol })
          })

          const response = await yahooPost(mockRequest as NextRequest)

          if (response.status === 200) {
            results.success.push(symbol)
          } else {
            const errorData = await response.json().catch(() => ({}))
            console.error(`Failed to update ${symbol}:`, errorData)
            results.failed.push(symbol)
          }

          // Rate limiting delay (except for last request in batch)
          if (i < batch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS))
          }

        } catch (error) {
          console.error(`Error updating ${symbol}:`, error)
          results.failed.push(symbol)
        }
      }

      // Delay between batches (except for last batch)
      if (batchIndex < batches.length - 1) {
        console.log(`Waiting ${BATCH_DELAY / 1000} seconds before next batch...`)
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
      }
    }

    const successRate = (results.success.length / results.total) * 100

    console.log(`Daily stock update completed: ${results.success.length} success, ${results.failed.length} failed (${successRate.toFixed(1)}%)`)

    // Clean up old data (older than 30 days)
    console.log('Starting data cleanup...')
    const cleanupResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/stocks/cleanup?before=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`, {
      method: 'DELETE'
    })

    let cleanupResult = null
    if (cleanupResponse.ok) {
      cleanupResult = await cleanupResponse.json()
      console.log(`Cleaned up ${cleanupResult.deleted} old records`)
    }

    return NextResponse.json({
      message: `Daily update completed: ${results.success.length}/${results.total} stocks updated`,
      success: results.success,
      failed: results.failed,
      successRate: successRate.toFixed(1) + '%',
      cleanup: cleanupResult ? `${cleanupResult.deleted} old records cleaned` : 'Cleanup skipped'
    })

  } catch (error) {
    console.error('Error in daily stock update cron:', error)
    return NextResponse.json({ error: 'Failed to update stocks' }, { status: 500 })
  }
}
