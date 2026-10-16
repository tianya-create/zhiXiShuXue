#!/usr/bin/env bash
# =============================================================
# 智析数学平台 - 服务器初始化脚本
# 适用：腾讯云轻量应用服务器 Ubuntu 22.04 / Debian 12
# 作用：安装 Docker、docker compose 插件、git、配置镜像加速
# 用法：sudo bash init-server.sh
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

if [ "$(id -u)" -ne 0 ]; then
  warn "建议以 root 运行：sudo bash init-server.sh"
fi

# ---------- 1. 基础软件 ----------
info "更新软件源并安装基础工具..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg git ufw

# ---------- 2. 安装 Docker ----------
if command -v docker >/dev/null 2>&1; then
  info "Docker 已安装，跳过"
else
  info "安装 Docker（阿里云镜像源，国内服务器速度更快）..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null \
    || curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/debian/gpg \
       | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  # 用 ID= 精确判断发行版（不能用 ID_LIKE，Ubuntu 的 ID_LIKE 也含 debian）
  CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  DISTRO="ubuntu"
  [ "$(. /etc/os-release && echo "$ID")" = "debian" ] && DISTRO="debian"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/${DISTRO} ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable docker
  systemctl start docker
fi

# ---------- 3. Docker 镜像加速 ----------
info "配置 Docker 镜像加速..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.m.daocloud.io",
    "https://docker.1panel.live"
  ],
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
systemctl daemon-reload
systemctl restart docker

# ---------- 4. 防火墙 ----------
info "配置防火墙（放行 22/80/443，其余关闭）..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp   >/dev/null 2>&1 || true
  ufw allow 80/tcp   >/dev/null 2>&1 || true
  ufw allow 443/tcp  >/dev/null 2>&1 || true
  # 腾讯云镜像默认可能未启用 ufw，此处不强制 enable，避免锁死 SSH
  info "防火墙规则已添加（未强制启用，请配合腾讯云控制台安全组使用）"
fi

# ---------- 5. 完成 ----------
info "环境初始化完成 ✓"
docker --version
docker compose version
echo
echo "下一步："
echo "  1. 克隆/上传项目代码到服务器"
echo "  2. cd 到项目目录，执行： cp .env.example .env && vim .env  填写 AI Key"
echo "  3. 执行： sudo bash deploy/deploy.sh"
