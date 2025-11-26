import { NextRequest, NextResponse } from 'next/server'
import { stockService } from '@/lib/services/stockService'

export async function POST(request: NextRequest) {
  try {
    const { symbol } = await request.json()

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
    }

    const result = await stockService.updateStock(symbol)

    if (result.success) {
      return NextResponse.json(result.data)
    } else {
      return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error fetching Yahoo Finance data:', error)
    return NextResponse.json({ error: 'Failed to fetch stock data. Please check the symbol and try again.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbols = searchParams.get('symbols')?.split(',') || []

    if (symbols.length === 0) {
      return NextResponse.json({ error: 'At least one symbol is required' }, { status: 400 })
    }

    // Use batch processing for GET request as well
    const result = await stockService.updateStocksBatch(symbols, 2) // Lower concurrency for on-demand requests

    return NextResponse.json(result.results.map(r => {
      if (r.success) {
        return r.data
      } else {
        return {
          symbol: r.symbol,
          error: 'Failed to fetch data'
        }
      }
    }))
  } catch (error) {
    console.error('Error in Yahoo Finance API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}