import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './style.css'
import App from './App.vue'

// 初始化主题
const saved = localStorage.getItem('theme')
if (saved === 'light') {
  document.documentElement.setAttribute('data-theme', 'light')
  document.documentElement.classList.remove('dark')
} else {
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.classList.add('dark')
}

const app = createApp(App)
app.use(ElementPlus, { size: 'default' })
app.mount('#app')
