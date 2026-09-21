'use strict';

/**
 * 对第三方 Android 模块执行最小化、可重复的构建兼容修补。
 *
 * node_modules 会在 yarn install 后重新生成，因此这些兼容修复必须由
 * postinstall 自动执行，确保其他开发机和 CI 得到相同结果。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function patchFile(relativePath, transform) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) {
    throw new Error(`找不到待修补文件：${relativePath}`);
  }

  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    console.log(`[postinstall] 已修补 ${relativePath}`);
  }
}

patchFile(
  'node_modules/@react-native-async-storage/async-storage/android/build.gradle',
  source => {
    // 默认使用经典 SQLite 后端；只有显式启用 next storage 才加载 KSP。
    if (source.includes('def useNextStorage = ext.AsyncStorageConfig.useNextStorage')) {
      return source;
    }

    return source
      .replace(
        'def kspVersion = ext.AsyncStorageConfig.kspVersion',
        'def kspVersion = ext.AsyncStorageConfig.kspVersion\n    def useNextStorage = ext.AsyncStorageConfig.useNextStorage',
      )
      .replace(
        / {8}classpath "org\.jetbrains\.kotlin:kotlin-gradle-plugin:\$kotlinVersion"\r?\n {8}classpath "com\.google\.devtools\.ksp:symbol-processing-gradle-plugin:\$kspVersion"/,
        [
          '        if (useNextStorage) {',
          '            classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion"',
          '            classpath "com.google.devtools.ksp:symbol-processing-gradle-plugin:$kspVersion"',
          '        }',
        ].join('\n'),
      );
  },
);

patchFile(
  'node_modules/react-native-safe-area-context/android/build.gradle',
  source =>
    // Spotless 仅用于依赖自身开发，APP 构建不需要下载该插件。
    source
      .replace(
        /^\s*classpath[ (]["']com\.diffplug\.spotless:spotless-plugin-gradle:[^\r\n]+\r?\n/m,
        '',
      )
      .replace(
        'classpath("com.android.tools.build:gradle:9.2.1")',
        // 与 React Native 宿主工程使用相同 AGP 版本。
        'classpath("com.android.tools.build:gradle:8.12.0")',
      ),
);

// GroMore 插件补丁独立维护，方便跟踪上游版本变化。
// React Native Gradle plugin is an included build with its own pluginManagement.
// Keep the mirror declarations after every yarn install.
patchFile(
  'node_modules/@react-native/gradle-plugin/settings.gradle.kts',
  source => {
    const marker =
      'maven { url = uri("https://maven.aliyun.com/repository/gradle-plugin") }';
    if (source.includes(marker)) {
      return source;
    }

    return source.replace(
      '  repositories {\n    mavenCentral()',
      [
        '  repositories {',
        '    // This included build has an independent plugin repository scope.',
        `    ${marker}`,
        '    maven { url = uri("https://maven.aliyun.com/repository/google") }',
        '    maven { url = uri("https://maven.aliyun.com/repository/central") }',
        '    mavenCentral()',
      ].join('\n'),
    );
  },
);

patchFile(
  'node_modules/@taku_anythink/react-native-sdk/android/networks.gradle',
  source => {
    // The published bridge requests every supported network and debugger UI on its compile classpath.
    // The app already owns the exact generated runtime adapters; debugger-ui:1.1.5 is unavailable.
    // Keep only the core API needed to compile the bridge.
    const dependencies = [
      'dependencies {',
      '  compileOnly "com.anythink.sdk:core-taku:6.5.73.3"',
      '}',
      '',
    ].join('\n');
    return source.replace(/dependencies\s*\{[\s\S]*\}\s*$/, dependencies);
  },
);

patchFile(
  'node_modules/@taku_anythink/react-native-sdk/android/src/main/java/com/anythink/reactnative/init/AdSourcePrivacyPolicyStore.java',
  () => [
    'package com.anythink.reactnative.init;',
    '',
    'import android.text.TextUtils;',
    'import com.anythink.reactnative.utils.MsgTools;',
    '',
    '/**',
    ' * The upstream bridge hard-links privacy controllers for every Taku network.',
    ' * A generated SDK intentionally contains only the selected networks, so those imports',
    ' * make valid partial bundles fail to compile. Product code uses the core privacy APIs;',
    ' * keep this optional network-specific JSON entry point inert for the selected bundle.',
    ' */',
    'public final class AdSourcePrivacyPolicyStore {',
    '    private static volatile String sPolicyJson;',
    '',
    '    private AdSourcePrivacyPolicyStore() {}',
    '',
    '    public static synchronized void setPolicyJson(String json) {',
    '        sPolicyJson = TextUtils.isEmpty(json) ? null : json;',
    '        MsgTools.printMsg("setAdSourcePrivacyPolicy: network-specific controllers disabled");',
    '    }',
    '',
    '    public static String getPolicyJson() {',
    '        return sPolicyJson;',
    '    }',
    '}',
    '',
  ].join('\n'),
);

patchFile(
  'node_modules/@taku_anythink/react-native-sdk/android/src/main/java/com/anythink/reactnative/init/ATInitManager.java',
  source => source
    .replace('import com.anythink.debug.api.ATDebuggerUITest;\n', '')
    .replace(
      /    public void showDebuggerUI\(final String debugKey\) \{[\s\S]*?\n    \}\n\n    \/\/ /,
      [
        '    public void showDebuggerUI(final String debugKey) {',
        '        MsgTools.printMsg("showDebuggerUI unavailable: debugger-ui is excluded from app builds");',
        '    }',
        '',
        '    // ',
      ].join('\n'),
    ),
);

patchFile(
  'node_modules/@taku_anythink/react-native-sdk/android/src/main/java/com/anythink/reactnative/reward/ATAutoLoadRewardVideoHelper.java',
  source => source.replace(
    [
      '        String[] arr = new String[]{placementId};',
      '        ATRewardVideoAutoAd.init(activity, arr, autoLoadListener);',
      '        if (settings != null) {',
      '            ATRewardVideoAutoAd.setLocalExtra(placementId, settings);',
      '        }',
      '        ATRewardVideoAutoAd.addPlacementId(arr);',
    ].join('\n'),
    [
      '        String[] arr = new String[]{placementId};',
      '        // S2S user data must be attached before init starts the first auto-load.',
      '        if (settings != null) {',
      '            ATRewardVideoAutoAd.setLocalExtra(placementId, settings);',
      '        }',
      '        ATRewardVideoAutoAd.init(activity, arr, autoLoadListener);',
      '        ATRewardVideoAutoAd.addPlacementId(arr);',
    ].join('\n'),
  ),
);

require('./patch-playnest-unionad');
