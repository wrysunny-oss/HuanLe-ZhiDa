---
version: beta
name: "幻乐智答产品设计系统"
description: "面向中文知识答题用户的深靛知识空间，以及清晰可靠的运营后台。"
colors:
  background: "#0B0A17"
  surface: "#151329"
  surface-alt: "#1D1A36"
  surface-highlight: "#282348"
  primary: "#8B7CFF"
  primary-pressed: "#7464EB"
  primary-soft: "#242044"
  text: "#F7F5FF"
  muted: "#AAA5C2"
  success: "#52D6A4"
  danger: "#FF7C91"
  warning: "#F5C96A"
  border: "#312D4A"
typography:
  sans:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "15px"
    lineHeight: "22px"
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "30px"
    lineHeight: "38px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button: {}
  card: {}
  answer-option: {}
  knowledge-rail: {}
  empty-state: {}
  bottom-navigation: {}
---

# 幻乐智答产品设计系统

本文件是 APP 和管理后台的长期视觉与交互约束。APP 的运行时令牌以 `MobileReactNative/src/theme/index.ts` 为唯一来源；本文件记录产品意图、使用规则和跨页面一致性。

## Overview

### Creative North Star

APP 是一间“深靛知识空间”：低刺激的深靛背景承载专注阅读，电光紫标记主操作和当前进度，薄荷绿与珊瑚红只用于答题结果。页面不模拟教室，也不使用儿童化卡通、霓虹游戏厅或无意义渐变。

### Product context and register

- **Audience and primary job:** 中文移动端用户快速开始一局知识挑战、逐题获得反馈、查看成绩，并管理金币、邀请与提现。
- **Target market and locale:** 中国大陆市场，简体中文，业务时间使用 `Asia/Shanghai`。
- **Usage scene:** 单手移动操作，单题专注阅读，连续完成 5–20 道题；后台为桌面高密度运营场景。
- **Register:** 清醒、可信、有轻微探索感；不幼稚，不把奖励包装成赌博式刺激。
- **Memorable signature:** “知识轨道”贯穿首页、答题进度和结算页，由细线与节点组成，表达知识逐步点亮。
- **Restraint:** 资金、认证、风控和错误状态优先使用熟悉的产品模式，视觉表达不得牺牲可读性。
- **Anti-references:** 禁止廉价霓虹、玻璃拟态、滥用渐变、卡片套卡片、无意义装饰插画和密集徽章。

### Functional boundary

- 保留登录、用户、金币、任务、邀请、提现、风控、通知和版本更新能力。
- APP 的一级入口为答题、福利、收益、我的；已关闭的短剧和广告能力不显示占位入口。
- 奖励必须以服务端结算为准。客户端不得预先增加余额，也不得用视觉反馈代替真实到账状态。
- Android 包名固定为 `com.hylj.app`，不得因设计或模块调整而改变。

## Colors

- `background` 承载整页，`surface` 用于主要题目和结果表面，`surface-alt` 用于次级选择与列表。
- `primary` 只用于主按钮、选中答案、当前导航和知识轨道进度，不作为大面积背景装饰。
- `success` 只表达正确或成功，`danger` 只表达错误或风险，`warning` 用于金币和需要注意的信息。
- 正文与背景应保持稳定对比；禁用状态通过透明度和交互阻断共同表达。

## Typography

使用系统无衬线字体以保证 Android/iOS 中文覆盖。正文基线为 15/22；题干使用 25/36 且最多保持舒适的 2–5 行。数字成绩可使用更大字号与高字重，但不引入装饰字体。

## Layout

- 页面水平内边距为 16px，主要区块间距为 24–32px。
- 答题页一次只呈现一道题；答案选项触控高度不低于 56px。
- 底部导航高 76px，一级入口始终带文字标签，不依赖图标猜测含义。
- 答案解析区域预留稳定空间，提交前后不得导致题目和操作按钮明显跳动。
- 小屏设备允许内容滚动，主操作固定在安全区上方并避免遮挡最后一项。

## Elevation & Depth

默认通过色阶和 1px 边框分层。仅登录焦点面板等极少数表面使用轻阴影；答题卡、选项和结果面板不堆叠发光阴影。

## Shapes

输入和按钮使用 12–16px 圆角，卡片使用 16px，大型焦点容器最大 24px。胶囊形只用于短标签和奖励提示，不用于常规按钮与所有卡片。

## Components

- 按钮、卡片、空状态、列表行复用 `MobileReactNative/src/components` 中的共享组件。
- `KnowledgeRail` 是答题产品签名，只表达进度，不承担导航或可点击步骤功能。
- 答案选项必须包含 A/B/C/D 文本索引；提交后正确项始终显示，用户误选项同时显示错误状态。
- 重要操作保留文字标签。图标使用项目 `AppIcon` 语义名称，不使用 emoji 代替产品图标。
- 动效只表达按压、导航与状态变化，并尊重系统减少动态效果设置。

## Resilient states

- 首页必须覆盖加载、空题库、网络错误和重试状态。
- 提交按钮在未选答案、请求中和已提交时保持明确且不可重复触发。
- 服务端以 requestId 保证开局幂等，以题号保证答题顺序；客户端应显示服务端返回的真实下一题与奖励。
- 长题干和长选项允许换行，不能挤压索引或越过安全区。

## Do's and Don'ts

- **Do:** 让题干、答案和下一步操作成为每个答题页面的三个最高层级。
- **Do:** 使用知识轨道建立跨页面连续感，用语义色表达答案状态。
- **Do:** 对资金、认证和模块权限同时执行客户端入口控制与服务端校验。
- **Don't:** 为了“活泼”堆叠渐变、光晕、排行榜徽章或夸张金币动画。
- **Don't:** 在功能页面散落新的十六进制颜色、间距或圆角。
- **Don't:** 用隐藏按钮代替后端权限或模块边界。

## 幻乐智答管理后台

- 后台延续 Vben/Naive UI 的高密度桌面工作流，不复制 APP 深色表现层。
- 题库审核采用“校阅台”语义：状态总览、筛选表格和右侧校对抽屉构成主工作区。
- 发布状态与审核状态使用独立语义色，不以装饰性色彩代替业务状态。
- 批量操作必须显示选择范围；发布、下线和拒绝必须明确展示操作对象和后果。
- 中文搜索支持输入法组合过程，远程请求默认延迟 300ms，并忽略过期响应。
