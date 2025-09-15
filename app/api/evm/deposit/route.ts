import { NextRequest, NextResponse } from 'next/server'
import { depositToZeta } from '@/lib/zetachain'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { originChain, amount, receiver, token, mnemonicPhrase, network, rpc, types, values } = body || {}

    if (!originChain || !amount || !receiver || !mnemonicPhrase || !network) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const tx = await depositToZeta({ originChain, amount, receiver, token, mnemonicPhrase, network, rpc })
    return NextResponse.json({ hash: tx.hash })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to submit tx' }, { status: 500 })
  }
}


