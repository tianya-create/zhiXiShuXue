import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const backendTarget = process.env.BACKEND_TARGET || 'http://127.0.0.1:5001'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5000,
    strictPort: true,
    host: '127.0.0.1',
    fs: {
      // katex 安装在项目根目录的 node_modules，开发模式下需要允许读取上一级目录（否则公式字体 403）
      allow: [path.resolve(__dirname, '..')]
    },
    proxy: {
      '/uploads': { target: backendTarget, changeOrigin: true },
      '/api': {
        target: backendTarget,
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'es2015',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('echarts')) return 'echarts-vendor'
          if (id.includes('element-plus') || id.includes('@element-plus')) return 'element-plus-vendor'
          if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) return 'vue-core-vendor'
          if (id.includes('axios') || id.includes('dayjs')) return 'http-utils-vendor'
          return 'vendor'
        }
      }
    }
  },
  esbuild: {
    target: 'es2015'
  }
})
