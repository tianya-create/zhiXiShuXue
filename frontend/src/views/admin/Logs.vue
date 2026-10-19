<template>
  <div class="admin-logs">
    <div class="page-header">
      <h2>操作日志</h2>
      <p>谁在什么时间做了什么操作，都记在这里。可以按操作类型筛选。</p>
    </div>
    
    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <span>日志列表</span>
          <el-select v-model="filterAction" placeholder="操作类型" @change="loadLogs" style="width: 150px;">
            <el-option label="全部" value="" />
            <el-option label="登录" value="LOGIN" />
            <el-option label="退出" value="LOGOUT" />
            <el-option label="创建" value="CREATE" />
            <el-option label="更新" value="UPDATE" />
            <el-option label="删除" value="DELETE" />
          </el-select>
        </div>
      </template>
      
      <el-table :data="logs" style="width: 100%" v-loading="loading">
        <el-table-column prop="action" label="操作类型" width="150">
          <template #default="scope">
            <el-tag :type="getActionType(scope.row.action)">{{ actionText(scope.row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="用户" width="200">
          <template #default="scope">{{ userText(scope.row) }}</template>
        </el-table-column>
        <el-table-column label="详情" show-overflow-tooltip>
          <template #default="scope">{{ detailsText(scope.row.details) }}</template>
        </el-table-column>
        <el-table-column prop="timestamp" label="时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.timestamp) }}
          </template>
        </el-table-column>
      </el-table>
      
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadLogs"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>
  </div>
</template>

<script setup>
import { actionText, detailsText, userText } from '@/utils/log-text'
import { ref, reactive, onMounted } from 'vue'
import api from '@/utils/api'
import dayjs from 'dayjs'

var loading = ref(false)
var filterAction = ref('')
var logs = ref([])

var pagination = reactive({ page: 1, pageSize: 20, total: 0 })

onMounted(function() {
  loadLogs()
})

function loadLogs() {
  loading.value = true
  api.get('/admin/logs', {
    action: filterAction.value,
    page: pagination.page,
    pageSize: pagination.pageSize
  })
  .then(function(res) {
    if (res.success) {
      logs.value = res.data.data
      pagination.total = res.data.total
    }
  })
  .catch(function(error) {
    console.error('加载失败:', error)
  })
  .finally(function() {
    loading.value = false
  })
}

function getActionType(action) {
  if (action === 'LOGIN') return 'success'
  if (action === 'LOGOUT') return 'info'
  if (action === 'CREATE') return 'primary'
  if (action === 'UPDATE') return 'warning'
  if (action === 'DELETE') return 'danger'
  return 'info'
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
