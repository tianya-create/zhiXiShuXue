<template>
  <div class="student-analytics">
    <div class="page-header">
      <h2>学生学情分析</h2>
      <p>查看学生个人学习情况</p>
    </div>
    
    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span>学生列表</span>
            <el-select v-model="selectedClassId" placeholder="选择班级" @change="loadStudents" style="width: 200px; margin-left: 20px">
              <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </div>
          <el-input
            v-model="searchQuery"
            placeholder="搜索学生姓名或学号"
            prefix-icon="Search"
            style="width: 300px"
          />
        </div>
      </template>
      
      <el-table :data="filteredStudents" style="width: 100%">
        <el-table-column prop="studentNo" label="学号" width="120" />
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="gender" label="性别" width="80">
          <template #default="scope">
            {{ scope.row.gender === 'male' ? '男' : '女' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button type="primary" link @click="viewStudentAnalytics(scope.row)">
              学情分析
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-card v-if="studentId" class="gradient-card" v-loading="loading" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span>学生信息</span>
            <el-button type="primary" @click="exportPDF">导出学情报告</el-button>
          </div>
          <div class="header-actions">
            <el-button type="success" plain @click="goToWrongQuestions">查看错题本</el-button>
            <el-button type="warning" plain @click="scrollToKnowledge">知识点掌握</el-button>
          </div>
        </div>
      </template>
      
      <el-descriptions :column="3" border v-if="studentInfo">
        <el-descriptions-item label="姓名">{{ studentInfo.name }}</el-descriptions-item>
        <el-descriptions-item label="学号">{{ studentInfo.studentNo }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ studentInfo.gender === 'male' ? '男' : '女' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
    
    <el-row v-if="studentId" :gutter="20" style="margin-top: 20px;">
      <el-col :span="8">
        <el-card class="gradient-card">
          <template #header>????</template>
          <div id="scoreChart" style="height: 300px;"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="gradient-card" id="knowledge-section">
          <template #header>?????</template>
          <div id="knowledgeChart" style="height: 300px;"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="gradient-card">
          <template #header>????</template>
          <div id="levelChart" style="height: 300px;"></div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-card v-if="studentId" id="wrong-questions-section" class="gradient-card" style="margin-top: 20px;">
      <template #header>错题列表</template>
      <el-table :data="wrongQuestions" max-height="400">
        <el-table-column prop="content" label="题目内容" show-overflow-tooltip />
        <el-table-column prop="correctAnswer" label="正确答案" width="120" />
        <el-table-column prop="studentAnswer" label="学生答案" width="120" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/utils/api'
import * as echarts from 'echarts'

var route = useRoute()
var router = useRouter()
var loading = ref(false)
var studentInfo = ref(null)
var analytics = ref(null)
var scoreChart = null
var knowledgeChart = null
var levelChart = null

// 学生列表相关
var students = ref([])
var searchQuery = ref('')
var classes = ref([])
var selectedClassId = ref('')

var studentId = computed(function() {
  return route.params.id
})

var wrongQuestions = computed(function() {
  if (!analytics.value || !analytics.value.wrongQuestions) {
    return []
  }
  return analytics.value.wrongQuestions
})

// 过滤后的学生列表
var filteredStudents = computed(function() {
  if (!searchQuery.value) {
    return students.value
  }
  var query = searchQuery.value.toLowerCase()
  return students.value.filter(function(student) {
    return student.name.toLowerCase().includes(query) || student.studentNo.toLowerCase().includes(query)
  })
})

onMounted(function() {
  loadClasses()
  loadAnalytics()
})

// 监听学生ID变化
watch(studentId, function(newId) {
  if (newId) {
    loadAnalytics()
  }
})

function loadClasses() {
  api.get('/teacher/classes').then(function(res) {
    if (res.success) {
      classes.value = res.data
      if (res.data.length > 0) {
        selectedClassId.value = res.data[0].id
        loadStudents()
      }
    }
  }).catch(function(error) {
    console.error('加载班级失败:', error)
  })
}

function loadStudents() {
  if (!selectedClassId.value) return
  
  api.get('/teacher/classes/' + selectedClassId.value + '/students').then(function(res) {
    if (res.success) {
      students.value = res.data
    }
  }).catch(function(error) {
    console.error('加载学生失败:', error)
  })
}

function loadAnalytics() {
  if (!studentId.value) return
  
  loading.value = true
  
  api.get('/teacher/analytics/student/' + studentId.value).then(function(res) {
    if (res.success) {
      studentInfo.value = res.data.student
      analytics.value = res.data
      return nextTick()
    }
  }).then(function() {
    renderCharts()
  }).catch(function(error) {
    console.error('加载失败:', error)
  }).finally(function() {
    loading.value = false
  })
}

// 知识点映射
const knowledgePointMap = {
  'kp-001': '有理数',
  'kp-002': '加减法',
  'kp-003': '乘除法',
  'kp-005': '方程解法',
  'kp-007': '平行线'
};

function getKnowledgePointName(code) {
  return knowledgePointMap[code] || code;
}

function renderCharts() {
  // ?????
  var scoreDom = document.getElementById('scoreChart')
  if (scoreDom) {
    if (scoreChart) scoreChart.dispose()
    scoreChart = echarts.init(scoreDom)

    var trend = analytics.value && analytics.value.scoreTrend ? analytics.value.scoreTrend : []
    var xData = []
    var yData = []
    for (var i = 0; i < trend.length; i++) {
      var t = trend[i]
      xData.push(t.date ? t.date.slice(5, 10) : '')
      yData.push(t.score)
    }

    scoreChart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: xData },
      yAxis: { type: 'value' },
      series: [{
        name: '??',
        type: 'line',
        data: yData,
        smooth: true,
        lineStyle: { color: '#409EFF' },
        areaStyle: { color: 'rgba(64, 158, 255, 0.1)' }
      }]
    })
  }

  var knowledgeDom = document.getElementById('knowledgeChart')
  if (knowledgeDom) {
    if (knowledgeChart) knowledgeChart.dispose()
    knowledgeChart = echarts.init(knowledgeDom)

    var mastery = analytics.value && analytics.value.knowledgePointMastery ? analytics.value.knowledgePointMastery : {}
    var keys = Object.keys(mastery).slice(0, 8)
    var pieData = []
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j]
      pieData.push({
        name: getKnowledgePointName(k),
        value: parseFloat(mastery[k].avgScore)
      })
    }

    knowledgeChart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        name: '????',
        type: 'pie',
        radius: ['40%', '70%'],
        data: pieData
      }]
    })
  }

  var levelDom = document.getElementById('levelChart')
  if (levelDom) {
    if (levelChart) levelChart.dispose()
    levelChart = echarts.init(levelDom)

    var wrongCount = wrongQuestions.value.length
    var masteryValues = analytics.value && analytics.value.knowledgePointMastery
      ? Object.values(analytics.value.knowledgePointMastery).map(function(item) { return parseFloat(item.avgScore || 0) })
      : []
    var avgMastery = masteryValues.length
      ? Math.round(masteryValues.reduce(function(sum, val) { return sum + val }, 0) / masteryValues.length)
      : 0
    var trendData = analytics.value && analytics.value.scoreTrend ? analytics.value.scoreTrend : []
    var latestScore = trendData.length ? trendData[trendData.length - 1].score : 0

    levelChart.setOption({
      radar: {
        indicator: [
          { name: '????', max: 100 },
          { name: '?????', max: 100 },
          { name: '????', max: 100 }
        ]
      },
      series: [{
        type: 'radar',
        data: [{
          value: [latestScore, avgMastery, Math.max(0, 100 - wrongCount * 10)],
          areaStyle: { color: 'rgba(103, 194, 58, 0.2)' },
          lineStyle: { color: '#67C23A' }
        }]
      }]
    })
  }
}

