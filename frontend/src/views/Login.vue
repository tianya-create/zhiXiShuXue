<template>
  <div class="login-container">
    <!-- 背景图片 -->
    <div class="login-bg">
      <img :src="bgImage" alt="背景" class="bg-image" />
      <div class="bg-overlay"></div>
    </div>

    <!-- 装饰元素 -->
    <div class="bg-decoration">
      <div class="deco-circle deco-1"></div>
      <div class="deco-circle deco-2"></div>
    </div>

    <!-- 左侧品牌区域 -->
    <div class="brand-section">
      <div class="brand-content">
        <p class="brand-subtitle">智能教育分析平台</p>
        <div class="brand-features">
          <div class="feature-item">
            <span class="feature-icon">✦</span>
            <span>个性化学习路径</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✦</span>
            <span>智能错题分析</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✦</span>
            <span>实时学情追踪</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧登录卡片 -->
    <div class="login-box">
      <div class="login-header">
        <img :src="logoImage" alt="logo" class="login-logo-img" />
        <h2>欢迎回来</h2>
        <p>请登录您的账号继续学习</p>
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
            class="custom-input"
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
            class="custom-input"
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
            登 录
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

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const bgImage = '/images/bg-login.png'
const logoImage = '/images/logo.png'

const loginFormRef = ref(null)
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: ''
})

