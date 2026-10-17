/**
 * 统一密钥配置
 * 生产环境请通过环境变量 JWT_SECRET 覆盖（.env / docker-compose env_file）
 */
const DEV_FALLBACK_SECRET = 'zhixi-math-dev-fallback-secret';

const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!process.env.JWT_SECRET) {
  console.warn('[security] 未配置 JWT_SECRET 环境变量，正在使用默认密钥，建议尽快在 .env 中设置');
}

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  DEV_FALLBACK_SECRET
};
