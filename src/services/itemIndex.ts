import { db } from '../db'
import { getUniqueRewardNames } from './relicLoader'

export interface ItemSuggestion {
  value: string
  label: string
  nameEn: string
  price: number | null
}

let cachedSuggestions: ItemSuggestion[] | null = null

export async function getAllItemOptions(): Promise<ItemSuggestion[]> {
  return buildSuggestionIndex()
}

export function invalidateItemIndex(): void {
  cachedSuggestions = null
}

async function buildSuggestionIndex(): Promise<ItemSuggestion[]> {
  if (cachedSuggestions) return cachedSuggestions

  const [relics, items, prices] = await Promise.all([
    db.relics.toArray(),
    db.items.toArray(),
    db.prices.toArray(),
  ])

  const nameZhMap = new Map(items.map((i) => [i.nameEn, i.nameZh]))
  const priceMap = new Map(
    prices.filter((p) => p.lowestSell != null).map((p) => [p.itemName, p.lowestSell!]),
  )

  const rewardNames = getUniqueRewardNames(relics)
  cachedSuggestions = rewardNames
    .map((nameEn) => {
      const nameZh = nameZhMap.get(nameEn) ?? nameEn
      return {
        value: nameZh,
        label: nameZh === nameEn ? nameEn : `${nameZh} (${nameEn})`,
        nameEn,
        price: priceMap.get(nameEn) ?? null,
      }
    })
    .sort((a, b) => a.value.localeCompare(b.value, 'zh-CN'))

  return cachedSuggestions
}

function matchScore(entry: ItemSuggestion, q: string): number {
  const zh = entry.value.toLowerCase()
  const en = entry.nameEn.toLowerCase()
  if (zh === q || en === q) return 100
  if (zh.startsWith(q) || en.startsWith(q)) return 80
  if (zh.includes(q) || en.includes(q)) return 60
  return 0
}

export interface SuggestionQueryOptions {
  minPrice?: number
  maxPrice?: number
  limit?: number
}

export async function queryItemSuggestions(
  query: string,
  options: SuggestionQueryOptions = {},
): Promise<ItemSuggestion[]> {
  const { minPrice, maxPrice, limit = 20 } = options
  const index = await buildSuggestionIndex()
  const q = query.trim().toLowerCase()

  let candidates = index

  if (!q) {
    if (minPrice != null && maxPrice != null && minPrice <= maxPrice) {
      candidates = index.filter(
        (e) => e.price != null && e.price >= minPrice && e.price <= maxPrice,
      )
    }
    return candidates.slice(0, limit)
  }

  return index
    .map((entry) => ({ entry, score: matchScore(entry, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.value.localeCompare(b.entry.value, 'zh-CN'))
    .slice(0, limit)
    .map((x) => x.entry)
}
