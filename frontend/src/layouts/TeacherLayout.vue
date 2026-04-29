<template>
  <div class="layout-container">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="logo">
        <img class="logo-img" src="/images/logo.png" alt="智析数学 logo">
        <div class="logo-text">
          <span>智析数学</span>
          <span class="logo-subtitle">教师空间</span>
        </div>
      </div>

      <el-menu
        :default-active="currentRoute"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/teacher/dashboard">
          <el-icon><House /></el-icon>
          <span class="menu-text">首页概览</span>
        </el-menu-item>

        <el-sub-menu index="management">
          <template #title>
            <el-icon><Management /></el-icon>
            <span class="menu-text">基础管理</span>
          </template>
          <el-menu-item index="/teacher/classes">班级管理</el-menu-item>
          <el-menu-item index="/teacher/students">学生管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="papers">
          <template #title>
            <el-icon><Document /></el-icon>
            <span class="menu-text">试卷作业</span>
          </template>
          <el-menu-item index="/teacher/papers">试卷管理</el-menu-item>
          <el-menu-item index="/teacher/questions">题目管理</el-menu-item>
          <el-menu-item index="/teacher/assignments">作业发布</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/teacher/grading">
          <el-icon><Edit /></el-icon>
          <span class="menu-text">批改中心</span>
        </el-menu-item>

        <el-sub-menu index="analytics">
          <template #title>
            <el-icon><TrendCharts /></el-icon>
            <span class="menu-text">学情分析</span>
          </template>
          <el-menu-item index="/teacher/analytics/class">班级学情</el-menu-item>
          <el-menu-item index="/teacher/analytics/student">学生学情</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/teacher/profile">
          <el-icon><Setting /></el-icon>
          <span class="menu-text">个人设置</span>
        </el-menu-item>
      </el-menu>

      <!-- 用户信息 -->
      <div class="user-info">
        <el-dropdown @command="handleCommand" trigger="click">
          <div class="user-avatar">
            <el-avatar :size="40" class="avatar">
              <el-icon><UserFilled /></el-icon>
            </el-avatar>
            <div class="user-details">
              <span class="user-name">{{ userName }}</span>
              <span class="user-role">教师</span>
            </div>
            <el-icon class="dropdown-arrow"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">
                <el-icon><User /></el-icon>
                个人设置
              </el-dropdown-item>
              <el-dropdown-item command="logout" divided>
                <el-icon><SwitchButton /></el-icon>
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()

const currentRoute = computed(() => route.path)

const userName = computed(() => {
  const userStr = localStorage.getItem('user')
  if (!userStr) return '教师'
  try {
    const user = JSON.parse(userStr)
    return user && user.name ? user.name : '教师'
  } catch (e) {
    return '教师'
  }
})

function handleCommand(command) {
  if (command === 'profile') {
    router.push('/teacher/profile')
  } else if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      ElMessage.success('已退出登录')
      router.replace('/login')
    }).catch(() => {})
  }
}
</script>

<style scoped>
/* === 页面骨架 === */
.layout-container {
  width: 100%;
  min-height: 100vh;
  max-width: 100vw;
  overflow-x: hidden;
}

.main-content {
  min-height: 100vh;
  width: calc(100vw - var(--sidebar-width));
  max-width: calc(100vw - var(--sidebar-width));
  min-width: 0;
  margin-left: var(--sidebar-width);
  padding: 24px;
  overflow-x: hidden;
  box-sizing: border-box;
}

.main-content > :deep(*) {
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

/* === 侧边栏 === */
.sidebar {
  width: var(--sidebar-width);
  background: var(--surface-raised);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  transition: all var(--duration-slow) var(--ease-spring);
  box-shadow: 4px 0 24px var(--shadow-xs);
}
.sidebar::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 1px;
  height: 100%;
  background: linear-gradient(180deg, hsla(var(--brand-hue), 84%, 68%, 0.1), transparent 50%);
}

