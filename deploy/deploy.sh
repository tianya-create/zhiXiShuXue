#!/usr/bin/env bash
# =============================================================
# 智析数学平台 - 一键部署脚本
# 适用：腾讯云轻量应用服务器 / CVM，Ubuntu 22.04 / Debian 12
# 用法：sudo bash deploy.sh
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

info "项目目录：$PROJECT_DIR"

# ---------- 1. 检查 Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  error "未检测到 Docker，请先运行 init-server.sh 安装环境"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  error "未检测到 docker compose 插件"
  exit 1
fi
info "使用命令：$DC"

# ---------- 2. 检查 .env ----------
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    warn ".env 不存在，已从 .env.example 复制，请填写 AI Key 后重新运行"
    cp .env.example .env
  else
    error "缺少 .env 与 .env.example"
    exit 1
  fi
fi

# docker compose 会把根目录 .env 注入后端容器；不要复制到 backend/.env，
# 否则密钥可能被 Docker 构建上下文写入镜像层。

# 生产环境首次初始化必须有独立的管理员密码和应用密钥。
JWT_SECRET_VALUE=""
ADMIN_PASSWORD_VALUE=""
for name in JWT_SECRET SETTINGS_SECRET APP_SECRET ADMIN_PASSWORD; do
  value="$(grep -E "^${name}=" .env | head -n 1 | cut -d '=' -f2- || true)"
  if [ -z "$value" ] || [[ "$value" == replace-with-* ]] || [[ "$value" == please-change-* ]]; then
    error ".env 中必须填写安全的 ${name}，不能保留示例占位值"
    exit 1
  fi
  if [ "$name" = "JWT_SECRET" ]; then JWT_SECRET_VALUE="$value"; fi
  if [ "$name" = "ADMIN_PASSWORD" ]; then ADMIN_PASSWORD_VALUE="$value"; fi
done
if [ "${#JWT_SECRET_VALUE}" -lt 32 ]; then
  error "JWT_SECRET 至少需要 32 位字符"
  exit 1
fi
if [ "${#ADMIN_PASSWORD_VALUE}" -lt 12 ]; then
  error "ADMIN_PASSWORD 至少需要 12 位字符"
  exit 1
fi

# 提示未填写的 AI Key
if grep -qE '^(LLM_API_KEY|AI_TUTOR_API_KEY|BAILIAN_API_KEY)=$' .env; then
  warn "检测到 AI Key 尚未填写，AI 小智/智能出题功能将不可用（不影响其他功能）"
fi

# ---------- 3. 准备持久化目录 ----------
mkdir -p backend/database backend/uploads
info "持久化目录已就绪：backend/database、backend/uploads"

# ---------- 4. 构建并启动 ----------
info "开始构建镜像（首次约 3-8 分钟，请耐心等待）..."
$DC build

info "启动容器..."
$DC up -d

# ---------- 5. 健康检查 ----------
info "等待服务就绪..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1/api/health >/dev/null 2>&1; then
    info "服务健康检查通过 ✓"
    break
  fi
  if [ "$i" -eq 30 ]; then
    warn "健康检查未通过，输出后端日志供排查："
    $DC logs --tail=50 backend
  fi
  sleep 2
done

PUBLIC_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo '<你的服务器公网IP>')"
echo
info "部署完成！"
echo -e "  访问地址：${GREEN}http://${PUBLIC_IP}${NC}"
echo "  首次登录：admin / 你在 .env 中设置的 ADMIN_PASSWORD"
echo "  教师和学生账号请在管理端创建或导入"
echo
echo "常用命令："
echo "  查看日志： $DC logs -f backend"
echo "  重启服务： $DC restart"
echo "  停止服务： $DC down"
echo "  更新代码后重新部署： git pull && $DC up -d --build"
