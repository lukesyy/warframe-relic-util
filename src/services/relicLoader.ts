import { fetchAllItems } from '../api/wfm'
import { db } from '../db'
import type { RelicRecord, RelicsJson } from '../types'

function relicKey(tier: string, relicName: string): string {
  return `${tier} ${relicName}`
}

export async function loadRelicsIntoDb(): Promise<number> {
  const existing = await db.relics.count()
  if (existing > 0) return existing

  const res = await fetch('/relics.json')
  const data = (await res.json()) as RelicsJson

  const records: RelicRecord[] = data.relics.map((r) => ({
    key: relicKey(r.tier, r.relicName),
    tier: r.tier,
    relicName: r.relicName,
    state: r.state,
    rewards: r.rewards,
  }))

  await db.relics.bulkPut(records)
  return records.length
}

export async function loadWfmItemsIntoDb(): Promise<number> {
  const existing = await db.items.count()
  if (existing > 0) return existing

  const items = await fetchAllItems()
  await db.items.bulkPut(items)
  return items.length
}

export function getUniqueRewardNames(relics: RelicRecord[]): string[] {
  const names = new Set<string>()
  for (const relic of relics) {
    for (const reward of relic.rewards) {
      names.add(reward.itemName)
    }
  }
  return [...names]
}
