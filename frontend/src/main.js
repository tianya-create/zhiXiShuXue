import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

import App from './App.vue'
import router from './router'
import './styles/index.css'

dayjs.locale('zh-cn')

// 部署更新后浏览器可能还在用旧 index.html 去加载已被删除的 hash 资源（表现为一直转圈）。
// Vite 会抛 vite:preloadError，这里自动刷新一次拿到新版本。
window.addEventListener('vite:preloadError', function (event) {
  event.preventDefault()
  if (!sessionStorage.getItem('chunk-reload-once')) {
    sessionStorage.setItem('chunk-reload-once', '1')
    window.location.reload()
  }
})
// 本轮加载正常，清掉标记，允许下次部署再自动刷新
window.addEventListener('load', function () {
  setTimeout(function () { sessionStorage.removeItem('chunk-reload-once') }, 3000)
})

var app = createApp(App)

// 注册 Element Plus 图标
var iconKeys = Object.keys(ElementPlusIconsVue)
for (var i = 0; i < iconKeys.length; i++) {
  var key = iconKeys[i]
  var component = ElementPlusIconsVue[key]
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, {
  locale: zhCn
})

app.mount('#app')
