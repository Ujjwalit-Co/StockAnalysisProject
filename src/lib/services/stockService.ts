import yahooFinance from 'yahoo-finance2'
import { db } from '@/lib/db'
import pLimit from 'p-limit'

// Initialize Yahoo Finance with suppressions
const yahoo = new yahooFinance({
    suppressNotices: ['yahooSurvey', 'ripHistorical']
})

// Rate limiting configuration
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests per symbol
const GLOBAL_MIN_INTERVAL = 200; // 200ms between ANY requests (approx 5 requests/sec max)

const lastRequestTime = new Map<string, number>();
let globalLastRequestTime = 0;
let requestQueue = Promise.resolve();

async function rateLimitCheck(symbol: string) {
    requestQueue = requestQueue.then(async () => {
        const now = Date.now();

        // Global rate limit check
        const timeSinceGlobal = now - globalLastRequestTime;
        if (timeSinceGlobal < GLOBAL_MIN_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, GLOBAL_MIN_INTERVAL - timeSinceGlobal));
        }
        globalLastRequestTime = Date.now();

        // Per-symbol rate limit check
        const lastTime = lastRequestTime.get(symbol) || 0;
        const timeSinceSymbol = now - lastTime;
        if (timeSinceSymbol < MIN_REQUEST_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceSymbol));
        }
        lastRequestTime.set(symbol, Date.now());
    });
    return requestQueue;
}

function formatIndianSymbol(symbol: string): string {
    if (!symbol.includes('.')) {
        return `${symbol}.NS`
    }
    return symbol
}

export const stockService = {
    async updateStock(symbol: string) {
        try {
            // Rate limiting check
            await rateLimitCheck(symbol)

            const yahooSymbol = formatIndianSymbol(symbol)

            // Get current stock data with timeout
            const quote = await Promise.race([
                yahoo.quote(yahooSymbol),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 10000))
            ])

            // Try to get historical data
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
                    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Historical data timeout')), 15000))
                ])

                if (chartData && (chartData as any).quotes) {
                    historical = (chartData as any).quotes
                }
            } catch (error) {
                console.log(`Historical data fetch failed for ${symbol}:`, error)
            }

            // Update or create stock in database
            const stockData = {
                symbol: symbol,
                name: quote.longName || quote.shortName || symbol,
                sector: quote.sector,
                industry: quote.industry,
                marketCap: quote.marketCap,
                currency: 'INR',
                exchange: yahooSymbol.includes('.NS') ? 'NSE' : 'BSE',
            }

            await db.stock.upsert({
                where: { symbol: symbol },
                update: stockData,
                create: stockData,
            })

            // Store historical data
            if (historical && Array.isArray(historical) && historical.length > 0) {
                for (const data of historical) {
                    try {
                        if (!data.date) continue

                        await db.stockPrice.upsert({
                            where: {
                                stockSymbol_date: {
                                    stockSymbol: symbol,
                                    date: data.date,
                                },
                            },
                            update: {
                                open: data.open || 0,
                                high: data.high || 0,
                                low: data.low || 0,
                                close: data.close || 0,
                                volume: data.volume || 0,
                                adjClose: data.adjClose,
                            },
                            create: {
                                stockSymbol: symbol,
                                date: data.date,
                                open: data.open || 0,
                                high: data.high || 0,
                                low: data.low || 0,
                                close: data.close || 0,
                                volume: data.volume || 0,
                                adjClose: data.adjClose,
                            },
                        })
                    } catch (error) {
                        console.error(`Error storing historical data point for ${symbol}:`, error)
                    }
                }
            }

            return {
                success: true,
                symbol,
                data: {
                    ...stockData,
                    currentPrice: quote.regularMarketPrice,
                    previousClose: quote.regularMarketPreviousClose,
                    change: (quote.regularMarketPrice || 0) - (quote.regularMarketPreviousClose || 0),
                    changePercent: (((quote.regularMarketPrice || 0) - (quote.regularMarketPreviousClose || 0)) / (quote.regularMarketPreviousClose || 1)) * 100,
                }
            }

        } catch (error) {
            console.error(`Error updating stock ${symbol}:`, error)
            return { success: false, symbol, error }
        }
    },

    async updateStocksBatch(symbols: string[], concurrency = 5) {
        const limit = pLimit(concurrency)

        const tasks = symbols.map(symbol => limit(() => this.updateStock(symbol)))

        const results = await Promise.all(tasks)

        return {
            total: symbols.length,
            success: results.filter(r => r.success).map(r => r.symbol),
            failed: results.filter(r => !r.success).map(r => r.symbol),
            results
        }
    }
}
