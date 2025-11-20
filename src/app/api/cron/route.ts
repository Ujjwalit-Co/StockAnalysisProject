import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import yahooFinance from 'yahoo-finance2'

const yahoo = new yahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
})

async function updateStockData(symbol: string) {
  try {
    const yahooSymbol = symbol.endsWith('.NS') || symbol.endsWith('.BO') ? symbol : `${symbol}.NS`;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 3);

    const [quote, historical] = await Promise.all([
      yahoo.quote(yahooSymbol),
      yahoo.chart(yahooSymbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      }),
    ]);

    if (quote) {
      const stockData = {
        name: quote.longName || quote.shortName || symbol,
        sector: quote.sector,
        industry: quote.industry,
        marketCap: quote.marketCap,
        currency: quote.currency,
        exchange: quote.fullExchangeName,
      };

      await db.stock.update({
        where: { symbol },
        data: stockData,
      });
    }

    if (historical && historical.quotes.length > 0) {
      for (const q of historical.quotes) {
        await db.stockPrice.upsert({
          where: {
            stockSymbol_date: {
              stockSymbol: symbol,
              date: new Date(q.date),
            },
          },
          update: {
            open: q.open ?? 0,
            high: q.high ?? 0,
            low: q.low ?? 0,
            close: q.close ?? 0,
            volume: q.volume ?? 0,
            adjClose: q.adjClose,
          },
          create: {
            stockSymbol: symbol,
            date: new Date(q.date),
            open: q.open ?? 0,
            high: q.high ?? 0,
            low: q.low ?? 0,
            close: q.close ?? 0,
            volume: q.volume ?? 0,
            adjClose: q.adjClose,
          },
        });
      }
    }
  } catch (error) {
    console.error(`Failed to update data for ${symbol}`, error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const stocks = await db.stock.findMany({
      select: {
        symbol: true,
      },
    })

    if (!stocks.length) {
      return NextResponse.json({ message: 'No stocks to update' })
    }

    // Use Promise.all to update all stocks concurrently
    await Promise.all(stocks.map(stock => updateStockData(stock.symbol)))

    return NextResponse.json({ message: 'Stock data updated successfully' })
  } catch (error) {
    console.error('Error in cron job:', error)
    return NextResponse.json({ error: 'Failed to update stock data' }, { status: 500 })
  }
}
