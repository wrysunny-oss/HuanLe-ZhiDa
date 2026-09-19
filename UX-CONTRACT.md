# 奖励型 APP 模板 UX Contract

## Product context

- Audience: 由派生项目定义的中文移动端内容用户与桌面端运营人员。
- Primary jobs: 使用当前内容模块、完成奖励、查看收益；配置内容、广告、邀请与提现规则。
- Target market: 中国大陆。
- Active locale: `zh-CN`。
- Timezone/calendar policy: `Asia/Shanghai`，公历。
- Accessibility target: WCAG 2.2 AA；移动端关键触点优先接近 44×44。

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
| --- | --- | --- | --- |
| 模板模块及依赖 | `product.config.json`, `产品配置说明.md` | 产品配置契约 | 2026-09-18 |
| API 与认证边界 | `Backend/src/docs/openapi.ts`, `Backend/src/middleware/auth.ts` | API / 权限实现 | 2026-09-17 |
| 奖励配置 | `contracts/reward.contract.json` | 三端接口契约 | 2026-09-17 |
| 提现状态与校验 | `Backend/src/modules/withdrawal` | 领域实现与测试 | 2026-09-17 |

## Visual contract

- Project `DESIGN.md`: `DESIGN.md`。
- Token ownership: 现有运行时令牌为权威来源，DESIGN.md 镜像已接受值。
- APP runtime source: `MobileReactNative/src/theme/index.ts` 与共享组件。
- Admin runtime source: Vben/Naive UI 现有主题和共享布局。
- Supported themes: 当前正式产品只承诺亮色主题；不提供未完成的主题切换入口。
- Template UI policy: 现有主题只用于归档基线与迁移期；每个派生 APP 必须建立自己的 DESIGN.md 并重构移动端 UI，不能只换皮。

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Form | `FormControls`, Admin 表单组件 | 现有共享组件 | 登录 / 编辑 | typecheck + workflow |
| Toast | `AppToast`, Admin message provider | 共享 provider | success / warning / error | interaction test |
| Dialog | APP `AppDialog`; Admin Naive UI `NDialogProvider` / `useDialog` | 共享 provider | alert / confirm / edit | viewport + focus |
| Empty/error | `DesignSystem.EmptyState` | APP 共享组件 | empty / failure / unavailable | narrow viewport |
| Navigation | `RootNavigator`, Admin route modules | 产品模块配置 | enabled / hidden | route + API tests |

## Navigation and module behavior

- `product.config.json` 是模板能力、内容类型和广告平台的唯一编辑入口，生成文件不可手改。
- 模块启用时，APP 页面、Admin 菜单和 Backend API 同时可用。
- 模块关闭时，入口从导航中移除；旧深链或手工 API 请求由 Backend 返回 404，表示该产品不存在此能力。
- `content.type` 决定内容插件和首页实现；未启用内容时使用通用状态页，不能残留短剧菜单、接口、页面或文案。
- 内容插件负责自己的搜索、详情、收藏、历史、播放器及解锁交互；通用导航只注册当前产品启用的页面。
- `advertising.provider` 决定唯一广告适配器；页面只能依赖统一 `AdProvider`，不得直接调用 GroMore、Taku 或其他厂商 SDK。
- `smsRegistration=false` 时隐藏注册标签，只保留已有账号登录。
- `invitations=false` 时注册不要求邀请码，分享、邀请码和邀请任务入口全部移除。
- `withdrawals=false` 时移除提现页面、按钮、收款账户表单及后台资金入口。
- Admin 父菜单跳转到第一个仍启用的子路由，不跳向已关闭模块。
- 模块依赖由同步脚本强制校验：邀请和提现依赖奖励，支付宝打款依赖提现。

## Async, validation and feedback

- 初始加载使用项目现有稳定骨架或品牌加载器；失败使用共享空状态并提供重试。
- 写操作使用稳定尺寸的忙碌按钮并阻止重复提交。
- 福利中心可在页面聚焦后预加载任务激励广告，但不得提前触发风控采集或发奖；离开页面时释放未展示广告，避免与内容解锁广告串用。
- SDK 完整观看信号只允许提示“收益确认中”；“奖励已到账”和金币余额更新必须等待服务端 SSV 回调完成结算。
- 表单错误保留非敏感输入；密码和密钥不得进入日志、URL、Toast 或持久缓存。
- APP 弹窗统一使用 `AppDialog`，禁止原生 `alert`/`confirm`/`prompt`。
- 服务端是认证、权限、资金和模块能力的最终边界，客户端隐藏只负责体验。

