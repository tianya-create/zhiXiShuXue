import axios from 'axios'

// 创建 axios 实例
var api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  function(config) {
    // 添加 token
    var token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = 'Bearer ' + token
    }
    
    // 添加用户 ID（后端需要）
    var userStr = localStorage.getItem('user')
    var user = {}
    if (userStr) {
      try {
        user = JSON.parse(userStr)
      } catch (e) {
        user = {}
      }
    }
    if (user.id) {
      config.headers['X-User-Id'] = user.id
    }
    
    return config
  },
  function(error) {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  function(response) {
    return response.data
  },
  function(error) {
    if (error.response) {
      var status = error.response.status
      if (status === 401) {
        // 未授权，清除登录信息
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        // 跳转到登录页面
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      } else if (status === 403) {
        console.error('没有权限')
      } else if (status === 404) {
        console.error('请求资源不存在')
      } else if (status === 500) {
        console.error('服务器错误')
      } else {
        console.error('请求错误:', error.response.data)
      }
    }
    
    return Promise.reject(error)
  }
)

// 封装请求方法
var request = {
  get: function(url, params) {
    return api.get(url, { params: params })
  },
  
  post: function(url, data) {
    return api.post(url, data)
  },
  
  put: function(url, data) {
    return api.put(url, data)
  },
  
  delete: function(url) {
    return api.delete(url)
  },
  
  // 上传文件
  upload: function(url, file, data, onProgress) {
    var formData = new FormData()
    formData.append('file', file)

    if (typeof data === 'function') {
      onProgress = data
      data = null
    }

    if (data) {
      var keys = Object.keys(data)
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i]
        if (data[key] !== undefined && data[key] !== null) {
          formData.append(key, data[key])
        }
      }
    }
    
    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: function(progressEvent) {
        if (onProgress) {
          var percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      }
    })
  }
}

export default request
