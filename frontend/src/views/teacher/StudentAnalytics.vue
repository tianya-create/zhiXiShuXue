<template>
  <div class="student-analytics">
    <div class="page-header">
      <h2>学生学情分析</h2>
      <p>选一个学生，看他的成绩变化、知识点掌握度和错题。</p>
    </div>
    
    <el-card class="gradient-card">
      <template #header>
        <div class="card-header student-list-header">
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

    <el-card v-if="studentId" class="gradient-card adaptive-history-card">
      <template #header>认知—心理适配记录</template>
      <div v-if="adaptiveHistory.profile" class="profile-summary">
        <b>当前资源呈现偏好</b>
        <el-tag v-for="dimension in adaptiveHistory.profile.primaryDimensions" :key="dimension" effect="plain">{{ preferenceLabel(dimension) }}</el-tag>
        <span v-if="adaptiveHistory.profile.mixed">混合偏好</span>
      </div>
      <el-empty v-if="!adaptiveHistory.assessments.length" description="该学生还没有提交轮后感受" :image-size="72" />
      <el-table v-else :data="adaptiveHistory.assessments.slice(0, 10)" max-height="360">
        <el-table-column label="时间" min-width="150"><template #default="scope">{{ formatTime(scope.row.createdAt) }}</template></el-table-column>
        <el-table-column prop="knowledgePointId" label="知识点" min-width="130" />
        <el-table-column label="控制感" width="100"><template #default="scope"><el-tag :type="controlTag(scope.row.controlLevel)">{{ controlLabel(scope.row.controlLevel) }}</el-tag></template></el-table-column>
        <el-table-column prop="controlScore" label="控制感总分" width="110" />
        <el-table-column label="主观认知负荷" width="130"><template #default="scope">{{ loadLabel(scope.row.perceivedLoadLevel) }}（{{ scope.row.perceivedLoadScore || scope.row.answers?.cognitiveLoadItem || '-' }}分）</template></el-table-column>
      </el-table>
    </el-card>
    
    <el-card v-if="studentId" class="gradient-card analytics-card" v-loading="loading">
      <template #header>
        <div class="card-header analytics-toolbar">
          <div class="toolbar-left">
            <span class="toolbar-title">学生信息</span>
            <el-button type="success" plain @click="goToWrongQuestions">查看错题本</el-button>
            <el-button type="warning" plain @click="scrollToKnowledge">知识点掌握</el-button>
          </div>
          <el-button class="toolbar-export" type="primary" @click="exportPDF">导出学情报告</el-button>
        </div>
      </template>
      
      <el-descriptions :column="3" border v-if="studentInfo">
        <el-descriptions-item label="姓名">{{ studentInfo.name }}</el-descriptions-item>
        <el-descriptions-item label="学号">{{ studentInfo.studentNo }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ studentInfo.gender === 'male' ? '男' : '女' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
    
    <div v-if="studentId" class="chart-row">
      <div class="chart-col">
        <el-card class="gradient-card chart-card">
          <template #header>成绩趋势</template>
          <div ref="scoreChartRef" class="chart-container"></div>
        </el-card>
      </div>
      <div class="chart-col">
        <el-card class="gradient-card chart-card" id="knowledge-section">
          <template #header>知识点掌握度</template>
          <div ref="knowledgeChartRef" class="chart-container"></div>
        </el-card>
      </div>
      <div class="chart-col">
        <el-card class="gradient-card chart-card">
          <template #header>综合能力雷达</template>
          <div ref="levelChartRef" class="chart-container"></div>
        </el-card>
      </div>
    </div>
    
    <el-card v-if="studentId" id="wrong-questions-section" class="gradient-card wrong-section-card">
      <template #header>错题列表</template>
      <el-table :data="wrongQuestions" max-height="400" class="safe-table wrong-table">
        <el-table-column prop="content" label="题目内容" min-width="260">
          <template #default="scope">
            <MathText class="question-content" :text="scope.row.content" />
          </template>
        </el-table-column>
        <el-table-column prop="correctAnswer" label="正确答案" min-width="200">
          <template #default="scope">
            <MathText class="answer-text" :text="scope.row.correctAnswer" />
          </template>
        </el-table-column>
        <el-table-column prop="studentAnswer" label="学生答案" min-width="200">
          <template #default="scope">
            <MathText class="answer-text" :text="scope.row.studentAnswer" />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { NB_CHART as CHART_COLORS } from '@/utils/notebook-colors'
import MathText from '@/components/MathText.vue'
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/utils/api'
import * as echarts from 'echarts'
import { NB_ECHARTS_THEME, registerNotebookChartTheme } from '@/utils/notebook-colors'
registerNotebookChartTheme(echarts)

var route = useRoute()
var router = useRouter()
var loading = ref(false)
var studentInfo = ref(null)
var analytics = ref(null)
var adaptiveHistory = ref({ assessments: [], decisions: [], profile: null })
var scoreChartRef = ref(null)
var knowledgeChartRef = ref(null)
var levelChartRef = ref(null)
var scoreChart = null
var knowledgeChart = null
var levelChart = null
var renderTimer = null

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
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(function() {
  window.removeEventListener('resize', resizeCharts)
  if (renderTimer) {
    window.clearTimeout(renderTimer)
  }
  disposeCharts()
})

watch(studentId, function(newId) {
  adaptiveHistory.value = { assessments: [], decisions: [], profile: null }
  if (newId) {
    loadAnalytics()
  } else {
    analytics.value = null
    studentInfo.value = null
    disposeCharts()
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
      return api.get('/teacher/adaptation/students/' + studentId.value + '/history')
        .then(function(adaptiveRes) {
          if (adaptiveRes.success) adaptiveHistory.value = adaptiveRes.data
        })
        .catch(function() {})
        .then(function() { return nextTick() })
    }
  }).then(function() {
    renderCharts()
  }).catch(function(error) {
    console.error('加载失败:', error)
  }).finally(function() {
    loading.value = false
  })
}

