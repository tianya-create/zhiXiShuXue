<template>
  <div class="login-container">
    <!-- Aurora 极光背景 -->
    <Aurora
      class="login-bg"
      :color-stops="['#6366F1', '#8B5CF6', '#EC4899']"
      :amplitude="1.2"
      :blend="0.6"
      :speed="0.8"
    />

    <!-- 装饰元素 -->
    <div class="bg-decoration">
      <div class="deco-circle deco-1"></div>
      <div class="deco-circle deco-2"></div>
      <div class="deco-circle deco-3"></div>
    </div>

    <!-- 登录卡片 -->
    <div class="login-box">
      <div class="login-logo">
        <div class="login-logo-icon">
          <el-icon :size="28"><Reading /></el-icon>
        </div>
        <h1>智析数学</h1>
        <p>智能教育分析平台</p>
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
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="login-btn"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-tips">
        <div class="demo-label">演示账号</div>
        <div class="account-list">
          <div
            v-for="account in demoAccounts"
            :key="account.username"
            class="account-item"
            :class="'is-' + account.type"
            @click="fillAccount(account)"
          >
            <span class="account-role">{{ account.label }}</span>
            <span class="account-user">{{ account.username }}</span>
          </div>
        </div>
        <p class="tip-text">点击卡片快速填充</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import Aurora from '@/components/Aurora.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const loginFormRef = ref(null)
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: ''
})

const loginRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const demoAccounts = [
  { label: '教师', username: 'teacher', password: 'teacher123', type: 'primary' },
  { label: '学生', username: 'student', password: 'student123', type: 'success' },
  { label: '管理员', username: 'admin', password: 'admin123', type: 'warning' }
]

function fillAccount(account) {
  loginForm.username = account.username
  loginForm.password = account.password
}

function handleLogin() {
  if (!loginFormRef.value) return

  loginFormRef.value.validate().then(function(valid) {
    if (!valid) return

    loading.value = true

    userStore.login(loginForm.username, loginForm.password).then(function(res) {
      if (res.success) {
        ElMessage.success('登录成功')

        const user = userStore.user
        let targetPath = '/login'

        if (user && user.role) {
          if (user.role === 'teacher') targetPath = '/teacher/dashboard'
          else if (user.role === 'student') targetPath = '/student/dashboard'
          else if (user.role === 'admin') targetPath = '/admin/dashboard'
        }

        if (route.query.redirect && String(route.query.redirect) !== '/login') {
          targetPath = String(route.query.redirect)
        }

        if (router.currentRoute.value.fullPath !== targetPath) {
          router.replace(targetPath)
        }
      } else {
        ElMessage.error(res.message || '登录失败')
      }
    }).catch(function(error) {
      console.error('登录错误:', error)
      ElMessage.error('登录失败，请检查网络连接')
    }).finally(function() {
      loading.value = false
    })
  }).catch(function() {})
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, hsl(40, 20%, 97%) 0%, hsl(220, 15%, 94%) 50%, hsl(40, 20%, 92%) 100%);
}

.login-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

/* 装饰圆形 */
.bg-decoration {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.deco-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  animation: float 12s ease-in-out infinite;
}

.deco-1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, hsla(var(--brand-hue), 84%, 68%, 0.25) 0%, transparent 70%);
  top: -150px;
  right: -100px;
}
.deco-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, hsla(calc(var(--brand-hue) + 30), 84%, 68%, 0.2) 0%, transparent 70%);
  bottom: -100px;
  left: -100px;
  animation-delay: -4s;
}
.deco-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, hsla(var(--danger-hue), 84%, 60%, 0.15) 0%, transparent 70%);
  top: 50%;
  left: 55%;
  transform: translate(-50%, -50%);
  animation-delay: -8s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(20px, -20px) scale(1.03); }
  66% { transform: translate(-15px, 15px) scale(0.98); }
}

