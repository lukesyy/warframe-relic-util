import { buildNameToSlugMap, fetchAllItems, fetchLowestSellPrice } from '../api/wfm'
import { db, getMeta, setMeta } from '../db'
import { invalidateItemIndex } from './itemIndex'
import type { PriceRecord, RefreshProgress } from '../types'
import { getUniqueRewardNames } from './relicLoader'

const CONCURRENCY = 6
const DELAY_MS = 120

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function refreshPrices(
  onProgress?: (progress: RefreshProgress) => void,
): Promise<void> {
  const relics = await db.relics.toArray()
  const rewardNames = getUniqueRewardNames(relics)

  let items = await db.items.toArray()
  if (items.length === 0) {
    items = await fetchAllItems()
    await db.items.bulkPut(items)
  }

  const nameToSlug = buildNameToSlugMap(items)
  const tasks: Array<{ itemName: string; slug: string }> = []

  for (const name of rewardNames) {
    const slug = nameToSlug.get(name)
    if (slug) tasks.push({ itemName: name, slug })
  }

  const total = tasks.length
  let current = 0

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async ({ itemName, slug }) => {
        current += 1
        onProgress?.({ current, total, itemName })

        let lowestSell: number | null = null
        try {
          lowestSell = await fetchLowestSellPrice(slug)
        } catch {
          lowestSell = null
        }

        const record: PriceRecord = {
          slug,
          itemName,
          lowestSell,
          updatedAt: Date.now(),
        }
        await db.prices.put(record)
      }),
    )
    if (i + CONCURRENCY < tasks.length) {
      await sleep(DELAY_MS)
    }
  }

  await setMeta('lastRefresh', new Date().toISOString())
  invalidateItemIndex()
}

export async function getLastRefreshTime(): Promise<string | null> {
  return getMeta('lastRefresh')
}

export async function getPriceCount(): Promise<number> {
  return db.prices.count()
}