function preferenceLabel(value) {
  return ({ V: '视觉型', A: '听觉型', R: '阅读书写型', K: '动觉实操型' })[value] || value
}

function loadLabel(value) {
  return ({ low: '低', medium: '中', high: '高' })[value] || '-'
}

function controlLabel(value) {
  return ({ low: '需支持', medium: '较稳定', high: '有把握' })[value] || value
}

function controlTag(value) {
  return ({ low: 'warning', medium: 'info', high: 'success' })[value] || 'info'
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

const knowledgePointMap = {
  'kp-001': '有理数',
  'kp-002': '加减法',
  'kp-003': '乘除法',
  'kp-005': '方程解法',
  'kp-007': '平行线'
}

function getKnowledgePointName(code) {
  return knowledgePointMap[code] || code
}

function getScoreValue(value) {
  if (typeof value === 'number') return value
  var parsed = parseFloat(value)
  return isNaN(parsed) ? 0 : parsed
}

function getMasteryValue(item) {
  var rawValue = item && typeof item === 'object' ? item.avgScore : item
  var parsed = parseFloat(rawValue)
  return isNaN(parsed) ? 0 : parsed
}

function getAverageMastery(mastery) {
  var values = Object.keys(mastery).map(function(key) {
    return getMasteryValue(mastery[key])
  }).filter(function(value) {
    return value > 0
  })

  if (values.length === 0) return 0
  var sum = values.reduce(function(total, value) {
    return total + value
  }, 0)
  return Math.round(sum / values.length)
}

function getChart(dom, chart) {
  if (!dom) return null
  if (!chart || chart.isDisposed()) {
    return echarts.init(dom, NB_ECHARTS_THEME)
  }
  return chart
}

function renderCharts() {
  nextTick(function() {
    if (renderTimer) {
      window.clearTimeout(renderTimer)
    }

    renderTimer = window.setTimeout(function() {
      var scoreDom = scoreChartRef.value
      var knowledgeDom = knowledgeChartRef.value
      var levelDom = levelChartRef.value

      if (!scoreDom || !knowledgeDom || !levelDom || scoreDom.clientWidth === 0) {
        return
      }

      var data = analytics.value || {}
      var mastery = data.knowledgePointMastery || {}
      renderScoreChart(scoreDom, data.scoreTrend || [])
      renderKnowledgeChart(knowledgeDom, mastery)
      renderLevelChart(levelDom, mastery, data.scoreTrend || [])
    }, 80)
  })
}

function renderScoreChart(dom, trend) {
  scoreChart = getChart(dom, scoreChart)
  if (!scoreChart) return

  var xData = trend.map(function(item, index) {
    if (item.date) return item.date.slice(5, 10)
    return '第' + (index + 1) + '次'
  })
  var yData = trend.map(function(item) {
    return getScoreValue(item.score)
  })

  if (xData.length === 0) {
    xData = ['暂无数据']
    yData = [null]
  }

  scoreChart.setOption({
    grid: { left: 36, right: 20, top: 30, bottom: 35 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xData,
      axisLabel: { color: CHART_COLORS.axis }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: CHART_COLORS.axis },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.22)' } }
    },
    series: [{
      name: '成绩',
      type: 'line',
      data: yData,
      smooth: true,
      symbolSize: 8,
      lineStyle: { color: CHART_COLORS.brand, width: 3 },
      itemStyle: { color: CHART_COLORS.brand },
      areaStyle: { color: 'rgba(45, 142, 232, 0.12)' }
    }]
  }, true)
}

