import type { RelicState, RelicTier, RewardRarity } from '../types'

export const TIER_ZH: Record<RelicTier, string> = {
  Lith: '古纪',
  Meso: '前纪',
  Neo: '中纪',
  Axi: '后纪',
  Requiem: '安魂',
}

export const STATE_ZH: Record<RelicState, string> = {
  Intact: '完整',
  Exceptional: '非凡',
  Flawless: '无瑕',
  Radiant: '光辉',
}

export const RARITY_ZH: Record<RewardRarity, string> = {
  Common: '普通',
  Uncommon: '非凡',
  Rare: '稀有',
}

export function tierToZh(tier: RelicTier): string {
  return TIER_ZH[tier]
}

export function stateToZh(state: RelicState | string): string {
  return STATE_ZH[state as RelicState] ?? state
}

export function rarityToZh(rarity: RewardRarity | string): string {
  return RARITY_ZH[rarity as RewardRarity] ?? rarity
}

/** 根据光辉状态掉率推算稀有度 */
export function rarityFromChance(chance: number): RewardRarity {
  if (chance <= 12) return 'Rare'
  if (chance <= 18) return 'Common'
  return 'Uncommon'
}

export function formatRelicDisplayName(tier: RelicTier, relicName: string): string {
  return `${TIER_ZH[tier]} ${relicName} 遗物`
}

export const TIER_OPTIONS = [
  { label: '全部', value: '' as const },
  { label: '古纪', value: 'Lith' as const },
  { label: '前纪', value: 'Meso' as const },
  { label: '中纪', value: 'Neo' as const },
  { label: '后纪', value: 'Axi' as const },
  { label: '安魂', value: 'Requiem' as const },
]

export const STATE_OPTIONS = [
  { label: '光辉', value: 'Radiant' as const },
  { label: '无瑕', value: 'Flawless' as const },
  { label: '非凡', value: 'Exceptional' as const },
  { label: '完整', value: 'Intact' as const },
]
