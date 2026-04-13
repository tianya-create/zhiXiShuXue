<template>
  <div class="layout-container student-theme-shell">
    <!-- 侧边栏 -->
    <div class="sidebar">
      <div class="logo">
        <el-icon :size="28"><Reading /></el-icon>
        <span class="logo-text">学生端</span>
      </div>
      
      <el-menu
        :default-active="currentRoute"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/student/dashboard">
          <el-icon><House /></el-icon>
          <span class="menu-text">首页</span>
        </el-menu-item>
        
        <el-menu-item index="/student/assignments">
          <el-icon><Document /></el-icon>
          <span class="menu-text">我的作业</span>
        </el-menu-item>
        
        <el-menu-item index="/student/knowledge">
          <el-icon><Share /></el-icon>
          <span class="menu-text">知识图谱</span>
        </el-menu-item>
        
          <el-menu-item index="/student/weak-points">
          <el-icon><WarningFilled /></el-icon>
          <span class="menu-text">薄弱知识点</span>
        </el-menu-item>
        
        <el-menu-item index="/student/practice">
          <el-icon><TrendCharts /></el-icon>
          <span class="menu-text">薄弱补练</span>
        </el-menu-item>
        
        <el-menu-item index="/student/wrong-questions">
          <el-icon><Edit /></el-icon>
          <span class="menu-text">错题本</span>
        </el-menu-item>

        <el-menu-item index="/student/learning-track">
          <el-icon><Clock /></el-icon>
          <span class="menu-text">学习轨迹</span>
        </el-menu-item>
        
        <el-menu-item index="/student/profile">
          <el-icon><Setting /></el-icon>
          <span class="menu-text">个人信息</span>
        </el-menu-item>
      </el-menu>
      
      <!-- 用户信息 -->
      <div class="user-info">
        <el-dropdown @command="handleCommand">
          <div class="user-avatar">
            <el-avatar :size="40" icon="UserFilled" />
            <span class="user-name">{{ userName }}</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人信息</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    
    <!-- 主内容区 -->
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

var router = useRouter()
var route = useRoute()

var currentRoute = computed(function() {
  return route.path
})

var userName = computed(function() {
  var userStr = localStorage.getItem('user')
  if (!userStr) return '用户'
  try {
    var user = JSON.parse(userStr)
    return user && user.name ? user.name : '用户'
  } catch (e) {
    return '用户'
  }
})

function handleCommand(command) {
  if (command === 'profile') {
    router.push('/student/profile')
  } else if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(function() {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      ElMessage.success('已退出登录')
      router.replace('/login')
    }).catch(function() {})
  }
}
</script>

<style scoped>
.student-theme-shell :deep(.el-button--primary) {
  color: #ffffff;
}

.student-theme-shell :deep(.el-button--primary span) {
  color: #ffffff;
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--primary-color);
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid var(--border-color);
}

.logo-text {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
}

.user-info {
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.user-avatar {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.3s;
}

.user-avatar:hover {
  background-color: var(--bg-gradient-start);
}

.user-name {
  font-size: 14px;
  color: var(--text-primary);
}
</style>
