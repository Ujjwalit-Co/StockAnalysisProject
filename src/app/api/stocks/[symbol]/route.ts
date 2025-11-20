import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params
    const upperSymbol = symbol.toUpperCase()

    // Check if stock exists
    const stock = await db.stock.findUnique({
      where: { symbol: upperSymbol }
    })

    if (!stock) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
    }

    // Delete stock and all related data
    await db.stock.delete({
      where: { symbol: upperSymbol }
    })

    return NextResponse.json({ message: 'Stock deleted successfully' })
  } catch (error) {
    console.error('Error deleting stock:', error)
    return NextResponse.json({ error: 'Failed to delete stock' }, { status: 500 })
  }
}