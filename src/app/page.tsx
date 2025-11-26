'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Plus, TrendingUp, TrendingDown, Download, RefreshCw, ExternalLink, Trash2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

interface Stock {
  symbol: string
  name: string
  sector?: string
  industry?: string
  marketCap?: number
  currency?: string
  exchange?: string
  currentPrice?: number
  previousClose?: number
  change?: number
  changePercent?: number
  volume?: number
  dayHigh?: number
  dayLow?: number
  week52High?: number
  week52Low?: number
  currentPriceDate?: string
  historical?: {
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
    adjClose?: number
  }[]
}

interface StockMatrixData {
  [stockSymbol: string]: {
    [date: string]: {
      price: number
      change?: number
      changePercent?: number
    }
  }
}

export default function StockComparisonDashboard() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [symbolSearchTerm, setSymbolSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isAddStockDialogOpen, setIsAddStockDialogOpen] = useState(false)
  const [newStockSymbol, setNewStockSymbol] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [stockMatrix, setStockMatrix] = useState<StockMatrixData>({})
  const [showMatrix, setShowMatrix] = useState(true)
  const [sortOrder, setSortOrder] = useState('high-to-low')
  const [minPrice, setMinPrice] = useState('')

  // Fetch stocks from API
  const fetchStocks = async (force = false) => {
    try {
      setIsInitialLoading(true)

      if (force) {
        // Trigger background refresh and wait for it to complete
        await fetch('/api/cron/daily-stock-update')
      }

      const response = await fetch('/api/stocks')
      if (response.ok) {
        const data = await response.json()
        setStocks(data)
        // Build matrix data
        buildStockMatrix(data)
      } else {
        toast.error('Failed to fetch stocks')
      }
    } catch (error) {
      console.error('Error fetching stocks:', error)
      toast.error('Error fetching stocks')
    } finally {
      setIsInitialLoading(false)
    }
  }

  // Build stock matrix data
  const buildStockMatrix = (stockList: Stock[]) => {
    const matrix: StockMatrixData = {}

    stockList.forEach(stock => {
      if (!matrix[stock.symbol]) {
        matrix[stock.symbol] = {}
      }

      // Ensure historical data is sorted by date ascending for correct change calculation
      const sortedHistorical = stock.historical?.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []

      for (let i = 0; i < sortedHistorical.length; i++) {
        const currentPriceData = sortedHistorical[i]
        const previousPriceData = sortedHistorical[i - 1]

        const date = new Date(currentPriceData.date).toISOString().split('T')[0]

        const change = previousPriceData ? currentPriceData.close - previousPriceData.close : 0
        const changePercent = previousPriceData && previousPriceData.close > 0
          ? ((currentPriceData.close - previousPriceData.close) / previousPriceData.close) * 100
          : 0

        matrix[stock.symbol][date] = {
          price: currentPriceData.close,
          change: change,
          changePercent: changePercent
        }
      }
    })

    setStockMatrix(matrix)
  }  // Search for stock symbols
  const searchStocks = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
        if (data.length === 0) {
          toast.info('No Indian stocks found for this search term')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to search stocks. Please try again.')
        setSearchResults([])
      }
    } catch (error) {
      console.error('Error searching stocks:', error)
      toast.error('Network error while searching. Please check your connection.')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Remove stock
  const removeStock = async (symbol: string) => {
    try {
      const response = await fetch(`/api/stocks/${symbol}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success(`${symbol} removed from watchlist`)
        fetchStocks()
      } else {
        toast.error('Failed to remove stock')
      }
    } catch (error) {
      console.error('Error removing stock:', error)
      toast.error('Error removing stock')
    }
  }

  // Add stock
  const handleAddStock = async (symbol: string) => {
    if (!symbol.trim()) {
      toast.error('Please select a stock')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/yahoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      })

      if (response.ok) {
        const stockData = await response.json()

        toast.success(`${stockData.symbol} added to watchlist`)
        setNewStockSymbol('')
        setSymbolSearchTerm('')
        setSearchResults([])
        setIsAddStockDialogOpen(false)
        fetchStocks()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to fetch stock data')
      }
    } catch (error) {
      console.error('Error adding stock:', error)
      toast.error('Failed to add stock')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectSearchResult = (result: any) => {
    setNewStockSymbol(result.symbol)
    setSymbolSearchTerm('')
    setSearchResults([])
    handleAddStock(result.symbol)
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // Get sorted dates for columns, filtering out weekends
  const getSortedDates = () => {
    const allDates = new Set<string>()
    Object.values(stockMatrix).forEach(stockData => {
      Object.keys(stockData).forEach(date => allDates.add(date))
    })

    const tradingDates = Array.from(allDates).filter(dateString => {
      const date = new Date(dateString)
      const day = date.getDay() // Sunday - 0, Monday - 1, ..., Saturday - 6
      return day !== 0 && day !== 6 // Exclude Sunday (0) and Saturday (6)
    })

    return tradingDates.sort().reverse().slice(0, 30) // Show last 30 trading dates
  }

  // Get cell color based on change
  const getCellColor = (change?: number) => {
    if (!change) return ''
    return change >= 0 ? 'text-green-600' : 'text-red-600'
  }

  // Get cell background based on change
  const getCellBg = (change?: number) => {
    if (!change) return ''
    return change >= 0 ? 'bg-green-50' : 'bg-red-50'
  }

  useEffect(() => {
    fetchStocks()
  }, [])

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex space-x-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-16" />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchStocks(symbolSearchTerm)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [symbolSearchTerm])

  const dates = getSortedDates()
  const filteredStocks = stocks
    .filter(stock => {
      const matchesSearch = stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesPrice = minPrice ? (stock.currentPrice || 0) >= parseFloat(minPrice) : true
      return matchesSearch && matchesPrice
    })
    .sort((a, b) => {
      const priceA = a.currentPrice || 0
      const priceB = b.currentPrice || 0
      return sortOrder === 'high-to-low' ? priceB - priceA : priceA - priceB
    })

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <Skeleton className="h-9 w-64 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <LoadingSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Indian Stock LTP Matrix
            </h1>
            <p className="text-muted-foreground">Real-time stock prices with Last Trading Price (LTP) in Indian Rupees</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Live Data</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>{stocks.length} Stocks</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsLoading(true)
                fetchStocks(true).finally(() => setIsLoading(false))
              }}
              disabled={isLoading}
              className="hover:bg-blue-50 hover:border-blue-200"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMatrix(!showMatrix)}
              className="hover:bg-purple-50 hover:border-purple-200"
            >
              {showMatrix ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showMatrix ? 'Hide Matrix' : 'Show Matrix'}
            </Button>
            <Dialog open={isAddStockDialogOpen} onOpenChange={setIsAddStockDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stock
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Stock to Watchlist</DialogTitle>
                  <DialogDescription>
                    Search for Indian stocks by name or symbol
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search stocks (e.g., Reliance, TCS, INFY)..."
                      value={symbolSearchTerm}
                      onChange={(e) => setSymbolSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Search Results */}
                  {isSearching ? (
                    <div className="max-h-60 overflow-y-auto border rounded-md">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="p-3 border-b last:border-b-0">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-20" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                            <Skeleton className="h-5 w-12" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto border rounded-md">
                      {searchResults.map((result, index) => (
                        <div
                          key={index}
                          className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                          onClick={() => handleSelectSearchResult(result)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{result.symbol}</div>
                              <div className="text-sm text-muted-foreground">{result.name}</div>
                            </div>
                            <div className="text-right">
                              <Badge variant="secondary">{result.exchange}</Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : symbolSearchTerm.length >= 2 && !isSearching ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No Indian stocks found for "{symbolSearchTerm}"</p>
                      <p className="text-sm mt-1">Try a different search term or check the symbol format</p>
                    </div>
                  ) : null}

                  {/* Symbol Finder Link */}
                  <div className="text-sm text-muted-foreground">
                    <span>Can't find your stock? </span>
                    <a
                      href="https://finance.yahoo.com/lookup/india?s=.NS"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      Find symbols here <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Manual Input Option */}
                  <div className="text-sm text-muted-foreground">
                    Or enter symbol manually (NSE format without .NS):
                  </div>
                  <Input
                    placeholder="e.g., RELIANCE, TCS, INFY"
                    value={newStockSymbol}
                    onChange={(e) => setNewStockSymbol(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddStock(newStockSymbol)}
                  />

                  <Button
                    onClick={() => handleAddStock(newStockSymbol)}
                    disabled={isLoading || !newStockSymbol.trim()}
                    className="w-full"
                  >
                    {isLoading ? 'Adding...' : 'Add Stock'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stocks</CardTitle>
              <div className="h-4 w-4 rounded-full bg-blue-100 flex items-center justify-center">
                <TrendingUp className="h-3 w-3 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stocks.length}</div>
              <p className="text-xs text-muted-foreground">In watchlist</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
              <div className="h-4 w-4 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-3 w-3 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stocks.reduce((sum, stock) => sum + (stock.currentPrice || 0), 0))}
              </div>
              <p className="text-xs text-muted-foreground">Current market value</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Gainer</CardTitle>
              <div className="h-4 w-4 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-3 w-3 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const topGainer = stocks.reduce((max, stock) =>
                  (stock.changePercent || 0) > (max?.changePercent || 0) ? stock : max
                  , stocks[0])
                return topGainer ? (
                  <div>
                    <div className="text-lg font-bold text-green-600">{topGainer.symbol}</div>
                    <p className="text-xs text-muted-foreground">+{topGainer.changePercent?.toFixed(2)}%</p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No data</div>
                )
              })()}
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Loser</CardTitle>
              <div className="h-4 w-4 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingDown className="h-3 w-3 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const topLoser = stocks.reduce((min, stock) =>
                  (stock.changePercent || 0) < (min?.changePercent || 0) ? stock : min
                  , stocks[0])
                return topLoser ? (
                  <div>
                    <div className="text-lg font-bold text-red-600">{topLoser.symbol}</div>
                    <p className="text-xs text-muted-foreground">{topLoser.changePercent?.toFixed(2)}%</p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No data</div>
                )
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stocks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="w-full sm:w-[200px]">
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high-to-low">Price: High to Low</SelectItem>
                <SelectItem value="low-to-high">Price: Low to High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[200px]">
            <Input
              type="number"
              placeholder="Min Price (LTP)"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>
        </div>

        {/* Stock Matrix Table */}
        {showMatrix && (
          <Card className="shadow-lg border-0 bg-linear-to-br from-white to-gray-50/50">
            <CardHeader className="bg-linear-to-r from-blue-50 to-purple-50 border-b">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                    Stock Price Matrix (LTP in ₹)
                  </CardTitle>
                  <CardDescription className="text-base">
                    Last Trading Prices for your watchlist stocks. Compare performance across dates.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded-full">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-green-700 font-medium">Gain</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded-full">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-red-700 font-medium">Loss</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    {dates.length} Trading Days
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2">
                      <TableHead className="w-20 font-semibold sticky left-0 bg-background z-10">Symbol</TableHead>
                      <TableHead className="w-40 font-semibold sticky left-20 bg-background z-10">Company</TableHead>
                      {dates.map(date => (
                        <TableHead key={date} className="text-center min-w-28 font-semibold">
                          <div className="text-xs font-medium">{new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</div>
                          <div className="text-xs text-muted-foreground">LTP (₹)</div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center w-20 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStocks.map((stock, index) => (
                      <TableRow key={stock.symbol} className={`hover:bg-muted/50 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                        <TableCell className="font-mono font-semibold sticky left-0 bg-inherit z-10">
                          <div className="flex flex-col">
                            <span className="text-sm">{stock.symbol}</span>
                            <Badge variant="secondary" className="text-xs w-fit mt-1">
                              {stock.exchange || 'NSE'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-40 sticky left-20 bg-inherit z-10">
                          <div className="truncate text-sm font-medium" title={stock.name}>
                            {stock.name}
                          </div>
                        </TableCell>
                        {dates.map(date => {
                          const stockData = stockMatrix[stock.symbol]?.[date]
                          return (
                            <TableCell key={date} className="text-center min-w-28">
                              {stockData ? (
                                <div className={`p-2 rounded-md ${getCellBg(stockData.change)} border`}>
                                  <div className={`font-mono text-sm font-semibold ${getCellColor(stockData.change)}`}>
                                    {formatCurrency(stockData.price)}
                                  </div>
                                  <div className={`text-xs mt-1 ${getCellColor(stockData.change)}`}>
                                    {stockData.change && stockData.change >= 0 ? '+' : ''}{stockData.change?.toFixed(2)}
                                    <br />
                                    ({stockData.changePercent?.toFixed(2)}%)
                                  </div>
                                </div>
                              ) : (
                                <div className="text-muted-foreground text-sm">-</div>
                              )}
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStock(stock.symbol)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredStocks.length === 0 && (
                <div className="text-center py-16 px-4">
                  <div className="max-w-md mx-auto">
                    <div className="relative mb-6">
                      <div className="w-20 h-20 bg-linear-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <TrendingUp className="h-10 w-10 text-blue-600" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                        <Plus className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-3 bg-linear-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                      Start Your Investment Journey
                    </h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Your watchlist is empty. Add some Indian stocks to track their Last Trading Prices and compare performance across trading days.
                    </p>
                    <div className="space-y-3">
                      <Button
                        onClick={() => setIsAddStockDialogOpen(true)}
                        size="lg"
                        className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        Add Your First Stock
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        Popular stocks: RELIANCE, TCS, HDFCBANK, INFY
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Export Options */}
        <Card className="bg-linear-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Download className="h-5 w-5 text-green-600" />
                  Export Your Data
                </h3>
                <p className="text-sm text-muted-foreground">
                  Download historical price data as CSV or Excel. Uses stored data for efficiency and reliability.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/api/export?format=csv`, '_blank')}
                  className="hover:bg-green-50 hover:border-green-300 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/api/export?format=excel`, '_blank')}
                  className="hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}