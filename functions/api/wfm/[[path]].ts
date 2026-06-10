// Cloudflare Pages Function: 反向代理 warframe.market API
// 部署到 Cloudflare Pages 后自动生效
// 匹配 /api/wfm/* → 转发到 https://api.warframe.market/*

const TARGET = 'https://api.warframe.market'

export async function onRequest(context: any) {
  const url = new URL(context.request.url)
  const targetUrl = TARGET + url.pathname.replace(/^\/api\/wfm/, '') + url.search

  const headers = new Headers(context.request.headers)
  headers.set('Host', 'api.warframe.market')
  headers.delete('cf-connecting-ip')
  headers.delete('cf-ipcountry')
  headers.delete('cf-ray')
  headers.delete('cf-visitor')

  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    redirect: 'follow',
  })

  const newHeaders = new Headers(response.headers)
  newHeaders.set('Access-Control-Allow-Origin', '*')
  newHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  newHeaders.set('Access-Control-Allow-Headers', '*')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}
