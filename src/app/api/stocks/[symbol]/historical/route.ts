import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol.toUpperCase()

    const historicalData = await db.stockPrice.findMany({
      where: { stockSymbol: symbol },
      orderBy: { date: 'asc' },
      take: 30, // Last 30 days
    })

    const formattedData = historicalData.map(price => ({
      date: price.date.toISOString().split('T')[0],
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      volume: price.volume,
    }))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Error fetching historical data:', error)
    return NextResponse.json({ error: 'Failed to fetch historical data' }, { status: 500 })
  }
}