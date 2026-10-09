---
version: alpha
name: "幻乐灵玑笔记产品设计系统"
description: "面向中文知识答题用户的亮色知识贴纸册，以及清晰可靠的运营后台。"
colors:
  background: "#F6F7FD"
  surface: "#FFFFFF"
  surface-alt: "#F0F2FB"
  surface-highlight: "#E3E6F2"
  primary: "#D04439"
  primary-pressed: "#B83A32"
  primary-soft: "#FFE5E1"
  secondary: "#6369D8"
  secondary-soft: "#E8E9FF"
  accent: "#147F78"
  accent-soft: "#DDF6F0"
  text: "#29263E"
  muted: "#6E6B82"
  subtle: "#9A97AA"
  success: "#167B62"
  success-soft: "#DDF6ED"
  danger: "#C93E5B"
  danger-soft: "#FFE3EA"
  warning: "#A86100"
  warning-soft: "#FFF0C7"
  playful: "#F3C64E"
  border: "#DDE0EC"
  divider: "#E9EBF3"
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
  button:
    backgroundColor: "#D04439"
    textColor: "#FFFFFF"
    rounded: "12px"
    height: "48px"
  card:
    backgroundColor: "#FFFFFF"
    rounded: "16px"
    padding: "16px"
  answer-option:
    backgroundColor: "#FFFFFF"
    textColor: "#29263E"
    rounded: "16px"
    height: "64px"
  knowledge-rail:
    backgroundColor: "#D04439"
    rounded: "3px"
    height: "6px"
  empty-state:
    backgroundColor: "#F0F2FB"
    textColor: "#6E6B82"
  bottom-navigation:
    backgroundColor: "#FFFFFF"
    height: "80px"
---

# 幻乐灵玑笔记产品设计系统

本文件是 APP 与管理后台的长期视觉约束。APP 的运行时令牌以 `MobileReactNative/src/theme/index.ts` 为权威来源，本文件镜像已接受的准确值并解释使用意图；每次修改全局视觉决策时，两者必须在同一变更中同步。

## Overview

### Creative North Star

APP 是一本会回应用户的“知识贴纸册”：冷白纸面保持轻盈和可读性，珊瑚红标记当前行动，蓝紫色承载探索氛围，薄荷绿和暖黄色分别表达正确反馈与奖励。页面可以有少量错位、旋转和贴纸感，但信息排列始终稳定，不能为了俏皮牺牲答题阅读、资金可信度或触控准确性。

### Product context and register

- **Audience and primary job:** 中文移动端用户快速开始一局知识挑战、逐题获得反馈、查看成绩，并管理金币、任务、邀请与提现。
- **Target market and locale:** 中国大陆市场，简体中文，业务时间使用 `Asia/Shanghai`。
- **Usage scene:** 单手移动操作，一次连续完成 5–10 道题；长题干与长选项必须自然换行。
- **Register:** 轻快、聪明、有陪伴感，但不幼稚，不把奖励包装成赌博刺激。
- **Memorable signature:** “跳格知识轨道”贯穿首页、答题进度和结算页。节点采用小菱形，像贴纸册中的闯关标记。
- **Restraint:** 每个屏幕最多使用一个明显旋转或错位的焦点表面；普通列表、表单、认证、风控与资金信息保持端正。
- **Anti-references:** 禁止旧剧场播放键、暗色影院氛围、霓虹游戏厅、玻璃拟态、滥用渐变、密集徽章、持续弹跳和卡片套卡片。

### Functional boundary

- 保留登录、用户、金币、任务、邀请、提现、风控、通知与版本更新能力。
- 一级入口为答题、福利、收益、我的；关闭的短剧与广告能力不显示占位入口。
- 奖励和余额必须以服务端结算为准，客户端不得提前增加余额或把待确认为已到账。
- Android 包名固定为 `com.hylj.app`，设计和模块调整不得改变它。

## Colors

