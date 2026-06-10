import { db } from '../db'
import type {
  ItemCentricResult,
  ItemRelicEntry,
  ItemSearchMeta,
  ItemSearchParams,
  MatchedReward,
  RelicRankingResult,
  RelicRecord,
  RelicTier,
  SearchParams,
  SearchResult,
  WfmItemRecord,
} from '../types'
import { formatRelicDisplayName, rarityFromChance, tierToZh } from '../utils/relicI18n'

const TIER_ORDER: Record<string, number> = {
  Lith: 0,
  Meso: 1,
  Neo: 2,
  Axi: 3,
  Requiem: 4,
}

function inRange(price: number, min: number, max: number): boolean {
  return price >= min && price <= max
}

function matchesItemKeyword(
  itemName: string,
  itemNameZh: string,
  keyword: string,
): boolean {
  const k = keyword.toLowerCase()
  return itemName.toLowerCase().includes(k) || itemNameZh.toLowerCase().includes(k)
}

function filterHitsByKeyword(hits: MatchedReward[], keyword?: string): MatchedReward[] {
  const trimmed = keyword?.trim()
  if (!trimmed) return hits
  return hits.filter((h) => matchesItemKeyword(h.itemName, h.itemNameZh, trimmed))
}

function getPriceMap(tier = 0): Promise<Map<string, number>> {
  return db.prices.toArray().then((rows) => {
    const map = new Map<string, number>()
    for (const row of rows) {
      const prices = row.sellPrices ?? (row.lowestSell != null ? [row.lowestSell] : [])
      const price = prices[tier]
      if (price != null) {
        map.set(row.itemName, price)
      }
    }
    return map
  })
}

async function getItemNameZhMap(): Promise<Map<string, string>> {
  const items = await db.items.toArray()
  const map = new Map<string, string>()
  for (const item of items) {
    map.set(item.nameEn, item.nameZh)
  }
  return map
}

function toMatchedReward(
  reward: RelicRecord['rewards'][0],
  priceMap: Map<string, number>,
  nameZhMap: Map<string, string>,
): MatchedReward {
  return {
    itemName: reward.itemName,
    itemNameZh: nameZhMap.get(reward.itemName) ?? reward.itemName,
    rarity: rarityFromChance(reward.chance),
    chance: reward.chance,
    price: priceMap.get(reward.itemName) ?? null,
  }
}

function bestPriceFromHits(hits: MatchedReward[]): number | null {
  const prices = hits.map((h) => h.price).filter((p): p is number => p != null)
  if (prices.length === 0) return null
  return Math.max(...prices)
}

function buildResult(relic: RelicRecord, hits: MatchedReward[], allRewards?: MatchedReward[]): SearchResult {
  return {
    key: relic.key,
    tier: relic.tier,
    tierZh: tierToZh(relic.tier),
    relicName: relic.relicName,
    displayName: formatRelicDisplayName(relic.tier, relic.relicName),
    matchedRewards: hits.sort((a, b) => (b.price ?? 0) - (a.price ?? 0)),
    allRewards,
    bestPrice: bestPriceFromHits(hits),
  }
}

function matchRelic(
  relic: RelicRecord,
  priceMap: Map<string, number>,
  nameZhMap: Map<string, string>,
  params: SearchParams,
): SearchResult | null {
  if (params.mode === 'highest') {
    const priced = relic.rewards
      .map((reward) => ({ reward, price: priceMap.get(reward.itemName) }))
      .filter((x): x is { reward: (typeof relic.rewards)[0]; price: number } => x.price != null)

    if (priced.length === 0) return null

    const maxPrice = Math.max(...priced.map((x) => x.price))
    if (!inRange(maxPrice, params.minPrice, params.maxPrice)) return null

    const topHits = filterHitsByKeyword(
      priced
        .filter((x) => x.price === maxPrice)
        .map((x) => toMatchedReward(x.reward, priceMap, nameZhMap)),
      params.itemKeyword,
    )

    if (topHits.length === 0) return null
    return buildResult(relic, topHits)
  }

  const hits: MatchedReward[] = []
  for (const reward of relic.rewards) {
    const price = priceMap.get(reward.itemName)
    if (price == null || !inRange(price, params.minPrice, params.maxPrice)) {
      continue
    }
    if (params.mode === 'rare_only' && reward.rarity !== 'Rare') {
      continue
    }
    hits.push(toMatchedReward(reward, priceMap, nameZhMap))
  }

  const filtered = filterHitsByKeyword(hits, params.itemKeyword)
  if (filtered.length === 0) return null
  return buildResult(relic, filtered)
}

