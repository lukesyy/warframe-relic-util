# WF 遗物价值段扫描器

输入白金价格区间，找出稀有奖励落在该区间的 Warframe 遗物，方便组队开核桃。

## 功能

### 🥜 遗物扫描
- 按价格区间筛选遗物（默认 30～40p）
- 支持按遗物查询和按物品查询两种模式
- 物品联想输入，支持中英文搜索
- 遗物类型筛选：古纪 / 前纪 / 中纪 / 后纪 / 安魂

### 🏆 遗物排行
- 按期望白金价值排列所有遗物（价值 = 奖励价格 × 掉率）
- 默认展示 TOP20
- 支持遗物名称和类型筛选
- 展开查看遗物全部奖励及每项的期望贡献

### 💰 物品价值
- 多物品选择查询，默认展示价值 TOP20
- 点击遗物标签查看遗物全部奖励
- 按遗物类型筛选

### ⚙️ 实用功能
- **价格基准**：可选卖一～卖五作为参考价格
- **主题切换**：暗色 / 亮色一键切换
- **首次引导**：新用户弹窗介绍功能
- 所有数据缓存在本地 IndexedDB，无需注册登录

## 在线访问

[wf-ewz.pages.dev](https://wf-ewz.pages.dev)

## 启动

双击 `启动.bat`，或在项目目录执行：

```bash
npm run dev
```

浏览器打开 http://localhost:5173

## 使用流程

1. 首次打开会自动加载遗物掉落表（光辉状态约 753 条）
2. 点击 **数据重载** 加载物品数据并从 warframe.market 拉取市场价格（约 580 个可交易物品，需几分钟）
3. 选择功能标签页，设置筛选条件，点击搜索

## 技术栈

- Vue 3 + TypeScript + Vite
- Element Plus
- Dexie.js (IndexedDB)
- Cloudflare Pages + Pages Function (API 代理)
- 遗物数据：WFCD warframe-drop-data（仅光辉状态）
- 价格数据：WFM API v2（经 Cloudflare Workers 反向代理解决 CORS）

## 作者

[lukesyy](https://github.com/lukesyy)