/* 登录卡片 - 高级玻璃态效果 */
.login-box {
  position: relative;
  z-index: 10;
  background: hsla(0, 0%, 100%, 0.9);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-radius: var(--radius-2xl);
  padding: 52px 48px;
  width: 440px;
  border: 1px solid hsla(0, 0%, 100%, 0.8);
  box-shadow: var(--shadow-xl);
  animation: slideUp 0.6s var(--ease-spring);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(32px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.login-logo {
  text-align: center;
  margin-bottom: 40px;
}

.login-logo-icon {
  width: 72px;
  height: 72px;
  background: var(--brand-gradient);
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 32px;
  box-shadow: var(--brand-glow);
  margin-bottom: 24px;
  animation: breathe 4s ease-in-out infinite;
  transition: all var(--duration-normal) var(--ease-spring);
}

.login-logo-icon:hover {
  transform: scale(1.08) rotate(5deg);
}

@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

.login-logo h1 {
  font-family: 'Noto Serif SC', serif;
  font-size: 30px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: 0.05em;
}

.login-logo p {
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 10px;
  font-weight: 500;
}

/* 高级登录按钮 */
.login-btn {
  width: 100%;
  height: 52px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.08em;
  background: var(--brand-gradient) !important;
  border: none !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--brand-glow);
  transition: all var(--duration-normal) var(--ease-spring) !important;
  position: relative;
  overflow: hidden;
}

.login-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, hsla(0, 0%, 100%, 0.35), transparent);
  transition: left 0.6s var(--ease-out);
}

.login-btn:hover {
  background: var(--brand-gradient) !important;
  box-shadow: 0 12px 40px hsla(var(--brand-hue), 84%, 68%, 0.45);
  transform: translateY(-3px) scale(1.01);
}

.login-btn:hover::before {
  left: 100%;
}

.login-btn:active {
  transform: translateY(-1px) scale(0.99);
  box-shadow: var(--shadow-md);
}

/* 演示账号区域 */
.login-tips {
  margin-top: 36px;
}

.demo-label {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 18px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 700;
}

.account-list {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.account-item {
  flex: 1;
  max-width: 115px;
  padding: 16px 12px;
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--border-default);
  background: var(--surface-raised);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-spring);
  text-align: center;
  position: relative;
  overflow: hidden;
}

.account-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--brand-gradient);
  opacity: 0;
  transition: opacity var(--duration-normal);
}

.account-item:hover {
  transform: translateY(-5px) scale(1.03);
  background: var(--surface-raised);
  border-color: var(--primary-200);
  box-shadow: var(--shadow-md);
}

.account-item:hover::before {
  opacity: 1;
}

.account-item.is-primary:hover {
  border-color: hsla(var(--brand-hue), 84%, 68%, 0.4);
  box-shadow: 0 8px 24px hsla(var(--brand-hue), 84%, 68%, 0.2);
}

.account-item.is-success:hover {
  border-color: hsla(var(--success-hue), 90%, 45%, 0.4);
  box-shadow: 0 8px 24px hsla(var(--success-hue), 90%, 45%, 0.2);
}

.account-item.is-warning:hover {
  border-color: hsla(var(--warning-hue), 90%, 50%, 0.4);
  box-shadow: 0 8px 24px hsla(var(--warning-hue), 90%, 50%, 0.2);
}

.account-role {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.account-user {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
}

.tip-text {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 14px;
  font-weight: 500;
}

/* 输入框样式 */
:deep(.el-input__wrapper) {
  background: var(--surface-raised) !important;
  border: 1.5px solid var(--border-default) !important;
  box-shadow: none !important;
  border-radius: var(--radius-md) !important;
  padding: 4px 16px !important;
  transition: all var(--duration-normal) var(--ease-spring) !important;
}

:deep(.el-input__wrapper:hover) {
  border-color: var(--border-strong) !important;
}

:deep(.el-input__wrapper.is-focus) {
  border-color: hsla(var(--brand-hue), 84%, 68%, 0.6) !important;
  box-shadow: 0 0 0 4px hsla(var(--brand-hue), 84%, 68%, 0.1) !important;
  transform: scale(1.01);
  background: var(--surface-raised) !important;
}

:deep(.el-input__inner) {
  color: var(--text-primary) !important;
  font-weight: 500;
  font-size: 15px;
}

:deep(.el-input__inner)::placeholder {
  color: var(--text-muted) !important;
}

:deep(.el-input__prefix .el-icon) {
  color: var(--text-muted) !important;
  font-size: 16px;
}

:deep(.el-form-item__error) {
  color: var(--danger-500);
  font-size: 12px;
  font-weight: 600;
}

:deep(.el-form-item) {
  margin-bottom: 22px;
}

:deep(.el-form-item:last-child) {
  margin-bottom: 0;
  margin-top: 32px;
}
</style>