const loginRules = {}

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
.login-container{min-height:100vh;display:flex;position:relative;overflow:hidden;background:#63c9dd;isolation:isolate}.login-bg{position:fixed;inset:0;z-index:0}.bg-image{width:100%;height:100%;object-fit:cover;object-position:center;filter:saturate(1.12) brightness(.9) contrast(1.02);transform:scale(1.012)}.bg-overlay{position:absolute;inset:0;background:radial-gradient(circle at 74% 50%,rgba(145,245,255,.24) 0,rgba(85,212,235,.16) 25%,transparent 45%),linear-gradient(90deg,rgba(3,31,58,.18) 0%,rgba(4,88,119,.1) 48%,rgba(81,210,226,.12) 100%),rgba(0,73,98,.04);mix-blend-mode:multiply}.bg-decoration{position:fixed;inset:0;z-index:1;pointer-events:none;overflow:hidden}.bg-decoration:before{content:none}.bg-decoration:after{content:'';position:absolute;left:0;bottom:0;width:100%;height:23%;background:linear-gradient(0deg,rgba(5,75,98,.22),transparent)}.deco-circle{position:absolute;border-radius:999px;filter:blur(22px);opacity:.55;animation:float 12s ease-in-out infinite}.deco-1{width:260px;height:260px;right:13%;top:17%;background:radial-gradient(circle,rgba(218,255,255,.55) 0%,rgba(77,224,243,.18) 52%,transparent 72%)}.deco-2{width:380px;height:380px;right:-7%;bottom:-12%;background:radial-gradient(circle,rgba(116,242,255,.42) 0%,rgba(116,242,255,.12) 55%,transparent 74%);animation-delay:-4s}@keyframes float{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(14px,-18px,0) scale(1.04)}}.brand-section{position:fixed;left:7.8%;top:58.5%;transform:translateY(-50%);z-index:10;color:#f5ffff;width:360px}.brand-content{animation:slideInLeft .8s ease-out}@keyframes slideInLeft{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:translateX(0)}}.brand-subtitle{width:max-content;margin:0 0 22px;color:#f7ffff;font-size:clamp(26px,2.25vw,38px);font-weight:900;letter-spacing:.08em;text-shadow:0 3px 8px rgba(0,44,70,.72),0 0 18px rgba(179,255,255,.7)}.brand-features{display:flex;flex-direction:column;gap:11px;padding-left:3px}.feature-item{display:flex;align-items:center;gap:12px;color:#f8ffff;font-size:clamp(18px,1.45vw,25px);font-weight:800;letter-spacing:.035em;text-shadow:0 3px 9px rgba(0,47,74,.72),0 0 14px rgba(195,255,255,.52)}.feature-icon{color:#dcfff2;font-size:15px;text-shadow:0 0 12px rgba(190,255,236,.95)}.login-box{position:fixed;right:clamp(32px,6.9vw,92px);top:50%;transform:translateY(-50%);z-index:10;width:clamp(360px,31vw,438px);min-height:min(86vh,650px);padding:clamp(38px,5.2vh,58px) clamp(40px,4vw,58px) clamp(26px,3.5vh,40px);border:2px solid rgba(231,255,255,.68);border-radius:27px;background:linear-gradient(155deg,rgba(220,255,255,.48) 0%,rgba(86,211,232,.22) 100%);box-shadow:inset 0 0 34px rgba(255,255,255,.42),inset 0 0 86px rgba(53,218,246,.18),0 0 20px rgba(221,255,255,.94),0 0 60px rgba(62,221,244,.56),0 26px 70px rgba(8,89,126,.22);backdrop-filter:blur(13px) saturate(1.25);-webkit-backdrop-filter:blur(13px) saturate(1.25);animation:slideInRight .8s ease-out}@keyframes slideInRight{from{opacity:0;transform:translateY(-50%) translateX(34px)}to{opacity:1;transform:translateY(-50%) translateX(0)}}.login-header{text-align:center;margin-bottom:clamp(28px,4.4vh,41px)}.login-logo-img{width:72px;height:72px;object-fit:contain;margin-bottom:20px;border-radius:50%;filter:drop-shadow(0 0 14px rgba(221,255,255,.95))}.login-header h2{margin:0 0 12px;color:#0c3751;font-size:clamp(25px,2.15vw,31px);font-weight:900;letter-spacing:.08em;text-shadow:0 2px 5px rgba(255,255,255,.62)}.login-header p{margin:0;color:rgba(11,57,82,.82);font-size:14px;font-weight:700;letter-spacing:.04em}:deep(.el-button--primary){--el-button-bg-color:transparent!important;--el-button-border-color:transparent!important;--el-button-hover-bg-color:transparent!important;--el-button-hover-border-color:transparent!important;--el-button-active-bg-color:transparent!important;--el-button-active-border-color:transparent!important}:deep(.login-btn){width:100%;height:58px;margin-top:2px;border:1.5px solid rgba(215,255,255,.88)!important;border-radius:11px!important;background:linear-gradient(90deg,rgba(100,240,236,.85) 0%,rgba(38,174,232,.92) 100%)!important;color:#fff!important;font-size:18px;font-weight:900;letter-spacing:.48em;text-indent:.48em;box-shadow:inset 0 1px 12px rgba(255,255,255,.46),0 0 14px rgba(218,255,255,.88),0 0 30px rgba(35,216,239,.74),0 11px 24px rgba(24,151,204,.22)!important;transition:transform .22s ease,box-shadow .22s ease,filter .22s ease!important}:deep(.login-btn):hover{transform:translateY(-1px);filter:brightness(1.07);box-shadow:inset 0 1px 14px rgba(255,255,255,.5),0 0 20px rgba(230,255,255,.98),0 0 42px rgba(35,216,239,.86),0 13px 28px rgba(24,151,204,.28)!important}:deep(.login-btn):active{transform:translateY(0)}.login-tips{margin-top:clamp(28px,4.8vh,43px)}.demo-label{margin-bottom:17px;text-align:center;color:rgba(8,55,82,.74);font-size:13px;font-weight:800;letter-spacing:.08em}.account-list{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.account-item{min-height:72px;padding:15px 8px 11px;border:1.5px solid rgba(220,255,255,.9);border-radius:10px;background:rgba(233,255,255,.56);box-shadow:inset 0 1px 12px rgba(255,255,255,.55),0 0 13px rgba(217,255,255,.82),0 0 22px rgba(61,223,239,.34);cursor:pointer;text-align:center;transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease,background .22s ease}.account-item:hover{transform:translateY(-3px);border-color:#f2ffff;background:rgba(244,255,255,.72);box-shadow:inset 0 1px 14px rgba(255,255,255,.68),0 0 18px rgba(232,255,255,.98),0 0 30px rgba(61,223,239,.54)}.account-role{display:block;margin-bottom:5px;color:#0a405e;font-size:14px;font-weight:900;letter-spacing:.04em}.account-user{display:block;color:rgba(9,55,78,.62);font-size:12px;font-weight:700;letter-spacing:.01em}.tip-text{margin-top:14px;text-align:center;color:rgba(244,255,255,.9);font-size:12px;font-weight:700;letter-spacing:.05em;text-shadow:0 0 8px rgba(0,116,156,.32)}:deep(.el-form-item){margin-bottom:20px}:deep(.el-form-item:last-child){margin-top:28px;margin-bottom:0}:deep(.custom-input .el-input__wrapper){min-height:54px;padding:0 17px!important;border:1.5px solid rgba(222,255,255,.86)!important;border-radius:10px!important;background:rgba(240,255,255,.48)!important;box-shadow:inset 0 1px 10px rgba(255,255,255,.58),0 0 12px rgba(227,255,255,.82),0 0 23px rgba(74,226,240,.38)!important;transition:all .22s ease!important}:deep(.custom-input .el-input__wrapper:hover){border-color:rgba(244,255,255,.96)!important;background:rgba(248,255,255,.58)!important}:deep(.custom-input .el-input__wrapper.is-focus){border-color:#f4ffff!important;box-shadow:inset 0 1px 12px rgba(255,255,255,.66),0 0 17px rgba(237,255,255,.94),0 0 32px rgba(40,218,240,.64)!important}:deep(.custom-input .el-input__inner){color:#123b53!important;font-size:14px;font-weight:700}:deep(.custom-input .el-input__inner::placeholder){color:rgba(19,66,89,.66)!important}:deep(.custom-input .el-input__prefix .el-icon),:deep(.custom-input .el-input__suffix .el-icon){color:rgba(21,109,136,.72)!important;font-size:16px}:deep(.el-form-item__error){margin-top:2px;color:#c02626;font-size:12px;font-weight:700;text-shadow:0 1px 3px rgba(255,255,255,.55)}@media (max-width:1024px){.brand-section{display:none}.login-box{right:50%;width:min(88vw,438px);transform:translateY(-50%) translateX(50%)}}@media (max-width:520px){.login-box{min-height:auto;padding:34px 24px 26px}.account-list{gap:8px}}
</style>
