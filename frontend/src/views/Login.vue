<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-logo">
        <h1>智慧教育平台</h1>
        <p>在线教育管理系统</p>
      </div>
      
      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入用户名"
            size="large"
            prefix-icon="User"
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            style="width: 100%"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
      
      <div class="login-tips">
        <el-divider>演示账号</el-divider>
        <div class="account-list">
          <el-tag
            v-for="account in demoAccounts"
            :key="account.username"
            :type="account.type"
            style="margin: 4px; cursor: pointer"
            @click="fillAccount(account)"
          >
            {{ account.label }}: {{ account.username }}
          </el-tag>
        </div>
        <p class="tip-text">点击标签自动填充账号密码</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import { useUserStore } from '@/stores/user'

var router = useRouter()
var route = useRoute()
var userStore = useUserStore()

var loginFormRef = ref(null)
var loading = ref(false)

var loginForm = reactive({
  username: '',
  password: ''
})

var loginRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

var demoAccounts = [
  { label: '教师', username: 'teacher', password: 'teacher123', type: 'primary', role: 'teacher' },
  { label: '学生', username: 'student', password: 'student123', type: 'success', role: 'student' },
  { label: '管理员', username: 'admin', password: 'admin123', type: 'warning', role: 'admin' }
]

// 填充演示账号
function fillAccount(account) {
  loginForm.username = account.username
  loginForm.password = account.password
}

// 处理登录
function handleLogin() {
  if (!loginFormRef.value) return
  
  loginFormRef.value.validate().then(function(valid) {
    if (!valid) return
    
    loading.value = true
    
    userStore.login(loginForm.username, loginForm.password).then(function(res) {
      if (res.success) {
        ElMessage.success('登录成功')
        
        // 根据角色跳转
        var user = userStore.user
        var role = ''
        if (user && user.role) {
          role = user.role
        }
        
        var targetPath = '/login'
        if (role === 'teacher') {
          targetPath = '/teacher/dashboard'
        } else if (role === 'student') {
          targetPath = '/student/dashboard'
        } else if (role === 'admin') {
          targetPath = '/admin/dashboard'
        }
        
        // 如果有重定向地址
        if (route.query.redirect && String(route.query.redirect) !== '/login') {
          targetPath = String(route.query.redirect)
        }

        if (router.currentRoute.value.fullPath === targetPath) {
          return
        }

        router.replace(targetPath)
      } else {
        ElMessage.error(res.message || '登录失败')
      }
    }).catch(function(error) {
      console.error('登录错误:', error)
      ElMessage.error('登录失败，请检查网络连接')
    }).finally(function() {
      loading.value = false
    })
  }).catch(function() {
    // 验证失败
  })
}
</script>

<style scoped>
/* 登录页面样式在全局样式中定义 */
</style>
