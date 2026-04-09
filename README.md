# ghcr-worker

基于 Cloudflare Worker 的 GitHub Container Registry (ghcr.io) 镜像代理。

## 功能

- 透明代理 ghcr.io 的 Docker Registry V2 API
- 自动改写 `WWW-Authenticate` 和 `Location` 头，确保认证和重定向都走代理
- 只允许 `GET` / `HEAD` 只读访问，防止被滥用推送镜像
- CORS 支持，浏览器端可直接调用
- `/health` 健康检查端点

## 使用

将 Docker 镜像地址中的 `ghcr.io` 替换为 `ghcr.wio.me` 即可：

```bash
# 原始
docker pull ghcr.io/owner/image:tag

# 通过代理
docker pull ghcr.wio.me/owner/image:tag
```

## 部署

需要安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)：

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

自定义域名在 `wrangler.toml` 中配置。

## 配置

| 配置项 | 说明 |
|--------|------|
| `name` | Worker 名称 |
| `routes` | 自定义域名绑定 |
| `observability` | 日志观测开关 |
