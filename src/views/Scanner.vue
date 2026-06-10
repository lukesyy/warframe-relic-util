<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { queryItemSuggestions, getAllItemOptions, type ItemSuggestion } from '../services/itemIndex'
import { loadRelicsIntoDb, loadWfmItemsIntoDb } from '../services/relicLoader'
import { getLastRefreshTime, getPriceCount, refreshPrices } from '../services/priceRefresh'
import { searchRelics, searchRelicsByItem, searchRelicRanking, searchItemValues } from '../services/search'
import type { ItemCentricResult, ItemRelicEntry, ItemSearchMeta, MatchMode, RelicRankingResult, RelicTier, SearchResult } from '../types'
import { rarityToZh, TIER_OPTIONS } from '../utils/relicI18n'

// ── 通用状态 ──
const activeTab = ref('scanner')
const loading = ref(false)
const initLoading = ref(true)
const refreshing = ref(false)
const initialized = ref(false)
const relicCount = ref(0)
const priceCount = ref(0)
const lastRefresh = ref<string | null>(null)
const refreshProgress = ref({ current: 0, total: 0, itemName: '' })

const tierOptions = TIER_OPTIONS
const activeRelicKey = ref<string | null>(null)

// ── 遗物扫描 ──
const scanMode = ref<'price_range' | 'by_item'>('price_range')
const scanMinPrice = ref(30)
const scanMaxPrice = ref(40)
const scanTier = ref<RelicTier | ''>('')
const scanItemKeyword = ref('')
const scanResults = ref<SearchResult[]>([])
const scanItemResults = ref<ItemCentricResult[]>([])
const scanItemMeta = ref<ItemSearchMeta | null>(null)
const scanSearched = ref(false)

const isScanByItem = computed(() => scanMode.value === 'by_item')

// ── 遗物排行 ──
const rankTier = ref<RelicTier | ''>('')
const rankKeyword = ref('')
const rankResults = ref<RelicRankingResult[]>([])
const rankSearched = ref(false)

// ── 物品价值 ──
const valueSelected = ref<string[]>([])
const valueTier = ref<RelicTier | ''>('')
const valueResults = ref<ItemCentricResult[]>([])
const valueSearched = ref(false)
const valueItemOptions = ref<ItemSuggestion[]>([])
const filteredValueOptions = ref<ItemSuggestion[]>([])

async function loadValueOptions() {
  valueItemOptions.value = await getAllItemOptions()
  filteredValueOptions.value = [...valueItemOptions.value]
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    .slice(0, 20)
}

function handleValueFilter(query: string) {
  if (!query) {
    filteredValueOptions.value = [...valueItemOptions.value]
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
      .slice(0, 20)
    return
  }
  const q = query.toLowerCase()
  filteredValueOptions.value = valueItemOptions.value
    .filter((item) => item.value.toLowerCase().includes(q) || item.nameEn.toLowerCase().includes(q))
    .slice(0, 50)
}

// ── 通用方法 ──
function toggleRelicDetail(key: string) {
  activeRelicKey.value = activeRelicKey.value === key ? null : key
}

function getActiveRelic(row: ItemCentricResult): ItemRelicEntry | undefined {
  if (!activeRelicKey.value) return undefined
  return row.relics.find((r) => r.key === activeRelicKey.value)
}

function formatTime(iso: string | null): string {
  if (!iso) return '从未刷新'
  return new Date(iso).toLocaleString('zh-CN')
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—'
  return `${price}p`
}

function rarityTagType(rarity: string): '' | 'success' | 'warning' | 'danger' | 'info' {
  if (rarity === 'Rare') return 'danger'
  if (rarity === 'Uncommon') return 'warning'
  return 'info'
}

async function fetchItemSuggestions(
  query: string,
  cb: (results: ItemSuggestion[]) => void,
) {
  const parts = query.split(/[,，]/)
  const lastSegment = (parts[parts.length - 1] ?? '').trim()
  const prefix = parts.slice(0, -1).join(',')
  const suggestions = await queryItemSuggestions(lastSegment, {
    minPrice: scanMinPrice.value,
    maxPrice: scanMaxPrice.value,
  })
  if (prefix && suggestions.length > 0) {
    for (const s of suggestions) {
      s.value = prefix + ',' + s.value
    }
  }
  cb(suggestions)
}

