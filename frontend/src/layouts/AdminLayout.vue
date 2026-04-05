<template>
  <div class="layout-container">
    <!-- 侧边栏 -->
    <div class="sidebar">
      <div class="logo">
        <el-icon :size="28"><Setting /></el-icon>
        <span class="logo-text">管理端</span>
      </div>
      
      <el-menu
        :default-active="currentRoute"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/admin/dashboard">
          <el-icon><House /></el-icon>
          <span class="menu-text">首页</span>
        </el-menu-item>
        
        <el-menu-item index="/admin/users">
          <el-icon><User /></el-icon>
          <span class="menu-text">用户管理</span>
        </el-menu-item>

        <el-menu-item index="/admin/classes">
          <el-icon><OfficeBuilding /></el-icon>
          <span class="menu-text">班级列表管理</span>
        </el-menu-item>
        
        <el-menu-item index="/admin/knowledge-points">
          <el-icon><Share /></el-icon>
          <span class="menu-text">知识点管理</span>
        </el-menu-item>
        
        <el-menu-item index="/admin/questions">
          <el-icon><Document /></el-icon>
          <span class="menu-text">题库管理</span>
        </el-menu-item>
        
        <el-menu-item index="/admin/statistics">
          <el-icon><TrendCharts /></el-icon>
          <span class="menu-text">数据统计</span>
        </el-menu-item>
        
        <el-menu-item index="/admin/logs">
          <el-icon><List /></el-icon>
          <span class="menu-text">操作日志</span>
        </el-menu-item>
        
        <el-menu-item index="/admin/settings">
          <el-icon><Tools /></el-icon>
          <span class="menu-text">系统设置</span>
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
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
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
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(function() {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      ElMessage.success('已退出登录')
      window.location.href = '/login'
    }).catch(function() {})
  }
}
</script>

<style scoped>
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
