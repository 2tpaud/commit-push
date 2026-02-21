import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const ALLOWED_SLUGS: Record<string, string> = {
  architecture: 'ARCHITECTURE.md',
  database: 'DATABASE.md',
  design: 'DESIGN.md',
  plan: 'PLAN.md',
  product: 'PRODUCT.md',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const filename = ALLOWED_SLUGS[slug]
  if (!filename) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const docsDir = path.join(process.cwd(), 'docs')
    const filePath = path.join(docsDir, filename)
    const content = await readFile(filePath, 'utf-8')
    return NextResponse.json({ content })
  } catch (err) {
    console.error('Docs read error:', err)
    return NextResponse.json({ error: 'Failed to read document' }, { status: 500 })
  }
}