- `background` 是冷白纸面；`surface` 是内容卡；`surface-alt` 用于输入、次级列表与未选状态。
- `primary` 只用于主要操作、当前导航和答题选择；不得铺满大段正文背景。
- `secondary` 负责知识探索和内容分组，`accent` 负责可靠、完成和辅助信息，`playful` 只用于极少量贴纸亮点。
- `success`、`danger`、`warning` 只表达各自语义，且必须同时配合文字或图标，不能只靠颜色。
- 资金卡优先使用 `warning-soft` 配深色数字；邀请或知识概览可使用 `secondary-soft`。禁止重新散落旧金色或旧暗色十六进制值。

## Typography

使用系统无衬线字体以保证 Android/iOS 中文覆盖。正文基线为 15/22；题干使用 25/36，并允许自然换行。数字成绩可以提高字号与字重，但不使用装饰字体。英文眉题只作为短标签，不承担核心信息。

## Layout

- 页面水平内边距为 16px，主要区块间距为 24–32px。
- 答题页一次只显示一道题，选项触控高度不低于 56px，答案解析预留稳定空间。
- 底部导航高度 80px，图标始终配文字标签。
- 小屏设备允许页面滚动；固定主操作位于安全区上方，不遮挡最后一项。
- 贴纸式错位只能应用于焦点卡、品牌标记或短标签，角度控制在约 0.5–4 度。

## Elevation & Depth

静态内容默认依靠白色表面、色阶和 1px 边框分层。焦点卡可使用低透明度蓝紫阴影；列表项和答题选项不堆叠重阴影。弹窗、Toast 和底部导航可使用明确但柔和的悬浮层级。

## Shapes

输入和按钮使用 12px 圆角，卡片使用 16px，大型焦点容器最大 24px。短标签可使用胶囊形，知识轨道节点使用小菱形。普通按钮和所有卡片不得统一做成胶囊。

## Components

- 按钮、卡片、空状态、列表行复用 `MobileReactNative/src/components` 中的共享组件。
- `Screen` 统一提供极淡背景纸片形状和一次性页面入场动画；动画必须响应系统减少动态效果设置。
- `KnowledgeRail` 是答题产品签名，只表达进度，不承担导航；进度变化使用短促弹性动画。
- 题目分类卡是“知识护照”入口：分类代码映射固定语义图标、短眉题和色调；诗词使用珊瑚红书页，地理使用蓝紫地图，成语使用琥珀色对话气泡与“字里乾坤”。选中态可整卡着色，但必须保留文字标签、可用题数和无障碍选中状态，未知分类使用受控回退样式。
- 错题本使用暖黄色书签作为复习语义；列表卡保持端正，不做连续错位。题干、上次误选、正确答案和解析按固定顺序展示，专项练习沿用现有答题页而不复制交互。
- 答案选项必须包含 A/B/C/D 索引。提交后正确项始终显示，误选项同时显示错误状态。
- `BrandMark` 使用打开的知识卡片，不得恢复为旧剧场播放键。
- 图标统一使用 `AppIcon` 语义名称，不使用 emoji 代替产品图标。

## Do's and Don'ts

- **Do:** 让题干、答案和下一步成为答题页三个最高层级。
- **Do:** 用一处贴纸焦点和轻微错位建立俏皮感，用语义色表达业务状态。
- **Do:** 对页面入场、按压、进度变化使用短促且可关闭的动效。
- **Don't:** 在认证、提现、风控页面使用持续漂浮、弹跳、抖动或夸张庆祝动画。
- **Don't:** 为每个区块使用不同颜色、圆角或阴影，也不要堆叠无意义装饰。
- **Don't:** 用视觉隐藏代替后端权限、模块边界或真实到账状态。

## 幻乐灵玑笔记管理后台

- 后台延续 Vben/Naive UI 的高密度桌面工作流，不复制 APP 的贴纸错位布局。
- 后台可采用同一语义色映射，但表格、筛选、审核与批量操作优先稳定、清楚和可追溯。
- 发布、审核、下线、拒绝等状态必须使用独立语义与文字，不以装饰色替代业务状态。