function renderKnowledgeChart(dom, mastery) {
  knowledgeChart = getChart(dom, knowledgeChart)
  if (!knowledgeChart) return

  // 各知识点掌握度互相独立、加起来不等于 100%，所以用条形图而不是饼图；掌握度最低的排在最上面
  var list = Object.keys(mastery).map(function(key) {
    return {
      name: getKnowledgePointName(key),
      value: Math.round(getMasteryValue(mastery[key]))
    }
  }).sort(function(a, b) {
    return a.value - b.value
  }).slice(0, 8).reverse()

  var hasData = list.length > 0

  knowledgeChart.setOption({
    title: hasData ? { show: false } : {
      text: '暂无数据',
      left: 'center',
      top: 'middle',
      textStyle: { color: CHART_COLORS.axis, fontSize: 14, fontWeight: 'normal' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: function(v) { return v + '%' }
    },
    grid: { left: 8, right: 40, top: 10, bottom: 10, containLabel: true },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: CHART_COLORS.axis, formatter: '{value}%' },
      splitLine: { lineStyle: { color: CHART_COLORS.splitLine } }
    },
    yAxis: {
      type: 'category',
      data: list.map(function(item) { return item.name }),
      axisLabel: { color: CHART_COLORS.axis, width: 90, overflow: 'truncate' }
    },
    series: hasData ? [{
      name: '掌握度',
      type: 'bar',
      barMaxWidth: 22,
      data: list.map(function(item) {
        var color = item.value >= 80 ? CHART_COLORS.mastered : item.value >= 60 ? CHART_COLORS.learning : CHART_COLORS.weak
        return { value: item.value, itemStyle: { color: color, borderRadius: [0, 8, 8, 0] } }
      }),
      label: { show: true, position: 'right', formatter: '{c}%', color: CHART_COLORS.axis }
    }] : []
  }, true)
}

function renderLevelChart(dom, mastery, trendData) {
  levelChart = getChart(dom, levelChart)
  if (!levelChart) return

  var lastEntry = trendData.length > 0 ? trendData[trendData.length - 1] : null
  var latestScoreValue = lastEntry ? getScoreValue(lastEntry.score) : 0
  var masteryAverage = getAverageMastery(mastery)
  var wrongControl = Math.max(0, 100 - wrongQuestions.value.length * 8)

  levelChart.setOption({
    tooltip: {},
    radar: {
      radius: '62%',
      indicator: [
        { name: '最新成绩', max: 100 },
        { name: '知识点掌握', max: 100 },
        { name: '错题控制', max: 100 },
        { name: '稳定性', max: 100 }
      ],
      splitArea: { areaStyle: { color: ['rgba(45, 142, 232, 0.03)', 'rgba(45, 142, 232, 0.08)'] } },
      axisName: { color: CHART_COLORS.axis }
    },
    series: [{
      name: '综合能力',
      type: 'radar',
      data: [{
        value: [latestScoreValue, masteryAverage, wrongControl, calculateStability(trendData)],
        areaStyle: { color: 'rgba(52, 199, 193, 0.2)' },
        lineStyle: { color: CHART_COLORS.brandAlt, width: 3 },
        itemStyle: { color: CHART_COLORS.brandAlt }
      }]
    }]
  }, true)
}

