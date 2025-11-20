import { NextRequest, NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'

// Initialize Yahoo Finance with suppressions
const yahoo = new yahooFinance({
  suppressNotices: ['yahooSurvey']
})

// Rate limiting: Store last request time in memory
const lastRequestTime = new Map<string, number>()
const MIN_REQUEST_INTERVAL = 500 // 0.5 seconds between requests

async function rateLimitCheck(query: string) {
  const now = Date.now()
  const lastTime = lastRequestTime.get(query) || 0
  
  if (now - lastTime < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - (now - lastTime)
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }
  
  lastRequestTime.set(query, Date.now())
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
    }

    // Rate limiting check
    await rateLimitCheck(query)

    // Search for stocks
    const searchResults = await yahoo.search(query)

    // Filter for Indian stocks and format results
    const indianStocks = searchResults.quotes
      .filter((quote: any) => {
        // Include NSE (.NS) and BSE (.BO) stocks
        const symbol = quote.symbol || ''
        return symbol.includes('.NS') || symbol.includes('.BO')
      })
      .map((quote: any) => {
        const symbol = quote.symbol || ''
        const exchange = symbol.includes('.NS') ? 'NSE' : 'BSE'
        const cleanSymbol = symbol.replace(/\.(NS|BO)$/, '')
        
        return {
          symbol: cleanSymbol,
          fullSymbol: symbol,
          name: quote.longname || quote.shortname || quote.symbol,
          exchange: exchange,
          type: quote.quoteType || 'EQUITY',
          score: quote.score || 0,
        }
      })
      .slice(0, 10) // Limit to 10 results

    return NextResponse.json(indianStocks)
  } catch (error) {
    console.error('Error searching stocks:', error)
    return NextResponse.json({ error: 'Failed to search stocks' }, { status: 500 })
  }
}