/* === Logo === */
.logo {
  height: 80px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  border-bottom: 1px solid var(--border-subtle);
  position: relative;
}
.logo::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20px;
  right: 20px;
  height: 2px;
  background: var(--brand-gradient);
  opacity: 0.4;
  border-radius: 1px;
}
.logo-img {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center;
  background: transparent;
  box-shadow: none;
  transition: all var(--duration-normal) var(--ease-spring);
  flex-shrink: 0;
}
.logo:hover .logo-img { transform: scale(1.06); }
.logo-text { font-size: 17px; font-weight: 700; color: var(--text-primary); letter-spacing: 0.02em; }
.logo-subtitle { font-size: 11px; color: var(--text-muted); font-weight: 400; margin-top: 2px; display: block; }

/* === 菜单 === */
.sidebar-menu { flex: 1; padding: 16px 12px; }

:deep(.el-sub-menu__title) {
  border-radius: var(--radius-md);
  margin: 2px 8px;
  padding-left: 16px !important;
  padding-right: 16px !important;
  height: 44px;
  line-height: 44px;
  transition: all var(--duration-normal) var(--ease-spring);
  color: var(--text-regular);
  font-weight: 500;
  position: relative;
  overflow: hidden;
}
:deep(.el-sub-menu__title::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: var(--brand-gradient);
  border-radius: 0 3px 3px 0;
  transition: height var(--duration-normal) var(--ease-spring);
}
:deep(.el-sub-menu__title:hover) {
  background: var(--surface-muted) !important;
  color: var(--text-primary);
}
:deep(.el-sub-menu__title:hover::before) { height: 60%; }
:deep(.el-menu-item) {
  border-radius: var(--radius-md);
  margin: 2px 8px;
  padding-left: 16px !important;
  padding-right: 16px !important;
  height: 44px;
  line-height: 44px;
  transition: all var(--duration-normal) var(--ease-spring);
  color: var(--text-regular);
  font-weight: 500;
  position: relative;
  overflow: hidden;
  border: 1px solid transparent;
}
:deep(.el-menu-item::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: var(--brand-gradient);
  border-radius: 0 3px 3px 0;
  transition: height var(--duration-normal) var(--ease-spring);
}
:deep(.el-menu-item:hover) {
  background: var(--surface-muted) !important;
  color: var(--text-primary);
  border-color: var(--border-default);
}
:deep(.el-menu-item:hover::before) { height: 60%; }
:deep(.el-menu-item.is-active) {
  background: var(--brand-gradient) !important;
  color: white !important;
  font-weight: 600;
  box-shadow: var(--brand-glow);
}
:deep(.el-menu-item.is-active::before) { height: 0 !important; }
:deep(.el-menu-item .el-icon) { transition: all var(--duration-normal) var(--ease-spring); }
:deep(.el-menu-item:hover .el-icon) { transform: scale(1.15) translateX(2px); }
:deep(.el-menu-item.is-active:hover .el-icon) { transform: scale(1.15) translateX(2px); }

/* === 用户信息 === */
.user-info {
  padding: 12px;
  border-top: 1px solid var(--border-subtle);
  margin-top: auto;
  background: linear-gradient(180deg, transparent, var(--surface-muted));
}
.user-avatar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--ease-spring);
  background: var(--surface-muted);
  border: 1px solid transparent;
}
.user-avatar:hover {
  background: var(--surface-raised);
  border-color: hsla(var(--brand-hue), 84%, 68%, 0.2);
  transform: translateX(4px);
  box-shadow: var(--shadow-sm);
}
.user-avatar .avatar {
  background: var(--brand-gradient);
  border: none;
  box-shadow: var(--brand-glow);
  transition: all var(--duration-normal) var(--ease-spring);
}
.user-avatar:hover .avatar { transform: scale(1.08); }
.user-details { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.user-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-role { font-size: 11px; color: var(--primary-500); font-weight: 700; margin-top: 2px; }
.dropdown-arrow {
  font-size: 12px;
  color: var(--text-muted);
  transition: all var(--duration-normal) var(--ease-spring);
}
.user-avatar:hover .dropdown-arrow { transform: translateY(2px); color: var(--primary-500); }

/* === 下拉菜单 === */
:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: var(--radius-md);
  margin: 4px 8px;
  transition: all var(--duration-fast) var(--ease-spring);
}
:deep(.el-dropdown-menu__item:hover) {
  background: var(--primary-50);
  color: var(--primary-500);
  transform: translateX(4px);
}
:deep(.el-dropdown-menu) {
  padding: 8px;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-subtle);
  background: var(--surface-raised);
}
</style>