export async function searchRelics(params: SearchParams): Promise<SearchResult[]> {
  const [priceMap, nameZhMap] = await Promise.all([getPriceMap(params.priceTier ?? 0), getItemNameZhMap()])
  if (priceMap.size === 0) return []

  let relics = await db.relics.toArray()
  if (params.tier) {
    relics = relics.filter((r) => r.tier === params.tier)
  }

  const results: SearchResult[] = []
  for (const relic of relics) {
    const hit = matchRelic(relic, priceMap, nameZhMap, params)
    if (hit) results.push(hit)
  }

  return results.sort((a, b) => (a.bestPrice ?? 0) - (b.bestPrice ?? 0))
}

function resolveTargetItemNames(
  keyword: string,
  items: WfmItemRecord[],
  nameZhMap: Map<string, string>,
): Set<string> {
  const k = keyword.trim().toLowerCase()
  const names = new Set<string>()

  for (const item of items) {
    if (item.nameEn.toLowerCase().includes(k) || item.nameZh.toLowerCase().includes(k)) {
      names.add(item.nameEn)
    }
  }

  if (names.size === 0) {
    for (const [en, zh] of nameZhMap) {
      if (en.toLowerCase().includes(k) || zh.toLowerCase().includes(k)) {
        names.add(en)
      }
    }
  }

  return names
}


export async function searchRelicsByItem(
  params: ItemSearchParams,
): Promise<{ results: ItemCentricResult[]; meta: ItemSearchMeta | null }> {
  const keyword = params.itemKeyword.trim()

  const [priceMap, nameZhMap, items, relicsAll] = await Promise.all([
    getPriceMap(params.priceTier ?? 0),
    getItemNameZhMap(),
    db.items.toArray(),
    db.relics.toArray(),
  ])

  let meta: ItemSearchMeta | null = null
  const inRangeNames = new Set<string>()

  if (!keyword) {
    for (const [name, price] of priceMap) {
      if (inRange(price, params.minPrice, params.maxPrice)) {
        inRangeNames.add(name)
      }
    }
  } else {
    const targetNames = resolveTargetItemNames(keyword, items, nameZhMap)
    if (targetNames.size === 0) return { results: [], meta: null }

    const primaryName = [...targetNames][0]!
    meta = {
      itemName: primaryName,
      itemNameZh: nameZhMap.get(primaryName) ?? primaryName,
      price: priceMap.get(primaryName) ?? null,
    }

    for (const name of targetNames) {
      const price = priceMap.get(name)
      if (price != null && inRange(price, params.minPrice, params.maxPrice)) {
        inRangeNames.add(name)
      }
    }
  }

  if (inRangeNames.size === 0) return { results: [], meta }

  let relics = relicsAll
  if (params.tier) {
    relics = relics.filter((r) => r.tier === params.tier)
  }

  const itemRelicMap = new Map<string, ItemRelicEntry[]>()

  for (const relic of relics) {
    for (const reward of relic.rewards) {
      if (!inRangeNames.has(reward.itemName)) continue
      let entries = itemRelicMap.get(reward.itemName)
      if (!entries) {
        entries = []
        itemRelicMap.set(reward.itemName, entries)
      }
      entries.push({
        key: relic.key,
        tier: relic.tier,
        tierZh: tierToZh(relic.tier),
        relicName: relic.relicName,
        displayName: formatRelicDisplayName(relic.tier, relic.relicName),
        rarity: rarityFromChance(reward.chance),
        chance: reward.chance,
        allRewards: relic.rewards.map((r) => toMatchedReward(r, priceMap, nameZhMap)),
      })
    }
  }

  const results: ItemCentricResult[] = []
  for (const [itemName, relicEntries] of itemRelicMap) {
    relicEntries.sort((a, b) => {
      const tierDiff = (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99)
      if (tierDiff !== 0) return tierDiff
      return a.relicName.localeCompare(b.relicName, undefined, { numeric: true })
    })
    results.push({
      itemName,
      itemNameZh: nameZhMap.get(itemName) ?? itemName,
      price: priceMap.get(itemName) ?? null,
      relics: relicEntries,
    })
  }

  // 按价格从低到高排列
  results.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))

  return { results, meta }
}

