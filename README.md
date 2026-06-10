# WF 遗物价值段扫描器

输入白金价格区间，找出稀有奖励落在该区间的 Warframe 遗物，方便组队开核桃。

## 功能

- 按价格区间筛选遗物（默认 30～40p）
- 遗物等级筛选：Lith / Meso / Neo / Axi / Requiem
- 匹配模式：仅 Rare / 任意奖励 / 最高奖励在区间内
- 本地 IndexedDB 缓存，手动刷新价格
- 无需远程服务器

## 启动

双击 `启动.bat`，或在项目目录执行：

```bash
npm run dev
```

浏览器打开 http://localhost:5173

## 使用流程

1. 首次打开会自动加载遗物掉落表（约 3000 条）
2. 点击 **刷新价格** 从 warframe.market 拉取市场价格（约 580 个可交易奖励物品，需几分钟）
3. 设置价格区间和筛选条件，点击 **搜索**

## 技术栈

- Vue 3 + TypeScript + Vite
- Element Plus
- Dexie.js (IndexedDB)
- 遗物数据：WFCD warframe-drop-data
- 价格数据：WFM API v2（经 Vite 本地代理）
