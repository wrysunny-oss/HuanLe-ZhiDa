# 幻乐灵玑笔记生产部署

目标环境：Alibaba Cloud Linux 3，Nginx 由服务器面板管理，Docker Compose 运行 Backend 与 MySQL 8.4。

本文只保留日常部署命令速查。首次部署、证书、Nginx、备份和验收说明参见 [完整生产部署指南](../生产部署操作指南.md)，异常处理参见 [线上故障排查手册](../docs/线上故障排查手册.md)。

## 1. 服务器目录

```bash
mkdir -p /opt/hanle/certs /data/hanle/mysql /data/hanle/uploads /data/hanle/backups
```

将项目上传到 `/opt/hanle/app`，并准备配置：

```bash
cd /opt/hanle/app/deploy
cp .env.example .env
cp backend.env.example backend.env
chmod 600 .env backend.env
```

把三个支付宝证书及 Taku eCPM PEM 私钥上传到 `/opt/hanle/certs`。支付宝应用私钥仅写入 `backend.env`；证书、PEM 和真实配置均不得提交到代码仓库。Docker 会将该目录只读挂载为容器内的 `/app/certs`。

编辑 `backend.env` 时必须补齐以下生产配置，不能保留 `replace_with_...` 或 `SMS_XXXXXXXXX`：

- JWT、提现数据密钥及 `TAKU_CALLBACK_SECRET`
- `TAKU_ECPM_PRIVATE_KEY_FILES_JSON`：真实 Key ID 对应容器内 `/app/certs/*.pem` 路径；格式见下方
- 支付宝 App ID、应用私钥、三个证书路径和已审核的转账场景
- 阿里云 RAM AccessKey、可用短信签名和验证码模板
- `APP_BRAND_NAME=幻乐灵玑笔记`
- `CORS_ORIGINS=https://admin.hyljzn.cn`
- `ADMIN_ACCESS_TOKEN_EXPIRES_IN=24h`
- `REFRESH_TOKEN_EXPIRES_IN=30d`

Taku 服务端激励回调地址配置为：

```text
https://api.hyljzn.cn/api/v1/webhooks/taku/reward
```

`TAKU_APP_KEY` 仅供 Android APP 构建时初始化 SDK，不在 Backend 环境变量中配置。不要把 Taku eCPM 私钥正文放进 Git；`deploy/backend.env` 中只配置 Key ID 与容器内 PEM 路径的映射。已有服务器的 `deploy/.env`、`deploy/backend.env` 应逐项补充，不能用新示例文件覆盖，否则可能改变数据库连接或密钥。映射格式：

```dotenv
TAKU_ECPM_PRIVATE_KEY_FILES_JSON='{"123":"/app/certs/taku-ecpm-server.pem"}'
```

把示例 `123` 改为 Taku 后台实际 Key ID，并确保对应 PEM 文件已上传。如服务器装有 Node.js，配置完成后可运行：

```bash
cd /opt/hanle/app
node scripts/doctor-product.mjs --production --backend-only
```

服务器未安装 Node.js 时，无须为了 Docker 部署单独安装；手工确认映射中的 PEM 文件在 `${CERT_ROOT}` 下存在，并在启动后检查容器日志与真实 Taku 回调。

## 2. 启动数据库并迁移

```bash
cd /opt/hanle/app/deploy
docker compose --env-file .env -f docker-compose.production.yml up -d mysql
docker compose --env-file .env -f docker-compose.production.yml --profile tools run --rm migrate
docker compose --env-file .env -f docker-compose.production.yml up -d backend
docker compose --env-file .env -f docker-compose.production.yml ps
curl http://127.0.0.1:3000/ready
curl https://api.hyljzn.cn/ready
```

每次发布 Backend 时都先执行迁移，再重建服务：

```bash
docker compose --env-file .env -f docker-compose.production.yml build backend migrate
docker compose --env-file .env -f docker-compose.production.yml --profile tools run --rm migrate
docker compose --env-file .env -f docker-compose.production.yml up -d backend
```

## 3. 构建并发布 Admin

在开发电脑的 `Admin` 目录执行：

```bash
pnpm --filter @vben/web-naive run build
```

将 `Admin/apps/web-naive/dist/` 中的文件上传到：

```text
/www/wwwroot/admin.hyljzn.cn
```

在面板创建两个 HTTPS 站点，将 `nginx/*.location.conf` 的内容加入对应站点。API 站点反向代理本机 `3000`，Admin 站点直接提供静态文件。

发布后打开 `https://admin.hyljzn.cn`，确认登录、数据看板、奖励配置和弹窗滚动均正常。

应用商店使用的隐私政策网址是 `https://api.hyljzn.cn/privacy-policy`。先在管理后台“运营配置 → 协议与关于”中创建并发布 `PRIVACY_POLICY` 文档，再部署 Backend；网页与 App 内使用同一份已发布内容。发布后在未登录的浏览器中打开网址，确认政策正文可见，再提交到应用商店。未发布文档时网页返回 503，不能用于商店审核。

## 4. APP 正式包

完整流程参见 [APP 版本发布指南](../docs/APP版本发布指南.md)。每次发布必须先递增 `versionCode`。

正式包必须明确指定 HTTPS API：

```powershell
cd MobileReactNative/android
.\gradlew.bat bundleRelease -PAPP_ENV=production -PAPP_API_ORIGIN=https://api.hyljzn.cn
```

生成文件位于 `MobileReactNative/android/app/build/outputs/bundle/release/app-release.aab`。正式打包前确认 APP 名称、`com.hylj.app`、Taku App ID/广告位与 Android SDK App Key 正确。本文只提供步骤，不会自动打包 APP。

## 5. 上线后核验

1. 新账号能收到阿里云注册验证码并完成注册。
2. 答题、金币、任务和邀请流程正常；福利中心激励视频达到每日上限后不再拉取。
3. Taku 真实激励回调验签成功，`ilrd` 中的加密收益可解密，收益、金币流水与用户余额一致。
4. 支付宝先用一笔最小提现档位验证打款和查单，不要直接批量全量打款。

## 6. 数据库维护

MySQL 只绑定 `127.0.0.1:3306`。本地管理数据库时通过 SSH 隧道连接，不要在安全组开放 3306。

生产数据库必须配置每日逻辑备份，并将备份复制到服务器之外。Docker 数据目录持久化不等于备份。