function calculateStability(trendData) {
  if (!trendData || trendData.length < 2) return 80
  var scores = trendData.map(function(item) {
    return getScoreValue(item.score)
  })
  var average = scores.reduce(function(total, score) {
    return total + score
  }, 0) / scores.length
  var variance = scores.reduce(function(total, score) {
    return total + Math.pow(score - average, 2)
  }, 0) / scores.length
  return Math.max(0, Math.round(100 - Math.sqrt(variance)))
}

function resizeCharts() {
  if (scoreChart) scoreChart.resize()
  if (knowledgeChart) knowledgeChart.resize()
  if (levelChart) levelChart.resize()
}

function disposeCharts() {
  if (scoreChart) scoreChart.dispose()
  if (knowledgeChart) knowledgeChart.dispose()
  if (levelChart) levelChart.dispose()
  scoreChart = null
  knowledgeChart = null
  levelChart = null
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
  
  // 构建知识点掌握情况列表HTML
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
      font-size: 14px;
      color: #666;
    }
  <\/style>
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
    <p>智析数学 · 学情报告</p>
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
.student-analytics {
  overflow-x: clip;
  width: 100%;
  max-width: calc(100vw - var(--sidebar-width) - 48px);
  min-width: 0;
  box-sizing: border-box;
}

.analytics-card,
.adaptive-history-card,
.wrong-section-card,
.chart-card {
  margin-top: 20px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.profile-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; padding: 11px 13px; border-radius: 10px; background: var(--nb-blue-soft); color: var(--nb-ink-2); }
.profile-summary b { margin-right: 4px; color: var(--nb-ink); }

.student-list-header,
.analytics-toolbar,
.toolbar-left,
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  min-width: 0;
}

.student-list-header,
.analytics-toolbar {
  justify-content: space-between;
  width: 100%;
}

.header-left,
.toolbar-left {
  flex: 1 1 260px;
}

.toolbar-title {
  font-weight: 700;
  margin-right: 8px;
}

.toolbar-export {
  margin-left: auto;
}

.chart-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-top: 20px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.chart-col {
  min-width: 0;
  max-width: 100%;
}

.chart-container {
  width: 100%;
  height: 300px;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.question-content,
.answer-text {
  display: inline-block;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.5;
}

:deep(.el-card),
:deep(.el-card__body),
:deep(.el-card__header),
:deep(.el-table),
:deep(.el-table__inner-wrapper),
:deep(.el-scrollbar),
:deep(.el-scrollbar__wrap),
:deep(.el-descriptions),
:deep(.el-descriptions__body) {
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

:deep(.el-table) {
  width: 100% !important;
  max-width: 100% !important;
  table-layout: fixed;
}

:deep(.el-table__header-wrapper),
:deep(.el-table__body-wrapper),
:deep(.el-table__footer-wrapper) {
  width: 100% !important;
  max-width: 100% !important;
  overflow-x: hidden !important;
}

:deep(.el-table__header),
:deep(.el-table__body),
:deep(.el-table__footer) {
  width: 100% !important;
  max-width: 100% !important;
  table-layout: fixed !important;
}

:deep(.el-table__cell),
:deep(.el-table .cell),
:deep(.el-descriptions__cell) {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

:deep(.el-table__body-wrapper) {
  overflow-x: hidden;
}

@media (max-width: 768px) {
  .student-list-header,
  .analytics-toolbar {
    align-items: stretch;
  }

  .toolbar-export {
    width: 100%;
    margin-left: 0;
  }

  .chart-row {
    grid-template-columns: 1fr;
  }
}
</style>
