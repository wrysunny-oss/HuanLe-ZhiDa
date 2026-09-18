# 幻乐智答题库数据

## 当前种子题库

`poetry-tang-300.seed.json` 由 `scripts/generate-poetry-quiz.mjs` 从
`chinese-poetry/全唐诗/唐诗三百首.json` 确定性生成，固定上游提交为
`b8594f81a89752241442f2ce267d6f66f96704ee`，来源仓库采用 MIT 许可证。
许可证副本见 `LICENSE.chinese-poetry`。

`geography-gb2260-2025.seed.json` 由 `scripts/generate-geography-quiz.mjs` 从
`xihan123/gb2260` 的 2025 年有效行政区划记录确定性生成，固定上游提交为
`aa9f31b3a8b1dff06e815b7612f4a9e5c02a5bff`。生成时只使用来源标记为
`areacodes` 的记录；规范化产物和该上游均采用 CC0 1.0。许可证副本见
`LICENSE.gb2260`。

生成命令：

```powershell
npm.cmd install
npm.cmd run quiz:generate -- --source=.tmp/chinese-poetry/tang300.json --count=600
npm.cmd run quiz:generate:geography -- --source=.tmp/gb2260-archive/gb2260-master/data/build/areas.json --count=250
npm.cmd run quiz:audit:geography
```

导入开发数据库：

```powershell
cd Backend
npm.cmd run prisma:generate
npm.cmd run prisma:deploy
npm.cmd run quiz:check
npm.cmd run quiz:import
npm.cmd run quiz:check:geography
npm.cmd run quiz:import:geography
```

## 发布约束

- 自动生成的题目统一为 `DRAFT` 和 `PENDING`。
- 只有人工核对题干、答案、干扰项和来源后，才能改为 `APPROVED` 和 `PUBLISHED`。
- 每道题必须保留来源名称、链接、许可证、源记录 ID 和内容摘要。
- 不导入 `CC BY-NC-SA` 或其他禁止商业使用的数据集。
- 上游原始数据只放在 `.tmp/`，不提交整个第三方仓库。
