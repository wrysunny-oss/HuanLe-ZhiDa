# 幻乐灵玑笔记项目约束

## 项目标识

- APP 名称：幻乐灵玑笔记
- 公司名称：幻乐灵玑
- Android applicationId：`com.hylj.app`（已申请备案，禁止更改）
- 产品代码：`huanle-zhida`
- 内容类型：`quiz`
- 管理后台名称：幻乐灵玑笔记管理后台

## 功能边界

- 保留登录、用户、金币、任务、邀请、提现、风控和版本更新能力。
- `shortDrama` 内容插件保持关闭。
- 广告模块暂时关闭，`advertising.provider` 保持为 `none`。
- 取得 Taku 正式应用和广告位资料后，才允许启用并接入 Taku。
- 不得重新启用旧 GroMore 配置作为正式广告方案。

## 开发约束

- `product.config.json` 是三端共享产品配置的唯一来源；修改后运行 `node scripts/sync-product-config.mjs`。
- APP 端需要在保留既有业务能力的前提下重新设计整套 UI。当前继承的 `DESIGN.md` 仅是模板参考，不是幻乐灵玑笔记的最终设计规范。
- 未经明确确认，不得推送远端。
- 禁止读取或操作 `D:\Project\HanLe-Theater-vscode`。
- 模板来源 `D:\Project\Reward-App-Template` 只允许读取 `template-v1.0.0-base` 标签，不得修改模板仓库。

