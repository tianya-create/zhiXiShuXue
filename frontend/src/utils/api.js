import axios from 'axios'
import { captureException } from './sentry'

var api = axios.create({
  baseURL: '/api',
  timeout: 35000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(function (config) {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) { delete config.headers['Content-Type']; config.timeout = 120000 }
  var token = localStorage.getItem('token')
  if (token) config.headers.Authorization = 'Bearer ' + token
  var userStr = localStorage.getItem('user')
  var user = {}
  if (userStr) {
    try { user = JSON.parse(userStr) } catch (e) { user = {} }
  }
  if (user.id) config.headers['X-User-Id'] = user.id
  return config
})

api.interceptors.response.use(function (response) {
  return response.data
}, async function (error) {
  var config = error.config || {}
  var url = config.url || ''
  if (typeof url === 'string' && (url.includes('/api/log') || url.includes('daxuesoutijiang.com'))) {
    return Promise.reject(error)
  }
  config.__retryCount = config.__retryCount || 0
  if (config.method === 'get' && (error.code === 'ECONNABORTED' || !error.response) && config.__retryCount < 1) {
    config.__retryCount += 1
    return api(config)
  }
  captureException(error, { url: config.url, method: config.method })
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    if (window.location.pathname !== '/login') window.location.href = '/login'
  }
  return Promise.reject(error)
})

var request = {
  get: function (url, params) { return api.get(url, { params: params }) },
  post: function (url, data) { return api.post(url, data) },
  put: function (url, data) { return api.put(url, data) },
  delete: function (url) { return api.delete(url) },
  upload: function (url, file) { const data = new FormData(); data.append('file', file); return api.post(url, data) },
  // 带 token 的文件下载：axios 拿 blob，再触发浏览器另存为
  download: function (url, params, fileName) {
    return api.get(url, { params: params, responseType: 'blob', timeout: 120000 }).then(function (blob) {
      var objectUrl = URL.createObjectURL(blob)
      var link = document.createElement('a')
      link.href = objectUrl
      link.download = fileName || 'download.xlsx'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(function () { URL.revokeObjectURL(objectUrl) }, 1500)
      return true
    })
  }
}

request.student = {
  getAiTutorStatus: function () { return request.get('/ai-tutor/status') },
  askAiTutor: function (data) { return request.post('/ai-tutor/chat', data) },
  getWrongQuestions: function () { return request.get('/student/wrong-questions') },
  getWeakPoints: function () { return request.get('/student/weak-points') },
  getRecommendations: function (params) { return request.get('/student/recommendations', params) },
  submitAnswer: function (data) { return request.post('/student/answer/submit', data) },
  getMasteryTrend: function (params) { return request.get('/student/mastery/trend', params) },
  getKnowledgeDetail: function (kpId) { return request.get('/student/knowledge-point/' + kpId + '/detail') },
  getPracticeQuestions: function (kpId) { return request.get('/student/practice/' + kpId) },
  submitPractice: function (kpId, data) { return request.post('/student/practice/' + kpId + '/submit', data) },
  getQuestionsByKp: function (kpId) { return request.get('/student/questions', { knowledgePointId: kpId }) }
}

request.common = {
  getKnowledgeGraph: function (params) { return request.get('/common/knowledge-graph', params) },
  getWrongByKnowledge: function (knowledgeId) { return request.get('/common/wrong-q/' + knowledgeId) },
  getRecommendByKnowledge: function (knowledgeId) { return request.get('/common/recommend-q/' + knowledgeId) }
}

export default request
