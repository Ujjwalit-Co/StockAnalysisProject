import { NextRequest, NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'
import { db } from '@/lib/db'

// Initialize Yahoo Finance with suppressions
const yahoo = new yahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical']
})

// Rate limiting: Store last request time in memory
const lastRequestTime = new Map<string, number>()
const MIN_REQUEST_INTERVAL = 1000 // 1 second between requests per symbol

// Simple in-memory cache for API responses
const responseCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

async function rateLimitCheck(symbol: string) {
  const now = Date.now()
  const lastTime = lastRequestTime.get(symbol) || 0

  if (now - lastTime < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - (now - lastTime)
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  lastRequestTime.set(symbol, Date.now())
}

// Check cache for existing data
function getCachedData(cacheKey: string) {
  const cached = responseCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  return null
}

// Set cache data
function setCachedData(cacheKey: string, data: any) {
  responseCache.set(cacheKey, { data, timestamp: Date.now() })
}

function formatIndianSymbol(symbol: string): string {
  // Convert symbol to Yahoo Finance format for Indian stocks
  // NSE stocks: SYMBOL.NS
  // BSE stocks: SYMBOL.BO
  if (!symbol.includes('.')) {
    // Default to NSE
    return `${symbol}.NS`
  }
  return symbol
}

export async function POST(request: NextRequest) {
  try {
    const { symbol } = await request.json()

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
    }

    // Check cache first
    const cacheKey = `quote_${symbol}`
    const cachedData = getCachedData(cacheKey)
    if (cachedData) {
      console.log(`Serving cached data for ${symbol}`)
      return NextResponse.json(cachedData)
    }

    // Rate limiting check
    await rateLimitCheck(symbol)

    // Format symbol for Indian markets
    const yahooSymbol = formatIndianSymbol(symbol)

    // Get current stock data with timeout
    let quote
    try {
      quote = await Promise.race([
        yahoo.quote(yahooSymbol),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 10000))
      ])
    } catch (error) {
      console.error('Error fetching quote:', error)
      return NextResponse.json({ error: 'Failed to fetch stock data. Please check the symbol and try again.' }, { status: 500 })
    }

    // Try to get historical data but don't fail if it times out
    let historical: any[] = []
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - 30)

      const chartData = await Promise.race([
        yahoo.chart(yahooSymbol, {
          period1: startDate,
          period2: endDate,
          interval: '1d',
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Historical data timeout')), 15000))
      ])

      if (chartData && (chartData as any).quotes) {
        historical = (chartData as any).quotes
      }
    } catch (error) {
      console.log('Historical data fetch failed or timed out:', error)
      // Continue without historical data
    }

    // Update or create stock in database
    const stockData = {
      symbol: symbol, // Store original symbol without .NS
      name: quote.longName || quote.shortName || symbol,
      sector: quote.sector,
      industry: quote.industry,
      marketCap: quote.marketCap,
      currency: 'INR',
      exchange: symbol.includes('.NS') ? 'NSE' : 'BSE',
    }

    await db.stock.upsert({
      where: { symbol: symbol },
      update: stockData,
      create: stockData,
    })

    // Store historical data if available
    if (historical && Array.isArray(historical) && historical.length > 0) {
      for (const data of historical) {
        try {
          await db.stockPrice.upsert({
            where: {
              stockSymbol_date: {
                stockSymbol: symbol,
                date: data.date!,
              },
            },
            update: {
              open: data.open!,
              high: data.high!,
              low: data.low!,
              close: data.close!,
              volume: data.volume!,
              adjClose: data.adjClose,
            },
            create: {
              stockSymbol: symbol,
              date: data.date!,
              open: data.open!,
              high: data.high!,
              low: data.low!,
              close: data.close!,
              volume: data.volume!,
              adjClose: data.adjClose,
            },
          })
        } catch (error) {
          console.error('Error storing historical data point:', error)
        }
      }
    }

    // Return current data
    const response = {
      symbol: symbol,
      name: quote.longName || quote.shortName || symbol,
      currentPrice: quote.regularMarketPrice,
      previousClose: quote.regularMarketPreviousClose,
      change: quote.regularMarketPrice - quote.regularMarketPreviousClose,
      changePercent: ((quote.regularMarketPrice - quote.regularMarketPreviousClose) / quote.regularMarketPreviousClose) * 100,
      volume: quote.regularMarketVolume,
      dayHigh: quote.regularMarketDayHigh,
      dayLow: quote.regularMarketDayLow,
      week52High: quote.fiftyTwoWeekHigh,
      week52Low: quote.fiftyTwoWeekLow,
      marketCap: quote.marketCap,
      currency: 'INR',
      exchange: symbol.includes('.NS') ? 'NSE' : 'BSE',
      sector: quote.sector,
      industry: quote.industry,
    }

    // Cache the response
    setCachedData(cacheKey, response)

    return NextResponse.json(response)
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

    const results: any[] = []

    for (const symbol of symbols) {
      try {
        // Rate limiting check
        await rateLimitCheck(symbol)

        // Format symbol for Indian markets
        const yahooSymbol = formatIndianSymbol(symbol)

        const quote = await yahoo.quote(yahooSymbol)
        
        results.push({
          symbol: symbol,
          name: quote.longName || quote.shortName || symbol,
          currentPrice: quote.regularMarketPrice,
          previousClose: quote.regularMarketPreviousClose,
          change: quote.regularMarketPrice - quote.regularMarketPreviousClose,
          changePercent: ((quote.regularMarketPrice - quote.regularMarketPreviousClose) / quote.regularMarketPreviousClose) * 100,
          volume: quote.regularMarketVolume,
          dayHigh: quote.regularMarketDayHigh,
          dayLow: quote.regularMarketDayLow,
          week52High: quote.fiftyTwoWeekHigh,
          week52Low: quote.fiftyTwoWeekLow,
          marketCap: quote.marketCap,
          currency: 'INR',
          exchange: symbol.includes('.NS') ? 'NSE' : 'BSE',
          sector: quote.sector,
          industry: quote.industry,
        })

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (error) {
        console.error(`Error fetching data for ${symbol}:`, error)
        results.push({
          symbol,
          error: 'Failed to fetch data'
        })
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error in Yahoo Finance API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}