<template>
  <div :class="['nb-shell', { 'is-pinned': pinned, 'is-open': open }]">
    <!-- 小屏顶栏 -->
    <header class="mobile-topbar">
      <button class="menu-toggle" type="button" aria-label="打开导航" @click="openNow">
        <el-icon><Menu /></el-icon>
      </button>
      <img class="mobile-logo" src="/images/logo.png" alt="">
      <span class="mobile-title">智析数学</span>
      <span class="mobile-sub">{{ subtitle }}</span>
    </header>

    <!-- 大屏：鼠标靠近左边缘时滑出侧栏 -->
    <div class="edge-zone" aria-hidden="true" @mouseenter="peek" @mouseleave="cancelPeek"></div>
    <button
      v-show="!open && !pinned"
      class="edge-handle"
      type="button"
      aria-label="打开导航"
      title="打开导航（鼠标移到屏幕左边缘也可以）"
      @click="openNow"
      @mouseenter="peek"
      @mouseleave="cancelPeek"
    >
      <img src="/images/logo.png" alt="">
      <span class="edge-handle-lines" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>

    <div v-if="open" class="sidebar-mask" @click="closeNow"></div>

    <aside
      ref="sidebarRef"
      class="nb-sidebar"
      aria-label="主导航"
      @mouseenter="cancelClose"
      @mouseleave="scheduleClose"
      @focusin="cancelClose(); open = true"
      @focusout="onFocusOut"
      @keydown.esc="closeNow"
    >
      <div class="brand">
        <img class="brand-logo" src="/images/logo.png" alt="">
        <div class="brand-text">
          <span class="brand-name">智析数学</span>
          <span class="brand-sub">{{ subtitle }}</span>
        </div>
        <button
          class="pin-button"
          type="button"
          :aria-pressed="pinned"
          :title="pinned ? '取消固定，侧栏自动收起' : '固定侧栏，一直显示'"
          :aria-label="pinned ? '取消固定侧栏' : '固定侧栏'"
          @click="togglePin"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path v-if="pinned" d="M9 4h6l-1 6 3 3H7l3-3-1-6zM12 13v7" />
            <path v-else d="M9 4h6l-1 6 3 3H7l3-3-1-6zM12 13v7M4 4l16 16" />
          </svg>
        </button>
      </div>

      <el-menu :default-active="activeMenu" :default-openeds="openGroups" router class="nb-menu">
        <template v-for="item in menu" :key="item.index">
          <el-sub-menu v-if="item.children" :index="item.index">
            <template #title>
              <el-icon><component :is="item.icon" /></el-icon>
              <span class="menu-text">{{ item.label }}</span>
            </template>
            <el-menu-item v-for="child in item.children" :key="child.index" :index="child.index">
              <span class="menu-text">{{ child.label }}</span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="item.index">
            <el-icon><component :is="item.icon" /></el-icon>
            <span class="menu-text">{{ item.label }}</span>
          </el-menu-item>
        </template>
      </el-menu>

      <el-dropdown
        class="user-block"
        trigger="click"
        placement="top-start"
        @command="handleCommand"
        @visible-change="(v) => { dropdownOpen = v }"
      >
        <button class="user-button" type="button">
          <span class="user-avatar" aria-hidden="true">{{ userInitial }}</span>
          <span class="user-text">
            <span class="user-name">{{ userName }}</span>
            <span class="user-role">{{ roleLabel }}</span>
          </span>
          <el-icon class="user-arrow"><ArrowUp /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-if="profilePath" command="profile">
              <el-icon><User /></el-icon>
              {{ profileLabel }}
            </el-dropdown-item>
            <el-dropdown-item command="logout" :divided="!!profilePath">
              <el-icon><SwitchButton /></el-icon>
              退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </aside>

    <!-- 切换页面时顶部的进度条 -->
    <div :class="['route-progress', { 'is-active': routeLoading }]" aria-hidden="true"></div>

    <main class="nb-main">
      <router-view v-slot="{ Component, route: viewRoute }">
        <transition name="nb-page" mode="out-in">
          <component :is="Component" :key="viewRoute.path" />
        </transition>
      </router-view>
    </main>

    <el-backtop :right="28" :bottom="104" />
    <slot name="extra" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

