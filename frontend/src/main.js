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