function goToWrongQuestions() {
  if (!studentId.value) return
  var el = document.getElementById('wrong-questions-section')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function scrollToKnowledge() {
  var el = document.getElementById('knowledge-section')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function viewStudentAnalytics(student) {
  router.push('/teacher/analytics/student/' + student.id)
}

function exportPDF() {
  if (!studentInfo.value || !analytics.value) {
    return
  }
  
  // 构建打印内容
  const studentName = studentInfo.value.name;
  const studentNo = studentInfo.value.studentNo;
  const gender = studentInfo.value.gender === 'male' ? '男' : '女';
  const currentDate = new Date().toLocaleString();
  
  // 构建错题列表HTML
  let wrongQuestionsHtml = '';
  wrongQuestions.value.forEach(q => {
    wrongQuestionsHtml += `
      <tr>
        <td>${q.content || ''}</td>
        <td>${q.correctAnswer || ''}</td>
        <td>${q.studentAnswer || ''}</td>
      </tr>
    `;
  });
  
  // 构建成绩趋势表格HTML
  let scoreTrendHtml = '';
  if (analytics.value.scoreTrend && analytics.value.scoreTrend.length > 0) {
    const dates = analytics.value.scoreTrend.map(item => item.date ? item.date.slice(5, 10) : '');
    const scores = analytics.value.scoreTrend.map(item => item.score);
    
    scoreTrendHtml = `
      <table class="info-table">
        <tr>
          <th>时间</th>
          ${dates.map(date => `<th>${date}</th>`).join('')}
        </tr>
        <tr>
          <th>成绩</th>
          ${scores.map(score => `<td>${score}</td>`).join('')}
        </tr>
      </table>
    `;
  } else {
    scoreTrendHtml = '<p>暂无成绩数据</p>';
  }
  
  // 构建知识点掌握情况表格HTML
  let knowledgeMasteryHtml = '';
  if (analytics.value.knowledgePointMastery) {
    const knowledgeItems = Object.entries(analytics.value.knowledgePointMastery);
    if (knowledgeItems.length > 0) {
      knowledgeMasteryHtml = `
        <table class="info-table">
          <tr>
            <th>知识点</th>
            <th>掌握度</th>
          </tr>
          ${knowledgeItems.map(([key, value]) => `
            <tr>
              <td>${getKnowledgePointName(key)}</td>
              <td>${typeof value === 'object' ? value.avgScore + '%' : value + '%'}</td>
            </tr>
          `).join('')}
        </table>
      `;
    } else {
      knowledgeMasteryHtml = '<p>暂无知识点数据</p>';
    }
  } else {
    knowledgeMasteryHtml = '<p>暂无知识点数据</p>';
  }
  
  // 构建完整的HTML
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>学生学情报告 - ${studentName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      line-height: 1.6;
    }
    h1, h2, h3 {
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .info-table th, .info-table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    .info-table th {
      background-color: #f2f2f2;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>学生学情报告</h1>
    <h2>${studentName} - ${studentNo}</h2>
    <p>生成时间: ${currentDate}</p>
  </div>
  
  <h3>一、学生基本信息</h3>
  <table class="info-table">
    <tr>
      <th>姓名</th>
      <td>${studentName}</td>
      <th>学号</th>
      <td>${studentNo}</td>
      <th>性别</th>
      <td>${gender}</td>
    </tr>
  </table>
  
  <h3>二、成绩趋势</h3>
  ${scoreTrendHtml}
  
  <h3>三、知识点掌握情况</h3>
  ${knowledgeMasteryHtml}
  
  <h3>四、错题列表</h3>
  <table class="info-table">
    <tr>
      <th>题目内容</th>
      <th>正确答案</th>
      <th>学生答案</th>
    </tr>
    ${wrongQuestionsHtml}
  </table>
  
  <div class="footer">
    <p>© 2024 在线教育平台</p>
  </div>
</body>
</html>
  `;
  
  // 创建一个新的窗口
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  
  if (printWindow) {
    // 写入内容
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // 等待内容加载完成
    printWindow.onload = function() {
      // 给用户一些时间查看内容
      setTimeout(function() {
        printWindow.print();
        
        // 打印完成后关闭窗口
        printWindow.onafterprint = function() {
          printWindow.close();
        };
      }, 500);
    };
  } else {
    alert('无法打开打印窗口，请检查浏览器设置');
  }
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
}
</style>
