<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { queryItemSuggestions, type ItemSuggestion } from '../services/itemIndex'
import { loadRelicsIntoDb, loadWfmItemsIntoDb } from '../services/relicLoader'
import { getLastRefreshTime, getPriceCount, refreshPrices } from '../services/priceRefresh'
import { searchRelics, searchRelicsByItem } from '../services/search'
import type { ItemCentricResult, ItemSearchMeta, MatchMode, QueryMode, RelicTier, SearchResult } from '../types'
import { rarityToZh, TIER_OPTIONS } from '../utils/relicI18n'

const queryMode = ref<QueryMode>('price_range')
const minPrice = ref(30)
const maxPrice = ref(40)
const tier = ref<RelicTier | ''>('')
const mode = ref<MatchMode>('any')
const itemKeyword = ref('')

const loading = ref(false)
const refreshing = ref(false)
const initialized = ref(false)
const relicCount = ref(0)
const priceCount = ref(0)
const lastRefresh = ref<string | null>(null)
const refreshProgress = ref({ current: 0, total: 0, itemName: '' })

const results = ref<SearchResult[]>([])
const itemResults = ref<ItemCentricResult[]>([])
const itemMeta = ref<ItemSearchMeta | null>(null)
const searched = ref(false)

const tierOptions = TIER_OPTIONS

const queryModeOptions = [
  { label: '价格区间', value: 'price_range' as const },
  { label: '按物品查询', value: 'by_item' as const },
]

const matchModeOptions = [
  { label: '仅稀有奖励 (Rare)', value: 'rare_only' },
  { label: '任意奖励', value: 'any' },
  { label: '最高奖励在区间内', value: 'highest' },
]

const isPriceRangeMode = computed(() => queryMode.value === 'price_range')
const isByItemMode = computed(() => queryMode.value === 'by_item')

const itemNamePlaceholder = computed(() =>
  isByItemMode.value ? '输入搜索，支持中英文联想' : '输入搜索，支持中英文联想',
)

const emptyDescription = computed(() =>
  isByItemMode.value
    ? '没有找到符合条件的遗物，请调整价格区间或遗物等级'
    : '没有符合条件的遗物，试试调整价格区间或先刷新价格',
)

