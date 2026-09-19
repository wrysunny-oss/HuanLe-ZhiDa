# 本地广告 SDK

本目录保存由广告平台后台生成的 Android AAR/JAR。二进制文件受许可和体积限制，不提交到 Git；正式打包机需要单独保留这些文件。

## Taku 6.6.22

当前 Taku 中国区 SDK 包含以下平台：

- Taku 核心与酷盈 ADX
- 穿山甲 7.6.1.2
- 腾讯广告 4.701.1571
- 快手 5.6.10.1
- 百度 9.460
- 小米 Mimo 5.3.9.30

`android/app/build.gradle` 中的 `takuSdkFiles` 会在启用 Taku 或执行验证构建时检查完整文件名。升级 SDK 或调整广告平台时，必须整体替换同一次后台生成的文件，并同步更新清单、资源保留规则和依赖，禁止混用不同批次的 adapter。

## 旧 GroMore

旧 GroMore 仅保留兼容代码，不得作为正式广告方案重新启用。若历史分支确需构建，其本地 AAR 清单仍由 `groMoreAdnAars` 校验。
