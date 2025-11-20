import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export async function GET(request: NextRequest) {
  // Revalidate this data every 5 minutes (300 seconds)
  const revalidate = 300
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const watchlistId = searchParams.get('watchlistId')

    let stockSymbolsToFetch: string[] = []

    if (watchlistId) {
      const watchlist = await db.watchlist.findUnique({
        where: { id: watchlistId },
        include: {
          stocks: {
            select: { stockSymbol: true }
          }
        }
      })

      if (!watchlist) {
        return NextResponse.json({ error: 'Watchlist not found' }, { status: 404 })
      }
      stockSymbolsToFetch = watchlist.stocks.map(ws => ws.stockSymbol)
    } else {
      // If no watchlistId, use symbols from query params (if any)
      stockSymbolsToFetch = searchParams.get('symbols')?.split(',') || []
    }

    // Fetch stock data
    const stocks = await db.stock.findMany({
      where: stockSymbolsToFetch.length > 0 ? {
        symbol: { in: stockSymbolsToFetch }
      } : {},
      include: {
        historical: {
          orderBy: { date: 'asc' }, // Order by date ascending for easier pivoting
          take: 30, // Last 30 days
        },
      },
    })

    if (stocks.length === 0) {
      return NextResponse.json({ error: 'No stocks found' }, { status: 404 })
    }

    // Prepare data for export - Transpose the data (stocks as rows, dates as columns)
    const allDates = new Set<string>()
    stocks.forEach(stock => {
      stock.historical.forEach(price => {
        allDates.add(price.date.toISOString().split('T')[0])
      })
    })

    const sortedDates = Array.from(allDates).sort()

    const transposedExportData: { [key: string]: string | number }[] = []

    // Create data rows for each stock
    stocks.forEach(stock => {
      const row: { [key: string]: string | number } = { Symbol: stock.symbol }

      // Get previous day's price for comparison
      const sortedHistorical = stock.historical.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      sortedDates.forEach(date => {
        const priceForDate = stock.historical.find(price => price.date.toISOString().split('T')[0] === date)
        const currentPrice = priceForDate?.close

        if (currentPrice && currentPrice !== 'N/A') {
          // Find previous trading day's price
          const currentDateIndex = sortedHistorical.findIndex(p => p.date.toISOString().split('T')[0] === date)
          const previousPrice = currentDateIndex > 0 ? sortedHistorical[currentDateIndex - 1]?.close : null

          if (previousPrice && previousPrice > 0) {
            const change = currentPrice - previousPrice
            // For Excel, we'll use a special marker for red text
            row[date] = change < 0 ? `[RED]${currentPrice}` : currentPrice
          } else {
            row[date] = currentPrice
          }
        } else {
          row[date] = 'N/A'
        }
      })
      transposedExportData.push(row)
    })

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `stock_data_${timestamp}`

    if (format === 'excel') {
      // Create Excel workbook
      const wb = XLSX.utils.book_new()

      // Process data for Excel with actual red text formatting
      const excelData = transposedExportData.map(row => {
        const newRow: any = {}
        Object.keys(row).forEach(key => {
          const value = row[key]
          if (typeof value === 'string' && value.startsWith('[RED]')) {
            newRow[key] = parseFloat(value.replace('[RED]', ''))
          } else {
            newRow[key] = value
          }
        })
        return newRow
      })

      // Main sheet with transposed data (stocks as rows, dates as columns)
      const ws1 = XLSX.utils.json_to_sheet(excelData)

      // Apply red color styling to cells that had [RED] markers
      const range = XLSX.utils.decode_range(ws1['!ref'] || 'A1')

      // Track which cells should be red
      const redCells: string[] = []

      transposedExportData.forEach((row, rowIndex) => {
        Object.keys(row).forEach((key, colIndex) => {
          if (key !== 'Symbol') {
            const value = row[key]
            if (typeof value === 'string' && value.startsWith('[RED]')) {
              const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
              redCells.push(cellAddress)
            }
          }
        })
      })

      // Apply red color styling
      if (!ws1['!cols']) ws1['!cols'] = []
      if (!ws1['!rows']) ws1['!rows'] = []

      // Add cell styles for red text
      redCells.forEach(cellAddress => {
        if (ws1[cellAddress]) {
          ws1[cellAddress].s = {
            font: {
              color: { rgb: "FF0000" } // Red color
            }
          }
        }
      })

      XLSX.utils.book_append_sheet(wb, ws1, 'Historical Prices')

      // Generate Excel file with styling support
      const excelBuffer = XLSX.write(wb, {
        type: 'buffer',
        bookType: 'xlsx',
        Props: {
          Title: 'Stock Price Data with Color Coding'
        }
      })

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        },
      })
    } else {
      // CSV format - keep the [RED] markers for potential processing
      const csv = Papa.unparse(transposedExportData)

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      })
    }
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}