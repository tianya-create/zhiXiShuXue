<template>
  <main class="login-page">
    <header class="brand" aria-label="智析数学">
      <img :src="logoImage" alt="智析数学" class="brand__logo" />
      <div>
        <strong>智析数学</strong>
        <span>初中数学智能学情分析平台</span>
      </div>
    </header>

    <section class="intro-card" aria-labelledby="intro-title">
      <p class="intro-tag">智能学习</p>
      <h1 id="intro-title">懂你所需，<br />学得恰好</h1>
      <p class="mechanism">认知负荷 <i>×</i> 学业控制感</p>
      <div class="learning-route" aria-hidden="true">
        <span class="route-line"></span>
        <span class="route-node route-node--start"></span>
        <span class="route-node route-node--middle"></span>
        <span class="route-node route-node--current"></span>
        <span class="route-node route-node--goal"></span>
        <span class="route-label route-label--one"></span>
        <span class="route-label route-label--two"></span>
      </div>
    </section>

    <section class="login-card" aria-labelledby="login-title">
      <div class="login-heading">
        <span aria-hidden="true"></span>
        <h2 id="login-title">欢迎回来</h2>
      </div>
      <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="loginForm.username" autocomplete="username" placeholder="用户名" size="large" class="login-input">
            <template #prefix><el-icon><User /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="loginForm.password" type="password" autocomplete="current-password" placeholder="密码" size="large" show-password class="login-input" @keyup.enter="handleLogin">
            <template #prefix><el-icon><Lock /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item class="submit-item">
          <el-button type="primary" native-type="submit" size="large" :loading="loading" class="login-button">登 录</el-button>
        </el-form-item>
      </el-form>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const logoImage = '/images/logo.png'
const loginFormRef = ref(null)
const loading = ref(false)
const loginForm = reactive({ username: '', password: '' })
const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

function handleLogin() {
  if (!loginFormRef.value) return

  loginFormRef.value.validate().then(function (valid) {
    if (!valid) return
    loading.value = true

    return userStore.login(loginForm.username, loginForm.password).then(function (result) {
      if (!result.success) {
        ElMessage.error(result.message || '登录失败')
        return
      }

      ElMessage.success('登录成功')
      const role = userStore.user?.role
      let targetPath = role === 'teacher' ? '/teacher/dashboard' : role === 'student' ? '/student/dashboard' : role === 'admin' ? '/admin/dashboard' : '/login'
      if (route.query.redirect && String(route.query.redirect) !== '/login') targetPath = String(route.query.redirect)
      if (router.currentRoute.value.fullPath !== targetPath) router.replace(targetPath)
    }).catch(function (error) {
      console.error('登录错误:', error)
      ElMessage.error('登录失败，请检查网络连接')
    }).finally(function () {
      loading.value = false
    })
  }).catch(function () {})
}
</script>

<style scoped>
@import '@fontsource/zcool-qingke-huangyou/400.css';

.login-page {
  --ink: #18214a;
  --blue: #2a55f5;
  min-height: 100vh;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(480px, 1.18fr) minmax(370px, .72fr);
  align-items: center;
  gap: clamp(44px, 5.6vw, 92px);
  padding: 130px clamp(28px, 8.4vw, 140px) 72px;
  position: relative;
  overflow: hidden;
  color: var(--ink);
  background-color: #f5f9ff;
  background-image: linear-gradient(rgba(91, 139, 224, .12) 1px, transparent 1px), linear-gradient(90deg, rgba(91, 139, 224, .12) 1px, transparent 1px);
  background-size: 34px 34px;
}

.login-page::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: clamp(42px, 5.3vw, 88px);
  width: 1px;
  content: '';
  background: rgba(240, 68, 62, .6);
}

.brand {
  position: absolute;
  z-index: 1;
  top: 35px;
  left: clamp(56px, 8.3vw, 140px);
  display: flex;
  align-items: center;
  gap: 13px;
}