// 学生端、教师端共用的字体与“方格本”主题
import '@fontsource/zcool-qingke-huangyou/400.css'
import '@fontsource/caveat/latin-700.css'
import '@fontsource-variable/bricolage-grotesque'
import '@/styles/notebook.css'

const props = defineProps({
  // [{ index, label, icon, children?: [{ index, label }] }]
  menu: { type: Array, required: true },
  subtitle: { type: String, default: '' },
  roleLabel: { type: String, default: '' },
  profilePath: { type: String, default: '' },
  profileLabel: { type: String, default: '个人信息' }
})

const THEME_CLASS = 'theme-notebook'
const PIN_KEY = 'nb-sidebar-pinned'

const router = useRouter()
const route = useRoute()
const sidebarRef = ref(null)
const open = ref(false)
const pinned = ref(readPinned())
const dropdownOpen = ref(false)
const routeLoading = ref(false)
let peekTimer = null
let closeTimer = null
let removeBefore = null
let removeAfter = null

const fallbackName = computed(() => ({ 教师: '老师', 管理员: '管理员' }[props.roleLabel] || '同学'))
const userName = computed(() => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user.name || fallbackName.value
  } catch (e) {
    return fallbackName.value
  }
})
const userInitial = computed(() => String(userName.value).slice(0, 1))

// 详情页（如 /student/assignment/xxx）也要让对应菜单保持选中
const activeMenu = computed(() => {
  const indexes = []
  props.menu.forEach((item) => {
    if (item.children) item.children.forEach(child => indexes.push(child.index))
    else indexes.push(item.index)
  })
  const exact = indexes.find(index => index === route.path)
  if (exact) return exact
  const prefix = indexes
    .filter(index => route.path.startsWith(index))
    .sort((a, b) => b.length - a.length)[0]
  return prefix || route.path
})

const openGroups = computed(() => props.menu
  .filter(item => item.children && item.children.some(child => activeMenu.value === child.index))
  .map(item => item.index))

function readPinned() {
  try {
    return localStorage.getItem(PIN_KEY) === '1'
  } catch (e) {
    return false
  }
}

function togglePin() {
  pinned.value = !pinned.value
  try {
    localStorage.setItem(PIN_KEY, pinned.value ? '1' : '0')
  } catch (e) {
    // 浏览器禁止存储时，只在本次访问生效
  }
  if (!pinned.value) closeNow()
}

function isDesktop() {
  return window.matchMedia('(min-width: 1025px)').matches
}

function peek() {
  if (pinned.value || !isDesktop()) return
  clearTimeout(closeTimer)
  clearTimeout(peekTimer)
  peekTimer = setTimeout(() => { open.value = true }, 90)
}

function cancelPeek() {
  clearTimeout(peekTimer)
}

function openNow() {
  clearTimeout(closeTimer)
  open.value = true
}

function cancelClose() {
  clearTimeout(closeTimer)
}

function scheduleClose() {
  if (pinned.value || !isDesktop()) return
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    if (!dropdownOpen.value) open.value = false
  }, 320)
}

function closeNow() {
  clearTimeout(closeTimer)
  clearTimeout(peekTimer)
  open.value = false
}

function onFocusOut(event) {
  if (sidebarRef.value && !sidebarRef.value.contains(event.relatedTarget)) scheduleClose()
}

watch(() => route.path, () => {
  if (!pinned.value) open.value = false
})

watch(dropdownOpen, (visible) => {
  if (!visible) scheduleClose()
})

// 固定侧栏时在根元素上打标记，让弹窗（el-dialog / el-message-box）
// 居中于侧栏右侧的主内容区，而不是整个视口（见 notebook.css 的 html.nb-pinned 规则）
watch(pinned, (value) => {
  document.documentElement.classList.toggle('nb-pinned', value)
}, { immediate: true })

function handleCommand(command) {
  if (command === 'profile') {
    router.push(props.profilePath)
  } else if (command === 'logout') {
    ElMessageBox.confirm('退出后需要重新登录。', '退出登录', {
      confirmButtonText: '退出登录',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(async () => {
      try { await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }) } catch { ElMessage.warning('网络中断，登录会话将在到期后失效') }
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      for (const key of Object.keys(localStorage)) if (key.startsWith('answer-draft:' + user.id + ':')) localStorage.removeItem(key)
      sessionStorage.clear()
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      ElMessage.success('已退出登录')
      router.replace('/login')
    }).catch(() => {})
  }
}