## Verification

- Required: 三端 typecheck、Backend tests、Admin/APP lint、`git diff --check`。
- Module matrix: 至少验证 `shortDrama + gromore`、`none + gromore`、`none + none`，以及关闭邀请、提现、短信注册的组合。
- Canonical sibling: APP 的 Profile 快捷入口、Tasks 任务入口和 RootNavigator 深层页面必须保持一致。
- Failure path: 关闭模块后，直接请求相关 API 应返回 404，不能执行副作用。

## 题库管理工作流

- 权威实现：`Backend/src/modules/quiz/quiz.admin.service.ts` 与 `Backend/src/modules/quiz/quiz.admin.schema.ts`。
- 题目编辑后必须自动变为 `DRAFT + PENDING`，旧审核结论不得继续用于发布。
- 只有 `APPROVED` 题目可以进入 `PUBLISHED`；拒绝审核必须填写原因，并强制保持草稿状态。
- 批量审核、上线与下线每次最多处理 100 道题；服务端先校验权限、对象完整性和整批状态，再在同一事务中全部执行或全部拒绝，前端隐藏或禁用按钮不构成鉴权。
- 所有编辑、审核、发布与下线操作必须记录操作者、对象、时间、请求路径及必要变更摘要。
- 列表使用服务端分页和筛选；搜索支持中文输入法、300ms 延迟和过期响应隔离，筛选条件写入 URL 以支持刷新恢复。

## 错题复习工作流

- 普通挑战答错后，服务端按“用户 + 题目”自动写入或累计错题记录；客户端提示不能替代服务端记录。
- 错题本使用服务端分页，展示当前题目内容、上次误选、正确答案、解析、错误次数和可练习状态。
- 错题专项练习每局 1–20 道，不发放金币；专项练习答对后自动移出对应错题，答错则继续累计。
- 清空错题本必须通过 APP `AppDialog` 二次确认，只清除错题记录，不删除历史成绩。

## 答题插屏广告工作流

- 仅普通挑战计入插屏频控；错题专项练习不计数、不展示。
- 成绩页必须先完整展示成绩和已获得金币，插屏只能由用户点击“再来一局”后在页面转场中触发。
- 完成局数按服务端答题 `sessionId` 去重；本机按用户隔离保存间隔局数、最近展示时间和当日展示次数。
- Admin 统一配置每几局一次、最小时间间隔、每日上限和本次启动首局豁免；关闭广告总开关或插屏开关后不得请求广告。
- 广告加载、展示、无填充或回调失败均不得阻止返回答题首页；尝试期间主操作保持稳定忙碌状态并阻止重复触发。
- 插屏不参与金币结算，不得伪装成题目、答案、成绩或领取已有奖励的必要步骤。

## 广告监控工作流

- 广告监控与广告参数配置使用独立页面；监控页只读，沿用 `operation:read` 权限，不得提供会影响投放或奖励结算的快捷操作。
- 时间范围仅提供最近 1 小时、24 小时、7 天和 30 天；概览、请求→加载→展示漏斗、失败原因排行与事件明细必须使用同一时间范围。
- 事件明细使用服务端分页，并支持广告类型、事件类型筛选；时间范围、筛选项和页码写入 URL，刷新与前进后退后可恢复。
- 加载失败必须保留页面结构并提供重试；无数据与无失败记录使用明确空状态，不以全零数据伪装接口故障。
- 客户端广告事件仅用于运营诊断，不参与奖励发放、金币结算或服务端 SSV 判定；页面必须持续展示这一边界。
- 开屏、原生信息流和横幅分别使用 `SPLASH`、`FEED`、`BANNER` 事件类型；不得为了复用页面组件而混用统计口径。
- 横幅只允许放在福利中心滚动内容区，必须带“广告”标识；加载失败或用户关闭后立即折叠，不得遮挡任务按钮、底部导航或奖励结果。
