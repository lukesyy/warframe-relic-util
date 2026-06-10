import Dexie, { type Table } from 'dexie'
import type { PriceRecord, RelicRecord, WfmItemRecord } from '../types'

interface MetaRecord {
  key: string
  value: string
  at: number
}

class WfRelicDB extends Dexie {
  items!: Table<WfmItemRecord, string>
  prices!: Table<PriceRecord, string>
  relics!: Table<RelicRecord, string>
  meta!: Table<MetaRecord, string>

  constructor() {
    super('wfRelicScanner')
    this.version(1).stores({
      items: 'slug',
      prices: 'slug',
      relics: 'key',
      meta: 'key',
    })
  }
}

export const db = new WfRelicDB()

export async function getMeta(key: string): Promise<string | null> {
  const row = await db.meta.get(key)
  return row?.value ?? null
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value, at: Date.now() })
}