onMounted(() => {
  document.documentElement.classList.add(THEME_CLASS)
  removeBefore = router.beforeEach(() => {
    routeLoading.value = true
    return true
  })
  removeAfter = router.afterEach(() => {
    setTimeout(() => { routeLoading.value = false }, 120)
  })
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove(THEME_CLASS)
  document.documentElement.classList.remove('nb-pinned')
  clearTimeout(peekTimer)
  clearTimeout(closeTimer)
  if (removeBefore) removeBefore()
  if (removeAfter) removeAfter()
})
</script>

<style scoped>
.nb-shell {
  --sidebar-w: 248px;
  --margin-line: 68px;
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
}

/* ---------- 左边缘感应区和把手 ---------- */
.edge-zone {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: 14px;
  z-index: 140;
}

.edge-handle {
  position: fixed;
  top: 18px;
  left: 12px;
  z-index: 141;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 44px;
  padding: 6px 0 10px;
  border: 1px solid var(--nb-line);
  border-radius: 14px;
  background: var(--nb-sheet);
  box-shadow: var(--nb-shadow);
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.edge-handle:hover {
  border-color: var(--nb-blue);
  transform: translateX(2px);
}

.edge-handle img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.edge-handle-lines {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.edge-handle-lines i {
  display: block;
  width: 16px;
  height: 2.5px;
  border-radius: 2px;
  background: var(--nb-ink-2);
}

/* ---------- 侧栏 ---------- */
.nb-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 150;
  width: var(--sidebar-w);
  display: flex;
  flex-direction: column;
  background: var(--nb-sheet);
  border-right: 1px solid var(--nb-line);
  transform: translateX(-102%);
  transition: transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.26s ease;
}

.nb-shell.is-open .nb-sidebar {
  transform: translateX(0);
  box-shadow: 24px 0 48px -24px rgba(26, 33, 64, 0.35);
}

.nb-shell.is-pinned .nb-sidebar {
  transform: translateX(0);
  box-shadow: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 14px 18px 20px;
}

.brand-logo {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.brand-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand-name {
  font-family: var(--nb-font-display);
  font-size: 26px;
  line-height: 1.1;
  color: var(--nb-ink);
  letter-spacing: 0.04em;
}

.brand-sub {
  margin-top: 4px;
  font-size: 14px;
  color: var(--nb-ink-3);
}

.pin-button {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 1px solid var(--nb-line);
  border-radius: 9px;
  background: var(--nb-sheet);
  color: var(--nb-ink-3);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.pin-button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pin-button:hover {
  color: var(--nb-blue);
  border-color: var(--nb-blue);
}

.pin-button[aria-pressed='true'] {
  color: #fff;
  border-color: var(--nb-blue);
  background: var(--nb-blue);
}

/* ---------- 菜单：选中项用荧光笔划过 ---------- */
.nb-menu {
  flex: 1;
  padding: 4px 12px;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  overflow-y: auto;
}

.nb-menu :deep(.el-menu-item),
.nb-menu :deep(.el-sub-menu__title) {
  height: 46px !important;
  line-height: 46px !important;
  margin: 2px 0 !important;
  padding: 0 14px !important;
  border: none !important;
  border-radius: 10px !important;
  background: transparent !important;
  color: var(--nb-ink-2) !important;
  font-size: 16px !important;
  font-weight: 500 !important;
  box-shadow: none !important;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.nb-menu :deep(.el-sub-menu .el-menu) {
  background: transparent !important;
}

.nb-menu :deep(.el-sub-menu .el-menu-item) {
  height: 42px !important;
  line-height: 42px !important;
  padding-left: 46px !important;
  font-size: 15px !important;
}

.nb-menu :deep(.el-menu-item::before) {
  display: none !important;
}

.nb-menu :deep(.el-menu-item .el-icon),
.nb-menu :deep(.el-sub-menu__title .el-icon:not(.el-sub-menu__icon-arrow)) {
  margin-right: 12px;
  font-size: 19px;
  color: var(--nb-ink-3);
  transform: none !important;
}

.nb-menu :deep(.el-menu-item:hover),
.nb-menu :deep(.el-sub-menu__title:hover) {
  background: var(--nb-blue-soft) !important;
  color: var(--nb-ink) !important;
}

.nb-menu :deep(.el-menu-item.is-active) {
  background: transparent !important;
  color: var(--nb-ink) !important;
  font-weight: 700 !important;
}

.nb-menu :deep(.el-menu-item.is-active .el-icon),
.nb-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title .el-icon) {
  color: var(--nb-blue);
}

.nb-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: var(--nb-ink) !important;
  font-weight: 700 !important;
}

.nb-menu :deep(.el-menu-item.is-active .menu-text) {
  background: linear-gradient(transparent 52%, var(--nb-yellow) 52%, var(--nb-yellow) 92%, transparent 92%);
  padding: 0 3px;
  margin: 0 -3px;
}

/* ---------- 用户 ---------- */
.user-block {
  display: block;
  margin: 12px;
}

.user-button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--nb-line);
  border-radius: 12px;
  background: var(--nb-sheet);
  color: var(--nb-ink);
  font: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease;
}

