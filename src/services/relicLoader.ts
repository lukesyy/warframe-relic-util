import { fetchAllItems } from '../api/wfm'
import { db } from '../db'
import type { RelicRecord, RelicsJson } from '../types'

function relicKey(tier: string, relicName: string): string {
  return `${tier} ${relicName}`
}

export async function loadRelicsIntoDb(forceReload = false): Promise<number> {
  if (!forceReload) {
    const existing = await db.relics.count()
    if (existing > 0) return existing
  } else {
    await db.relics.clear()
  }

  const res = await fetch('/relics.json')
  const data = (await res.json()) as RelicsJson

  // 只加载光辉 (Radiant) 状态的遗物
  const records: RelicRecord[] = data.relics
    .filter((r) => r.state === 'Radiant')
    .map((r) => ({
      key: relicKey(r.tier, r.relicName),
      tier: r.tier,
      relicName: r.relicName,
      state: r.state,
      rewards: r.rewards,
    }))

  await db.relics.bulkPut(records)
  return records.length
}

export async function loadWfmItemsIntoDb(forceReload = false): Promise<number> {
  if (!forceReload) {
    const existing = await db.items.count()
    if (existing > 0) return existing
  } else {
    await db.items.clear()
  }

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