// ── 初始化 ──
async function init() {
  initLoading.value = true
  try {
    relicCount.value = await loadRelicsIntoDb()
    await loadWfmItemsIntoDb()
    priceCount.value = await getPriceCount()
    lastRefresh.value = await getLastRefreshTime()
    initialized.value = true
    loadValueOptions()
  } catch (e) {
    ElMessage.error(`初始化失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    initLoading.value = false
  }
}

async function handleRefresh() {
  refreshing.value = true
  refreshProgress.value = { current: 0, total: 0, itemName: '' }
  try {
    relicCount.value = await loadRelicsIntoDb(true)
    await loadWfmItemsIntoDb(true)
    await refreshPrices((p) => {
      refreshProgress.value = p
    })
    priceCount.value = await getPriceCount()
    lastRefresh.value = await getLastRefreshTime()
    ElMessage.success('数据重载完成')
  } catch (e) {
    ElMessage.error(`重载失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    refreshing.value = false
  }
}

// ── 遗物扫描搜索 ──
async function handleScanSearch() {
  if (priceCount.value === 0) {
    ElMessage.warning('请先点击「数据重载」获取市场数据')
    return
  }
  if (scanMinPrice.value > scanMaxPrice.value) {
    ElMessage.warning('最低价不能大于最高价')
    return
  }

  loading.value = true
  scanSearched.value = true
  scanItemMeta.value = null
  scanResults.value = []
  scanItemResults.value = []
  try {
    if (isScanByItem.value) {
      const { results: rows, meta } = await searchRelicsByItem({
        itemKeyword: scanItemKeyword.value,
        minPrice: scanMinPrice.value,
        maxPrice: scanMaxPrice.value,
        tier: scanTier.value,
      })
      scanItemResults.value = rows
      scanItemMeta.value = meta
      if (rows.length === 0) {
        if (meta?.price != null && (meta.price < scanMinPrice.value || meta.price > scanMaxPrice.value)) {
          ElMessage.info(`物品市场价 ${meta.price}p 不在 ${scanMinPrice.value}～${scanMaxPrice.value}p 区间内`)
        } else if (scanItemKeyword.value.trim()) {
          ElMessage.info('未找到包含该物品的遗物')
        }
      }
    } else {
      scanResults.value = await searchRelics({
        minPrice: scanMinPrice.value,
        maxPrice: scanMaxPrice.value,
        tier: scanTier.value,
        mode: 'any' as MatchMode,
        itemKeyword: scanItemKeyword.value,
      })
    }
  } catch (e) {
    ElMessage.error(`搜索失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    loading.value = false
  }
}

// ── 遗物排行搜索 ──
async function handleRankSearch() {
  if (priceCount.value === 0) {
    ElMessage.warning('请先点击「数据重载」获取市场数据')
    return
  }
  loading.value = true
  rankSearched.value = true
  rankResults.value = []
  try {
    let results = await searchRelicRanking({ tier: rankTier.value })
    // 按遗物名称筛选
    const kw = rankKeyword.value.trim().toLowerCase()
    if (kw) {
      results = results.filter((r) =>
        r.displayName.toLowerCase().includes(kw) || r.relicName.toLowerCase().includes(kw),
      )
    }
    rankResults.value = results
  } catch (e) {
    ElMessage.error(`搜索失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    loading.value = false
  }
}

// ── 物品价值搜索 ──
async function handleValueSearch() {
  if (priceCount.value === 0) {
    ElMessage.warning('请先点击「数据重载」获取市场数据')
    return
  }
  loading.value = true
  valueSearched.value = true
  valueResults.value = []
  try {
    if (valueSelected.value.length > 0) {
      // 有选中物品时，按选中的搜
      valueResults.value = await searchItemValues({
        itemKeyword: valueSelected.value.join(','),
        tier: valueTier.value,
      })
      if (valueResults.value.length === 0) {
        ElMessage.info('未找到匹配的物品')
      }
    } else {
      // 没选物品时，默认展示价格最高的前 20 个
      valueResults.value = await searchItemValues({
        itemKeyword: '',
        tier: valueTier.value,
      })
    }
  } catch (e) {
    ElMessage.error(`搜索失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    loading.value = false
  }
}

// ── tab 切换时自动查询 ──
function handleTabChange(tab: string | number) {
  if (tab === 'item_value' && !valueSearched.value && priceCount.value > 0) {
    handleValueSearch()
  }
}

onMounted(init)
</script>

<template>
  <div class="scanner">
    <header class="header">
      <h1>WF 遗物价值段扫描器</h1>
    </header>

    <!-- 状态栏 + 数据重载 -->
    <el-card shadow="never" class="panel">
      <div class="status-bar">
        <span v-if="initLoading" class="status-loading">遗物数据加载中…</span>
        <span v-else class="status-done">遗物数据: {{ relicCount }} 条 ✓</span>
        <span v-if="refreshing" class="status-loading">价格数据加载中… ({{ refreshProgress.current }}/{{ refreshProgress.total }})</span>
        <span v-else-if="priceCount > 0" class="status-done">价格数据: {{ priceCount }} 个物品 ✓</span>
        <span v-else>价格数据: 未加载，请点击「数据重载」</span>
        <span v-if="priceCount > 0">上次刷新: {{ formatTime(lastRefresh) }}</span>
        <el-button type="success" size="small" :loading="refreshing" @click="handleRefresh">数据重载</el-button>
      </div>
      <el-progress
        v-if="refreshing && refreshProgress.total > 0"
        :percentage="Math.round((refreshProgress.current / refreshProgress.total) * 100)"
        :format="() => `${refreshProgress.current} / ${refreshProgress.total}`"
        class="progress"
      />
      <p v-if="refreshing && refreshProgress.itemName" class="progress-hint">
        正在更新: {{ refreshProgress.itemName }}
      </p>
    </el-card>

    <!-- 标签页 -->
    <el-tabs v-model="activeTab" class="main-tabs" @tab-change="handleTabChange">
      <!-- ═══ 遗物扫描 ═══ -->
      <el-tab-pane label="遗物扫描" name="scanner">
        <p class="tab-subtitle">输入白金区间，找出稀有奖励落在该区间的遗物，方便组队开核桃</p>
        <el-form :inline="true" label-width="80px" @submit.prevent="handleScanSearch">
          <el-form-item label="查询模式">
            <el-radio-group v-model="scanMode">
              <el-radio-button value="price_range">按遗物查询</el-radio-button>
              <el-radio-button value="by_item">按物品查询</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="最低价">
            <el-input-number v-model="scanMinPrice" :min="0" :max="99999" :step="5" />
          </el-form-item>
          <el-form-item label="最高价">
            <el-input-number v-model="scanMaxPrice" :min="0" :max="99999" :step="5" />
          </el-form-item>
          <el-form-item :label="isScanByItem ? '物品名称' : '物品筛选'">
            <el-autocomplete
              v-model="scanItemKeyword"
              :fetch-suggestions="fetchItemSuggestions"
              clearable
              placeholder="输入搜索，支持中英文联想"
              :debounce="200"
              style="width: 300px"
              :trigger-on-focus="true"
              highlight-first-item
              @select="(item: ItemSuggestion) => (scanItemKeyword = item.value)"
            >
              <template #default="{ item }">
                <div class="suggestion-item">
                  <span class="suggestion-name">{{ item.value }}</span>
                  <span v-if="item.price != null" class="suggestion-price">{{ item.price }}p</span>
                  <span v-else class="suggestion-muted">暂无价格</span>
                </div>
              </template>
            </el-autocomplete>
          </el-form-item>
          <el-form-item label="遗物类型">
            <el-select v-model="scanTier" placeholder="全部" style="width: 120px">
              <el-option v-for="opt in tierOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="handleScanSearch">搜索</el-button>
          </el-form-item>
        </el-form>

        <!-- 扫描结果 -->
        <el-card v-if="scanSearched" shadow="never" class="panel results-panel">
          <template #header>
            <div class="results-header">
              <span v-if="isScanByItem">搜索结果（{{ scanItemResults.length }} 个物品）</span>
              <span v-else>搜索结果（{{ scanResults.length }} 个遗物）</span>
              <span v-if="scanItemMeta" class="item-meta">
                {{ scanItemMeta.itemNameZh }}
                <strong class="price">市场价 {{ formatPrice(scanItemMeta.price) }}</strong>
                <span class="muted">（筛选区间 {{ scanMinPrice }}～{{ scanMaxPrice }}p）</span>
              </span>
            </div>
          </template>

          <!-- 按物品查询 -->
          <template v-if="isScanByItem">
            <el-empty v-if="scanItemResults.length === 0" description="没有找到符合条件的遗物，请调整价格区间或遗物等级" />
            <el-table v-else :data="scanItemResults" stripe style="width: 100%" row-key="itemName">
              <el-table-column type="expand">
                <template #default="{ row }">
                  <div class="expand-content">
                    <p class="expand-title">包含该物品的遗物（{{ row.relics.length }} 个）</p>
                    <div class="relic-chips">
                      <el-tag
                        v-for="relic in row.relics" :key="relic.key"
                        :effect="activeRelicKey === relic.key ? 'dark' : 'plain'"
                        class="relic-chip" @click="toggleRelicDetail(relic.key)"
                      >
                        {{ relic.displayName }}
                        <span class="chip-chance">{{ relic.chance }}%</span>
                      </el-tag>
                    </div>
                    <div v-if="getActiveRelic(row)" class="relic-detail">
                      <p class="expand-title">{{ getActiveRelic(row)!.displayName }} 全部奖励</p>
                      <p v-for="reward in getActiveRelic(row)!.allRewards" :key="reward.itemName + reward.rarity" class="reward-line">
                        <el-tag :type="rarityTagType(reward.rarity)" size="small">{{ rarityToZh(reward.rarity) }}</el-tag>
                        <span :class="{ highlight: reward.itemName === row.itemName }">{{ reward.itemNameZh }}</span>
                        <span class="muted">{{ reward.chance }}%</span>
                        <strong v-if="reward.price != null" class="price">{{ reward.price }}p</strong>
                        <span v-else class="muted">不可交易</span>
                      </p>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="itemNameZh" label="物品名称" min-width="240" />
              <el-table-column label="遗物数量" width="100">
                <template #default="{ row }">
                  <el-tag size="small" type="info">{{ row.relics.length }} 个遗物</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="市场价" width="100" sortable :sort-method="(a: ItemCentricResult, b: ItemCentricResult) => (a.price ?? 0) - (b.price ?? 0)">
                <template #default="{ row }">
                  <strong v-if="row.price != null" class="price">{{ row.price }}p</strong>
                  <span v-else class="muted">—</span>
                </template>
              </el-table-column>
            </el-table>
          </template>

          <!-- 按遗物查询 -->
          <template v-else>
            <el-empty v-if="scanResults.length === 0" description="没有符合条件的遗物，试试调整价格区间或先刷新价格" />
            <el-table v-else :data="scanResults" stripe style="width: 100%" row-key="key">
              <el-table-column type="expand">
                <template #default="{ row }">
                  <div class="expand-content">
                    <p v-if="row.allRewards" class="expand-title">遗物全部奖励</p>
                    <p v-for="reward in (row.allRewards ?? row.matchedRewards)" :key="reward.itemName + reward.rarity" class="reward-line">
                      <el-tag :type="rarityTagType(reward.rarity)" size="small">{{ rarityToZh(reward.rarity) }}</el-tag>
                      <span :class="{ highlight: row.matchedRewards.some((m: (typeof row.matchedRewards)[0]) => m.itemName === reward.itemName) }">
                        {{ reward.itemNameZh }}
                      </span>
                      <span class="muted">{{ reward.chance }}%</span>
                      <strong v-if="reward.price != null" class="price">{{ reward.price }}p</strong>
                      <span v-else class="muted">不可交易</span>
                    </p>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="displayName" label="遗物" min-width="160" />
              <el-table-column prop="tierZh" label="等级" width="90" />
              <el-table-column label="匹配奖励" min-width="240">
                <template #default="{ row }">
                  {{ row.matchedRewards[0]?.itemNameZh }}
                  <el-tag v-if="row.matchedRewards.length > 1" size="small" type="info">+{{ row.matchedRewards.length - 1 }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="稀有度" width="100">
                <template #default="{ row }">
                  <el-tag :type="rarityTagType(row.matchedRewards[0]?.rarity ?? '')" size="small">
                    {{ rarityToZh(row.matchedRewards[0]?.rarity ?? '') }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="概率" width="80">
                <template #default="{ row }">{{ row.matchedRewards[0]?.chance }}%</template>
              </el-table-column>
              <el-table-column label="市场价" width="90" sortable :sort-method="(a: SearchResult, b: SearchResult) => (a.bestPrice ?? 0) - (b.bestPrice ?? 0)">
                <template #default="{ row }">
                  <strong v-if="row.bestPrice != null" class="price">{{ row.bestPrice }}p</strong>
                  <span v-else class="muted">—</span>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </el-card>
      </el-tab-pane>

      <!-- ═══ 遗物排行 ═══ -->
      <el-tab-pane label="遗物排行" name="ranking">
        <p class="tab-subtitle">按期望白金价值排列所有遗物，找到最值得开的遗物</p>
        <el-form :inline="true" label-width="80px" @submit.prevent="handleRankSearch">
          <el-form-item label="遗物名称">
            <el-input v-model="rankKeyword" clearable placeholder="输入遗物名称筛选" style="width: 200px" />
          </el-form-item>
          <el-form-item label="遗物类型">
            <el-select v-model="rankTier" placeholder="全部" style="width: 120px">
              <el-option v-for="opt in tierOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="handleRankSearch">查询排行</el-button>
          </el-form-item>
        </el-form>

        <el-card v-if="rankSearched" shadow="never" class="panel results-panel">
          <template #header>
            <div class="results-header">
              <span>遗物排行（{{ rankResults.length }} 个遗物）</span>
            </div>
          </template>
          <el-empty v-if="rankResults.length === 0" description="没有排行数据" />
          <el-table v-else :data="rankResults" stripe style="width: 100%" row-key="key"
                    :default-sort="{ prop: 'expectedValue', order: 'descending' }">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="expand-content">
                  <p class="expand-title">遗物全部奖励（{{ row.allRewards.length }} 个）</p>
                  <p v-for="reward in row.allRewards" :key="reward.itemName + reward.rarity" class="reward-line">
                    <el-tag :type="rarityTagType(reward.rarity)" size="small">{{ rarityToZh(reward.rarity) }}</el-tag>
                    <span>{{ reward.itemNameZh }}</span>
                    <span class="muted">{{ reward.chance }}%</span>
                    <strong v-if="reward.price != null" class="price">{{ reward.price }}p</strong>
                    <span v-else class="muted">不可交易</span>
                    <span class="muted">期望 {{ ((reward.price ?? 0) * reward.chance / 100).toFixed(2) }}p</span>
                  </p>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="displayName" label="遗物" min-width="160" />
            <el-table-column prop="tierZh" label="等级" width="80" />
            <el-table-column label="期望价值" width="120" sortable :sort-method="(a: RelicRankingResult, b: RelicRankingResult) => a.expectedValue - b.expectedValue">
              <template #default="{ row }">
                <strong class="price">{{ row.expectedValue.toFixed(2) }}p</strong>
              </template>
            </el-table-column>
            <el-table-column label="最佳奖励" min-width="200">
              <template #default="{ row }">
                <template v-if="row.bestReward">
                  {{ row.bestReward.itemNameZh }}
                  <span class="muted">{{ row.bestReward.chance }}%</span>
                  <strong v-if="row.bestReward.price != null" class="price">{{ row.bestReward.price }}p</strong>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- ═══ 物品价值 ═══ -->
      <el-tab-pane label="物品价值" name="item_value">
        <p class="tab-subtitle">输入物品名称（逗号分隔多个），查看价格和包含的遗物</p>
        <el-form :inline="true" label-width="80px" @submit.prevent="handleValueSearch">
          <el-form-item label="物品名称">
            <el-select
              v-model="valueSelected"
              multiple
              filterable
              remote
              :remote-method="handleValueFilter"
              placeholder="搜索并选择物品"
              style="width: 400px"
              :loading="false"
            >
              <el-option
                v-for="item in filteredValueOptions"
                :key="item.nameEn"
                :label="item.value"
                :value="item.nameEn"
              >
                <div class="suggestion-item">
                  <span class="suggestion-name">{{ item.value }}</span>
                  <span v-if="item.price != null" class="suggestion-price">{{ item.price }}p</span>
                  <span v-else class="suggestion-muted">暂无价格</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="遗物类型">
            <el-select v-model="valueTier" placeholder="全部" style="width: 120px">
              <el-option v-for="opt in tierOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="handleValueSearch">查询价值</el-button>
          </el-form-item>
        </el-form>

        <el-card v-if="valueSearched" shadow="never" class="panel results-panel">
          <template #header>
            <div class="results-header">
              <span>物品价值 TOP20</span>
            </div>
          </template>
          <el-empty v-if="valueResults.length === 0" description="输入物品名称搜索" />
          <el-table v-else :data="valueResults" stripe style="width: 100%" row-key="itemName">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="expand-content">
                  <p class="expand-title">包含该物品的遗物（{{ row.relics.length }} 个）</p>
                  <div class="relic-chips">
                    <el-tag
                      v-for="relic in row.relics" :key="relic.key"
                      :effect="activeRelicKey === relic.key ? 'dark' : 'plain'"
                      class="relic-chip" @click="toggleRelicDetail(relic.key)"
                    >
                      {{ relic.displayName }}
                      <span class="chip-chance">{{ relic.chance }}%</span>
                    </el-tag>
                  </div>
                  <div v-if="getActiveRelic(row)" class="relic-detail">
                    <p class="expand-title">{{ getActiveRelic(row)!.displayName }} 全部奖励</p>
                    <p v-for="reward in getActiveRelic(row)!.allRewards" :key="reward.itemName + reward.rarity" class="reward-line">
                      <el-tag :type="rarityTagType(reward.rarity)" size="small">{{ rarityToZh(reward.rarity) }}</el-tag>
                      <span :class="{ highlight: reward.itemName === row.itemName }">{{ reward.itemNameZh }}</span>
                      <span class="muted">{{ reward.chance }}%</span>
                      <strong v-if="reward.price != null" class="price">{{ reward.price }}p</strong>
                      <span v-else class="muted">不可交易</span>
                    </p>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="itemNameZh" label="物品名称" min-width="240" />
            <el-table-column label="遗物数量" width="100">
              <template #default="{ row }">
                <el-tag size="small" type="info">{{ row.relics.length }} 个遗物</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="市场价" width="100" sortable :sort-method="(a: ItemCentricResult, b: ItemCentricResult) => (a.price ?? 0) - (b.price ?? 0)">
              <template #default="{ row }">
                <strong v-if="row.price != null" class="price">{{ row.price }}p</strong>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <footer v-if="initialized" class="footer">
      数据存于本地 IndexedDB · 价格来自
      <a href="https://warframe.market" target="_blank" rel="noreferrer">warframe.market</a>
    </footer>
  </div>
</template>

<style scoped>
.scanner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.header {
  margin-bottom: 20px;
}

.header h1 {
  margin: 0 0 8px;
  font-size: 1.75rem;
  color: #e8eaed;
}

.panel {
  margin-bottom: 16px;
  background: #1e1f24;
  border: 1px solid #2d2f36;
}

.tab-subtitle {
  margin: 0 0 16px;
  color: #9aa0a6;
  font-size: 0.95rem;
}

.status-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  font-size: 0.85rem;
  color: #9aa0a6;
}

.status-done {
  color: #7ee787;
}

.status-loading {
  color: #e6a23c;
}

.progress {
  margin-top: 12px;
}

.progress-hint {
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: #9aa0a6;
}

.results-panel {
  margin-top: 8px;
}

.results-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.item-meta {
  font-size: 0.9rem;
  color: #9aa0a6;
}

.expand-content {
  padding: 4px 12px 12px 48px;
}

.expand-title {
  margin: 0 0 8px;
  font-size: 0.85rem;
  color: #9aa0a6;
}

.relic-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.relic-chip {
  cursor: pointer;
  transition: all 0.15s;
}

.relic-chip:hover {
  filter: brightness(1.15);
}

.chip-chance {
  margin-left: 4px;
  opacity: 0.6;
  font-size: 0.8em;
}

.relic-detail {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #3a3d45;
}

.reward-line {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0;
}

.highlight {
  color: #8ab4f8;
  font-weight: 500;
}

.muted {
  color: #9aa0a6;
  font-size: 0.85rem;
}

.price {
  color: #7ee787;
}

.footer {
  margin-top: 24px;
  text-align: center;
  font-size: 0.8rem;
  color: #6b7280;
}

.footer a {
  color: #8ab4f8;
}

.suggestion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.suggestion-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggestion-price {
  flex-shrink: 0;
  color: #7ee787;
  font-size: 0.85rem;
}

.suggestion-muted {
  flex-shrink: 0;
  color: #6b7280;
  font-size: 0.8rem;
}
</style>