.user-button:hover {
  border-color: var(--nb-blue);
}

.user-avatar {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--nb-blue);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
}

.user-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 700;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 14px;
  color: var(--nb-ink-3);
}

.user-arrow {
  color: var(--nb-ink-3);
  font-size: 14px;
}

/* ---------- 内容区：作业本左侧的红色页边线 ---------- */
.nb-main {
  position: relative;
  min-width: 0;
  padding: 36px 48px 64px calc(var(--margin-line) + 34px);
  box-sizing: border-box;
  transition: margin-left 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.nb-main::before {
  content: '';
  position: fixed;
  top: 0;
  bottom: 0;
  left: var(--margin-line);
  border-left: 1.5px solid rgba(240, 68, 62, 0.35);
  pointer-events: none;
  z-index: 0;
  transition: left 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.nb-shell.is-pinned .nb-main {
  margin-left: var(--sidebar-w);
}

.nb-shell.is-pinned .nb-main::before {
  left: calc(var(--sidebar-w) + 36px);
}

.nb-shell.is-pinned .nb-main {
  padding-left: 72px;
}

.nb-main > :deep(*) {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  min-width: 0;
  box-sizing: border-box;
}

/* ---------- 换页动画 ---------- */
.nb-page-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.nb-page-leave-active {
  transition: opacity 0.12s ease;
}

.nb-page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.nb-page-leave-to {
  opacity: 0;
}

/* ---------- 顶部进度条 ---------- */
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 3100;
  height: 3px;
  width: 0;
  background: linear-gradient(90deg, var(--nb-blue), var(--nb-pink));
  opacity: 0;
  pointer-events: none;
}

.route-progress.is-active {
  opacity: 1;
  width: 70%;
  transition: width 1.2s cubic-bezier(0.1, 0.7, 0.2, 1);
}

/* ---------- 小屏 ---------- */
.mobile-topbar,
.sidebar-mask {
  display: none;
}

@media (min-width: 1025px) {
  .sidebar-mask {
    display: none !important;
  }
}

@media (max-width: 1024px) {
  .edge-zone,
  .edge-handle,
  .pin-button {
    display: none !important;
  }

  .mobile-topbar {
    position: sticky;
    top: 0;
    z-index: 90;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 58px;
    padding: 0 14px;
    background: var(--nb-sheet);
    border-bottom: 1px solid var(--nb-line);
  }

  .menu-toggle {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border: 1px solid var(--nb-line);
    border-radius: 10px;
    background: var(--nb-sheet);
    color: var(--nb-ink);
    font-size: 20px;
    cursor: pointer;
  }

  .mobile-logo {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  .mobile-title {
    font-family: var(--nb-font-display);
    font-size: 22px;
    color: var(--nb-ink);
  }

  .mobile-sub {
    font-size: 14px;
    color: var(--nb-ink-3);
  }

  .nb-shell.is-pinned .nb-sidebar {
    transform: translateX(-102%);
  }

  .nb-shell.is-open .nb-sidebar {
    transform: translateX(0);
  }

  .sidebar-mask {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 145;
    background: rgba(26, 33, 64, 0.36);
  }

  .nb-main,
  .nb-shell.is-pinned .nb-main {
    margin-left: 0;
    padding: 24px 18px 110px 34px;
  }

  .nb-main::before,
  .nb-shell.is-pinned .nb-main::before {
    left: 18px;
  }
}
</style>