async function init() {
  loading.value = true
  try {
    relicCount.value = await loadRelicsIntoDb()
    await loadWfmItemsIntoDb()
    priceCount.value = await getPriceCount()
    lastRefresh.value = await getLastRefreshTime()
    initialized.value = true
  } catch (e) {
    ElMessage.error(`初始化失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    loading.value = false
  }
}

async function handleRefresh() {
  refreshing.value = true
  refreshProgress.value = { current: 0, total: 0, itemName: '' }
  try {
    await refreshPrices((p) => {
      refreshProgress.value = p
    })
    priceCount.value = await getPriceCount()
    lastRefresh.value = await getLastRefreshTime()
    ElMessage.success('价格数据已更新')
  } catch (e) {
    ElMessage.error(`刷新失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    refreshing.value = false
  }
}

async function handleSearch() {
  if (priceCount.value === 0) {
    ElMessage.warning('请先点击「刷新价格」获取市场数据')
    return
  }

  if (minPrice.value > maxPrice.value) {
    ElMessage.warning('最低价不能大于最高价')
    return
  }

  loading.value = true
  searched.value = true
  itemMeta.value = null
  itemResults.value = []
  results.value = []
  try {
    if (isByItemMode.value) {
      const { results: rows, meta } = await searchRelicsByItem({
        itemKeyword: itemKeyword.value,
        minPrice: minPrice.value,
        maxPrice: maxPrice.value,
        tier: tier.value,
      })
      itemResults.value = rows
      itemMeta.value = meta
      if (rows.length === 0) {
        if (
          meta?.price != null &&
          (meta.price < minPrice.value || meta.price > maxPrice.value)
        ) {
          ElMessage.info(`物品市场价 ${meta.price}p 不在 ${minPrice.value}～${maxPrice.value}p 区间内`)
        } else if (itemKeyword.value.trim()) {
          ElMessage.info('未找到包含该物品的遗物')
        }
      }
    } else {
      results.value = await searchRelics({
        minPrice: minPrice.value,
        maxPrice: maxPrice.value,
        tier: tier.value,
        mode: mode.value,
        itemKeyword: itemKeyword.value,
      })
    }
  } catch (e) {
    ElMessage.error(`搜索失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    loading.value = false
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return '从未刷新'
  return new Date(iso).toLocaleString('zh-CN')
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—'
  return `${price}p`
}

function expandRewards(row: SearchResult) {
  return row.allRewards ?? row.matchedRewards
}

async function fetchItemSuggestions(
  query: string,
  cb: (results: ItemSuggestion[]) => void,
) {
  cb(
    await queryItemSuggestions(query, {
      minPrice: minPrice.value,
      maxPrice: maxPrice.value,
    }),
  )
}

function rarityTagType(rarity: string): '' | 'success' | 'warning' | 'danger' | 'info' {
  if (rarity === 'Rare') return 'danger'
  if (rarity === 'Uncommon') return 'warning'
  return 'info'
}

onMounted(init)
</script>

<template>
  <div class="scanner">
    <header class="header">
      <h1>WF 遗物价值段扫描器</h1>
      <p class="subtitle">
        {{
          isPriceRangeMode
            ? '输入白金区间，找出稀有奖励落在该区间的遗物，方便组队开核桃'
            : '输入价格区间查找遗物，可选填物品名称进一步缩小范围'
        }}
      </p>
    </header>

    <el-card shadow="never" class="panel">
      <el-form :inline="true" label-width="80px" @submit.prevent="handleSearch">
        <el-form-item label="查询模式">
          <el-radio-group v-model="queryMode">
            <el-radio-button
              v-for="opt in queryModeOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="最低价">
          <el-input-number v-model="minPrice" :min="0" :max="99999" :step="5" />
        </el-form-item>
        <el-form-item label="最高价">
          <el-input-number v-model="maxPrice" :min="0" :max="99999" :step="5" />
        </el-form-item>

        <!-- <el-form-item v-if="isPriceRangeMode" label="匹配模式">
          <el-select v-model="mode" style="width: 200px">
            <el-option
              v-for="opt in matchModeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item> -->

        <el-form-item :label="isByItemMode ? '物品名称' : '物品筛选'">
          <el-autocomplete
            v-model="itemKeyword"
            :fetch-suggestions="fetchItemSuggestions"
            clearable
            :placeholder="itemNamePlaceholder"
            :debounce="200"
            style="width: 300px"
            :trigger-on-focus="true"
            highlight-first-item
            @select="(item: ItemSuggestion) => (itemKeyword = item.value)"
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

        <el-form-item label="遗物等级">
          <el-select v-model="tier" placeholder="全部" style="width: 120px">
            <el-option
              v-for="opt in tierOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSearch">搜索</el-button>
          <el-button type="success" :loading="refreshing" @click="handleRefresh">
            刷新价格
          </el-button>
        </el-form-item>
      </el-form>

      <div class="status-bar">
        <span>遗物数据: {{ relicCount }} 条</span>
        <span>已缓存价格: {{ priceCount }} 个物品</span>
        <span>上次刷新: {{ formatTime(lastRefresh) }}</span>
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

    <el-card v-if="searched" shadow="never" class="panel results-panel">
      <template #header>
        <div class="results-header">
          <span v-if="isByItemMode">搜索结果（{{ itemResults.length }} 个物品）</span>
          <span v-else>搜索结果（{{ results.length }} 个遗物）</span>
          <span v-if="itemMeta" class="item-meta">
            {{ itemMeta.itemNameZh }}
            <strong class="price">市场价 {{ formatPrice(itemMeta.price) }}</strong>
            <span class="muted">（筛选区间 {{ minPrice }}～{{ maxPrice }}p）</span>
          </span>
        </div>
      </template>

      <!-- 按物品查询：物品中心表格 -->
      <template v-if="isByItemMode">
        <el-empty v-if="itemResults.length === 0" :description="emptyDescription" />

        <el-table v-else :data="itemResults" stripe style="width: 100%" row-key="itemName">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="expand-content">
                <p class="expand-title">包含该物品的遗物（{{ row.relics.length }} 个）</p>
                <p v-for="relic in row.relics" :key="relic.key" class="reward-line">
                  <el-tag :type="rarityTagType(relic.rarity)" size="small">{{ rarityToZh(relic.rarity) }}</el-tag>
                  <span class="highlight">{{ relic.displayName }}</span>
                  <span class="muted">{{ relic.chance }}%</span>
                </p>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="itemNameZh" label="物品名称" min-width="240" />
          <el-table-column label="遗物数量" width="100">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.relics.length }} 个遗物</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="市场价"
            width="100"
            sortable
            :sort-method="(a: ItemCentricResult, b: ItemCentricResult) => (a.price ?? 0) - (b.price ?? 0)"
          >
            <template #default="{ row }">
              <strong v-if="row.price != null" class="price">{{ row.price }}p</strong>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <!-- 价格区间查询：遗物中心表格 -->
      <template v-else>
        <el-empty v-if="results.length === 0" :description="emptyDescription" />

        <el-table v-else :data="results" stripe style="width: 100%" row-key="key">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="expand-content">
                <p v-if="row.allRewards" class="expand-title">遗物全部奖励</p>
                <p v-for="reward in expandRewards(row)" :key="reward.itemName + reward.rarity" class="reward-line">
                  <el-tag :type="rarityTagType(reward.rarity)" size="small">{{ rarityToZh(reward.rarity) }}</el-tag>
                  <span
                    :class="{
                      highlight: row.matchedRewards.some(
                        (m: (typeof row.matchedRewards)[0]) => m.itemName === reward.itemName,
                      ),
                    }"
                  >
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
              <el-tag v-if="row.matchedRewards.length > 1" size="small" type="info">
                +{{ row.matchedRewards.length - 1 }}
              </el-tag>
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
          <el-table-column
            label="市场价"
            width="90"
            sortable
            :sort-method="(a: SearchResult, b: SearchResult) => (a.bestPrice ?? 0) - (b.bestPrice ?? 0)"
          >
            <template #default="{ row }">
              <strong v-if="row.bestPrice != null" class="price">{{ row.bestPrice }}p</strong>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>

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

.subtitle {
  margin: 0;
  color: #9aa0a6;
  font-size: 0.95rem;
}

.panel {
  margin-bottom: 16px;
  background: #1e1f24;
  border: 1px solid #2d2f36;
}

.status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 8px;
  font-size: 0.85rem;
  color: #9aa0a6;
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
