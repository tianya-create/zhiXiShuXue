<template>
  <div class="profile-page">
    <div class="page-header">
      <h2>个人设置</h2>
      <p>修改姓名、联系方式和登录密码。</p>
    </div>
    
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>基本信息</template>
          <el-form ref="infoFormRef" :model="infoForm" label-width="104px">
            <el-form-item label="用户名">
              <el-input v-model="infoForm.username" disabled />
            </el-form-item>
            <el-form-item label="姓名">
              <el-input v-model="infoForm.name" />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="infoForm.email" />
            </el-form-item>
            <el-form-item label="电话">
              <el-input v-model="infoForm.phone" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="updateInfo">保存修改</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>修改密码</template>
          <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="104px">
            <el-form-item label="原密码" prop="oldPassword">
              <el-input v-model="pwdForm.oldPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input v-model="pwdForm.newPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="pwdForm.confirmPassword" type="password" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="changePassword">修改密码</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

var infoFormRef = ref(null)
var pwdFormRef = ref(null)

var infoForm = reactive({
  username: '',
  name: '',
  email: '',
  phone: ''
})

var pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

var pwdRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: function(rule, value, callback) {
        if (value !== pwdForm.newPassword) {
          callback(new Error('两次密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

onMounted(function() {
  var userStr = localStorage.getItem('user')
  if (userStr) {
    try {
      var user = JSON.parse(userStr)
      if (user) {
        infoForm.username = user.username || ''
        infoForm.name = user.name || ''
        infoForm.email = user.email || ''
        infoForm.phone = user.phone || ''
      }
    } catch (e) {
      console.error('解析用户信息失败:', e)
    }
  }
})

function updateInfo() {
  var userStr = localStorage.getItem('user')
  var user = null
  if (userStr) {
    try {
      user = JSON.parse(userStr)
    } catch (e) {
      user = {}
    }
  }
  
  if (user) {
    user.name = infoForm.name
    user.email = infoForm.email
    user.phone = infoForm.phone
    localStorage.setItem('user', JSON.stringify(user))
    ElMessage.success('信息更新成功')
  }
}

function changePassword() {
  if (!pwdFormRef.value) return
  
  pwdFormRef.value.validate().then(function(valid) {
    if (!valid) return
    
    var userStr = localStorage.getItem('user')
    var userId = ''
    if (userStr) {
      try {
        var user = JSON.parse(userStr)
        userId = user.id || ''
      } catch (e) {
        userId = ''
      }
    }
    
    api.post('/auth/change-password', {
      userId: userId,
      oldPassword: pwdForm.oldPassword,
      newPassword: pwdForm.newPassword
    }).then(function(res) {
      if (res.success) {
        ElMessage.success('密码修改成功')
        pwdFormRef.value.resetFields()
      } else {
        ElMessage.error(res.message || '修改失败')
      }
    }).catch(function(error) {
      ElMessage.error('修改失败')
    })
  }).catch(function() {
    // 验证失败
  })
}
</script>