export async function searchRelicRanking(
  params: { tier?: RelicTier | ''; priceTier?: number },
): Promise<RelicRankingResult[]> {
  const [priceMap, nameZhMap] = await Promise.all([getPriceMap(params.priceTier ?? 0), getItemNameZhMap()])

  let relics = await db.relics.toArray()
  if (params.tier) {
    relics = relics.filter((r) => r.tier === params.tier)
  }

  const results: RelicRankingResult[] = []
  for (const relic of relics) {
    const allRewards = relic.rewards.map((r) => toMatchedReward(r, priceMap, nameZhMap))
    const expectedValue = allRewards.reduce(
      (sum, r) => sum + (r.price ?? 0) * r.chance / 100,
      0,
    )
    if (expectedValue === 0) continue

    const bestReward = allRewards.reduce((best, r) => {
      const bestVal = (best.price ?? 0) * best.chance
      const rVal = (r.price ?? 0) * r.chance
      return rVal > bestVal ? r : best
    }, allRewards[0]!)

    results.push({
      key: relic.key,
      tier: relic.tier,
      tierZh: tierToZh(relic.tier),
      relicName: relic.relicName,
      displayName: formatRelicDisplayName(relic.tier, relic.relicName),
      expectedValue,
      bestReward,
      allRewards,
    })
  }

  return results.sort((a, b) => b.expectedValue - a.expectedValue)
}

export async function searchItemValues(
  params: { itemKeyword: string; tier?: RelicTier | ''; priceTier?: number },
): Promise<ItemCentricResult[]> {
  const keyword = params.itemKeyword.trim()

  const [priceMap, nameZhMap, items, relicsAll] = await Promise.all([
    getPriceMap(params.priceTier ?? 0),
    getItemNameZhMap(),
    db.items.toArray(),
    db.relics.toArray(),
  ])

  const targetNames = new Set<string>()

  if (!keyword) {
    // 空关键词：取价格最高的前 20 个有价格的物品
    const priced = [...priceMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
    for (const [name] of priced) {
      targetNames.add(name)
    }
  } else {
    // 按逗号分割，每个分段独立匹配，联合结果
    const segments = keyword.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    for (const seg of segments) {
      const resolved = resolveTargetItemNames(seg, items, nameZhMap)
      for (const name of resolved) {
        targetNames.add(name)
      }
    }
  }

  if (targetNames.size === 0) return []

  let relics = relicsAll
  if (params.tier) {
    relics = relics.filter((r) => r.tier === params.tier)
  }

  const itemRelicMap = new Map<string, ItemRelicEntry[]>()

  for (const relic of relics) {
    for (const reward of relic.rewards) {
      if (!targetNames.has(reward.itemName)) continue
      let entries = itemRelicMap.get(reward.itemName)
      if (!entries) {
        entries = []
        itemRelicMap.set(reward.itemName, entries)
      }
      entries.push({
        key: relic.key,
        tier: relic.tier,
        tierZh: tierToZh(relic.tier),
        relicName: relic.relicName,
        displayName: formatRelicDisplayName(relic.tier, relic.relicName),
        rarity: rarityFromChance(reward.chance),
        chance: reward.chance,
        allRewards: relic.rewards.map((r) => toMatchedReward(r, priceMap, nameZhMap)),
      })
    }
  }

  const results: ItemCentricResult[] = []
  for (const [itemName, relicEntries] of itemRelicMap) {
    relicEntries.sort((a, b) => {
      const tierDiff = (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99)
      if (tierDiff !== 0) return tierDiff
      return a.relicName.localeCompare(b.relicName, undefined, { numeric: true })
    })
    results.push({
      itemName,
      itemNameZh: nameZhMap.get(itemName) ?? itemName,
      price: priceMap.get(itemName) ?? null,
      relics: relicEntries,
    })
  }

  return results.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
}
