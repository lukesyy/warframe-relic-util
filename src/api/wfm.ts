import type { WfmItemRecord } from '../types'

const BASE = import.meta.env.DEV
  ? '/api/wfm/v2'
  : 'https://api.warframe.market/v2'
const HEADERS = {
  Language: 'zh-hans',
  Platform: 'pc',
}

interface WfmItemsResponse {
  data: Array<{
    slug: string
    tags: string[]
    i18n: {
      en: { name: string }
      'zh-hans'?: { name: string }
    }
  }>
}

interface WfmTopOrdersResponse {
  data: {
    sell: Array<{ platinum: number; visible: boolean }>
  }
}

async function wfmFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS })
  if (!res.ok) {
    throw new Error(`WFM API error ${res.status}: ${path}`)
  }
  return res.json() as Promise<T>
}

export async function fetchAllItems(): Promise<WfmItemRecord[]> {
  const body = await wfmFetch<WfmItemsResponse>('/items')
  return body.data.map((item) => ({
    slug: item.slug,
    nameEn: item.i18n.en.name,
    nameZh: item.i18n['zh-hans']?.name ?? item.i18n.en.name,
    tags: item.tags,
  }))
}

export async function fetchLowestSellPrice(slug: string): Promise<number | null> {
  const body = await wfmFetch<WfmTopOrdersResponse>(`/orders/item/${slug}/top`)
  const sell = body.data.sell?.filter((o) => o.visible) ?? []
  if (sell.length === 0) return null
  return sell[0].platinum
}

export function buildNameToSlugMap(items: WfmItemRecord[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of items) {
    map.set(item.nameEn, item.slug)
  }
  return map
}