.brand__logo { width: 56px; height: 56px; object-fit: contain; }
.brand strong { display: block; color: var(--ink); font-size: 28px; font-weight: 900; letter-spacing: .035em; }
.brand span { display: block; margin-top: 3px; color: #68789b; font-size: 13px; letter-spacing: .055em; }

.intro-card, .login-card {
  position: relative;
  z-index: 1;
  border: 1px solid #dce5f4;
  border-radius: 20px;
  background: rgba(255, 255, 255, .96);
  box-shadow: 0 16px 34px rgba(54, 83, 137, .1);
}

.intro-card { min-height: 430px; padding: clamp(48px, 6vh, 72px) clamp(46px, 5.4vw, 82px); overflow: hidden; }
.intro-tag { display: inline-block; margin: 0 0 24px; padding: 8px 16px; position: relative; z-index: 1; border-radius: 12px; color: var(--blue); background: #e8eeff; font-size: 18px; font-weight: 800; }
.intro-card h1 { margin: 0; position: relative; z-index: 1; color: #10225b; font-family: 'ZCOOL QingKe HuangYou', 'Microsoft YaHei', sans-serif; font-size: clamp(62px, 6.1vw, 92px); font-weight: 400; line-height: .98; letter-spacing: .04em; }
.mechanism { display: inline-block; margin: 36px 0 0; padding-bottom: 11px; position: relative; z-index: 1; color: #23376e; font-size: clamp(19px, 1.65vw, 27px); font-weight: 800; letter-spacing: .08em; }
.mechanism::after { position: absolute; right: -7px; bottom: 0; left: -4px; height: 7px; border-radius: 50%; content: ''; background: #ffd43b; transform: rotate(-1deg); }
.mechanism i { color: #345ff1; font-style: normal; }

.learning-route { position: absolute; z-index: 0; right: 24px; bottom: 20px; left: 56%; height: 140px; pointer-events: none; }
.route-line { position: absolute; right: 25px; bottom: 22px; left: 10px; height: 72px; border-bottom: 3px solid #94aeff; border-radius: 0 0 85% 0; transform: skewY(-18deg); }
.route-node { position: absolute; display: block; border-radius: 50%; background: #3567f4; box-shadow: 0 0 0 8px rgba(53, 103, 244, .09); }
.route-node--start { bottom: 16px; left: 5px; width: 14px; height: 14px; background: #a6bcff; box-shadow: none; }
.route-node--middle { bottom: 51px; left: 39%; width: 18px; height: 18px; }
.route-node--current { right: 31%; bottom: 74px; width: 21px; height: 21px; border: 3px solid #2a55f5; background: #eff3ff; }
.route-node--goal { right: 1px; bottom: 103px; width: 31px; height: 31px; box-shadow: 0 0 0 12px rgba(53, 103, 244, .12); }
.route-label { position: absolute; display: block; height: 18px; border-radius: 4px; background: #eaf0ff; }
.route-label--one { bottom: 0; left: 23%; width: 53px; }
.route-label--two { bottom: 115px; left: 59%; width: 70px; }

.login-card { width: min(100%, 438px); justify-self: end; padding: clamp(53px, 6.4vh, 76px) clamp(36px, 4.5vw, 58px) clamp(46px, 5.4vh, 63px); }
.login-heading { display: flex; align-items: center; gap: 20px; margin-bottom: 48px; }
.login-heading > span { display: block; width: 7px; height: 86px; border-radius: 999px; background: #f0443e; }
.login-heading h2 { margin: 0; color: var(--ink); font-family: 'ZCOOL QingKe HuangYou', 'Microsoft YaHei', sans-serif; font-size: clamp(42px, 3.4vw, 56px); font-weight: 400; letter-spacing: .055em; }
:deep(.el-form-item) { margin-bottom: 27px; }
:deep(.login-input .el-input__wrapper) { min-height: 64px; padding: 0 19px; border: 1px solid #cfdbf5; border-radius: 15px; background: #fff; box-shadow: none; transition: border-color .18s, box-shadow .18s; }
:deep(.login-input .el-input__wrapper:hover), :deep(.login-input .el-input__wrapper.is-focus) { border-color: #6687f4; box-shadow: 0 0 0 3px rgba(42, 85, 245, .1); }
:deep(.login-input .el-input__inner) { color: #243968; font-size: 16px; font-weight: 600; }
:deep(.login-input .el-input__inner::placeholder) { color: #8292b5; }
:deep(.login-input .el-input__prefix .el-icon), :deep(.login-input .el-input__suffix .el-icon) { color: #2a55f5; font-size: 18px; }
.submit-item { margin: 36px 0 0; }
:deep(.login-button) { width: 100%; height: 64px; border: 0; border-radius: 15px; color: #fff; background: #2a55f5; box-shadow: 0 10px 18px rgba(42, 85, 245, .2); font-size: 19px; font-weight: 800; letter-spacing: .45em; text-indent: .45em; transition: background .18s, transform .18s, box-shadow .18s; }
:deep(.login-button:hover) { background: #173fd2; box-shadow: 0 13px 22px rgba(42, 85, 245, .28); transform: translateY(-1px); }
:deep(.el-form-item__error) { font-weight: 600; }

@media (max-width: 1050px) {
  .login-page { grid-template-columns: 1fr; gap: 32px; padding: 130px 28px 52px; overflow: auto; }
  .brand { left: 54px; }
  .intro-card { width: min(100%, 720px); min-height: 380px; margin: 0 auto; }
  .login-card { justify-self: center; }
}

@media (max-width: 620px) {
  .login-page { padding: 114px 16px 36px; background-size: 27px 27px; }
  .login-page::before { left: 27px; }
  .brand { top: 20px; left: 39px; gap: 9px; }
  .brand__logo { width: 43px; height: 43px; }
  .brand strong { font-size: 23px; }
  .brand span { font-size: 10px; }
  .intro-card { box-sizing: border-box; min-height: 340px; padding: 34px 30px; }
  .intro-tag { margin-bottom: 18px; padding: 6px 12px; font-size: 14px; }
  .intro-card h1 { font-size: clamp(49px, 15vw, 68px); }
  .mechanism { margin-top: 25px; font-size: 15px; }
  .learning-route { right: 14px; bottom: 18px; left: 54%; transform: scale(.78); transform-origin: bottom right; }
  .login-card { box-sizing: border-box; width: 100%; padding: 42px 28px; }
  .login-heading { gap: 14px; margin-bottom: 35px; }
  .login-heading > span { width: 5px; height: 62px; }
  .login-heading h2 { font-size: 39px; }
  :deep(.login-input .el-input__wrapper), :deep(.login-button) { height: 56px; min-height: 56px; }
}

@media (prefers-reduced-motion: reduce) { :deep(*) { transition: none !important; } }
</style>
