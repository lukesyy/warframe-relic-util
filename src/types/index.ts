export type RelicTier = 'Lith' | 'Meso' | 'Neo' | 'Axi' | 'Requiem'
export type RewardRarity = 'Common' | 'Uncommon' | 'Rare'
export type MatchMode = 'rare_only' | 'any' | 'highest'
export type QueryMode = 'price_range' | 'by_item' | 'ranking' | 'item_value'

export interface RelicReward {
  itemName: string
  rarity: RewardRarity
  chance: number
}

export interface RelicRecord {
  key: string
  tier: RelicTier
  relicName: string
  state: string
  rewards: RelicReward[]
}

export interface WfmItemRecord {
  slug: string
  nameEn: string
  nameZh: string
  tags: string[]
}

export interface PriceRecord {
  slug: string
  itemName: string
  lowestSell: number | null
  updatedAt: number
}

export interface MatchedReward {
  itemName: string
  itemNameZh: string
  rarity: RewardRarity
  chance: number
  price: number | null
}

export interface SearchResult {
  key: string
  tier: RelicTier
  tierZh: string
  relicName: string
  displayName: string
  matchedRewards: MatchedReward[]
  allRewards?: MatchedReward[]
  bestPrice: number | null
}

export interface ItemRelicEntry {
  key: string
  tier: RelicTier
  tierZh: string
  relicName: string
  displayName: string
  rarity: RewardRarity
  chance: number
  allRewards: MatchedReward[]
}

export interface ItemCentricResult {
  itemName: string
  itemNameZh: string
  price: number | null
  relics: ItemRelicEntry[]
}

export interface RelicRankingResult {
  key: string
  tier: RelicTier
  tierZh: string
  relicName: string
  displayName: string
  expectedValue: number
  bestReward: MatchedReward | null
  allRewards: MatchedReward[]
}

export interface ItemSearchMeta {
  itemName: string
  itemNameZh: string
  price: number | null
}

export interface ItemSearchParams {
  itemKeyword: string
  minPrice: number
  maxPrice: number
  tier?: RelicTier | ''
}

export interface SearchParams {
  minPrice: number
  maxPrice: number
  tier?: RelicTier | ''
  mode: MatchMode
  itemKeyword?: string
}

export interface RefreshProgress {
  current: number
  total: number
  itemName: string
}

export interface RelicsJson {
  relics: Array<{
    tier: RelicTier
    relicName: string
    state: string
    rewards: RelicReward[]
  }>
}
