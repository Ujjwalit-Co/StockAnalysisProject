import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stockService } from '@/lib/services/stockService'

// Cron job for daily stock updates - runs at 3:40 PM IST (10:10 UTC) from Mon to Fri
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

    // Use batch processing with concurrency control
    // Concurrency of 5 means 5 requests at a time, which is much faster than sequential
    const BATCH_SIZE = 50
    const results = {
      success: [] as string[],
      failed: [] as string[],
      total: symbols.length
    }

    // Process in chunks to avoid memory issues if there are thousands of stocks
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batchSymbols = symbols.slice(i, i + BATCH_SIZE)
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(symbols.length / BATCH_SIZE)}`)

      const batchResult = await stockService.updateStocksBatch(batchSymbols, 5)

      results.success.push(...batchResult.success)
      results.failed.push(...batchResult.failed)

      // Small delay between large batches to be nice to the API
      if (i + BATCH_SIZE < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    const successRate = (results.success.length / results.total) * 100

    console.log(`Daily stock update completed: ${results.success.length} success, ${results.failed.length} failed (${successRate.toFixed(1)}%)`)

    // Clean up old data (older than 30 days)
    console.log('Starting data cleanup...')
    const cleanupResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/stocks/cleanup?before=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`, {
      method: 'DELETE'
    })

    let cleanupResult: { deleted: number } | null = null
    if (cleanupResponse.ok) {
      cleanupResult = await cleanupResponse.json()
      console.log(`Cleaned up ${cleanupResult?.deleted} old records`)
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
