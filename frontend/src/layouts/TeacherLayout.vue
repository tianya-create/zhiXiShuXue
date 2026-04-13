<template>
  <div class="layout-container">
    <!-- 侧边栏 -->
    <div class="sidebar">
      <div class="logo">
        <el-icon :size="28"><Reading /></el-icon>
        <span class="logo-text">教师端</span>
      </div>
      
      <el-menu
        :default-active="currentRoute"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/teacher/dashboard">
          <el-icon><House /></el-icon>
          <span class="menu-text">首页</span>
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
        <el-dropdown @command="handleCommand">
          <div class="user-avatar">
            <el-avatar :size="40" icon="UserFilled" />
            <span class="user-name">{{ userName }}</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人设置</el-dropdown-item>
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
    router.push('/teacher/profile')
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
