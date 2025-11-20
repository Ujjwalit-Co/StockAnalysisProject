import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const beforeDate = searchParams.get('before')

    if (!beforeDate) {
      return NextResponse.json({ error: 'before parameter is required' }, { status: 400 })
    }

    // Parse the date
    const cutoffDate = new Date(beforeDate)
    if (isNaN(cutoffDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    // Delete old historical data
    const deleteResult = await db.stockPrice.deleteMany({
      where: {
        date: {
          lt: cutoffDate
        }
      }
    })

    console.log(`Deleted ${deleteResult.count} historical records older than ${beforeDate}`)

    return NextResponse.json({
      success: true,
      deleted: deleteResult.count,
      cutoffDate: beforeDate
    })

  } catch (error) {
    console.error('Error during data cleanup:', error)
    return NextResponse.json({ error: 'Failed to cleanup data' }, { status: 500 })
  }
}
