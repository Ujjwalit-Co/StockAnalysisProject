import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {

  const revalidate = 3600 
  try {
    const stocks = await db.stock.findMany({
      include: {
        historical: {
          orderBy: { date: 'asc' }, 
          take: 30, 
        },
      },
    })

    const stocksWithCurrentPrice = stocks.map(stock => {
      const latestPrice = stock.historical[stock.historical.length - 1]
      const previousPrice = stock.historical[stock.historical.length - 2]
      
      return {
        ...stock,
        currentPrice: latestPrice?.close || 0,
        currentPriceDate: latestPrice?.date.toISOString() || new Date().toISOString(), 
        previousClose: previousPrice?.close || latestPrice?.close || 0,
        change: latestPrice && previousPrice ? latestPrice.close - previousPrice.close : 0,
        changePercent: latestPrice && previousPrice && previousPrice.close > 0 
          ? ((latestPrice.close - previousPrice.close) / previousPrice.close) * 100 
          : 0,
        volume: latestPrice?.volume || 0,
        dayHigh: latestPrice?.high || 0,
        dayLow: latestPrice?.low || 0,
      }
    })

    return NextResponse.json(stocksWithCurrentPrice)
  } catch (error) {
    console.error('Error fetching stocks:', error)
    return NextResponse.json({ error: 'Failed to fetch stocks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { symbol, name, sector, industry } = await request.json()

    if (!symbol || !name) {
      return NextResponse.json({ error: 'Symbol and name are required' }, { status: 400 })
    }

    const existingStock = await db.stock.findUnique({
      where: { symbol: symbol.toUpperCase() }
    })

    if (existingStock) {
      return NextResponse.json({ error: 'Stock already exists' }, { status: 409 })
    }

    const stock = await db.stock.create({
      data: {
        symbol: symbol.toUpperCase(),
        name,
        sector,
        industry,
      },
    })

    return NextResponse.json(stock)
  } catch (error) {
    console.error('Error adding stock:', error)
    return NextResponse.json({ error: 'Failed to add stock' }, { status: 500 })
  }
}