import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_NICE_PAY_CLIENT_ID ?? ''
  return NextResponse.json({ clientId })
}
