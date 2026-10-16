# ---------- Stage 1: 构建前端 ----------
FROM node:22-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund
# shared 目录被前端源码引用（knowledge-tree.json），必须一并复制
COPY shared/ /build/shared/
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: 后端运行环境 ----------
# 注意：后端使用 node:sqlite（Node 22+ 内置模块），必须使用 Node 22 及以上
FROM node:22-alpine AS backend
WORKDIR /app

# 时区设为东八区，保证定时任务/日志时间正确
ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata curl && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

COPY backend/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY backend/ ./

# 后端 services/knowledge-graph.js 通过 ../../shared 引用共享数据，复制到镜像根
COPY shared/ /shared/

# 数据持久化目录（SQLite 库 + 用户上传文件）
RUN mkdir -p /app/database /app/uploads

ENV NODE_ENV=production
ENV API_PORT=5001

EXPOSE 5001

# node:sqlite 在 Node 22 为实验特性，显式开启标志确保可用
ENV NODE_OPTIONS=--experimental-sqlite

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5001/api/health || exit 1

CMD ["node", "server.js"]

# ---------- Stage 3: Nginx 托管前端 + 反向代理 ----------
FROM nginx:1.27-alpine AS web
ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

COPY --from=frontend-builder /build/frontend/dist /usr/share/nginx/html
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
