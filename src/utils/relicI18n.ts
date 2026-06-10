import type { RelicTier, RewardRarity } from '../types'

export const TIER_ZH: Record<RelicTier, string> = {
  Lith: '古纪',
  Meso: '前纪',
  Neo: '中纪',
  Axi: '后纪',
  Requiem: '安魂',
}

export const RARITY_ZH: Record<RewardRarity, string> = {
  Common: '普通',
  Uncommon: '非凡',
  Rare: '稀有',
}

export function tierToZh(tier: RelicTier): string {
  return TIER_ZH[tier]
}

export function rarityToZh(rarity: RewardRarity | string): string {
  return RARITY_ZH[rarity as RewardRarity] ?? rarity
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
