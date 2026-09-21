// 此文件由 scripts/sync-product-config.mjs 自动生成，请勿手动修改。
export const productConfig = {
  "schemaVersion": 2,
  "productCode": "huanle-zhida",
  "brand": {
    "appDisplayName": "幻乐智答",
    "adminTitle": "幻乐智答管理后台",
    "adminDescription": "幻乐智答运营管理后台",
    "companyName": "幻乐灵玑"
  },
  "android": {
    "applicationId": "com.hylj.app"
  },
  "admin": {
    "namespace": "huanle-zhida-admin"
  },
  "modules": {
    "advertising": true,
    "rewards": true,
    "invitations": true,
    "smsRegistration": true,
    "withdrawals": true,
    "alipayPayout": true
  },
  "content": {
    "type": "quiz",
    "providers": {
      "shortDrama": {
        "sdkSettingId": "000000"
      }
    }
  },
  "domains": {
    "productionApiOrigin": "https://api.hyljzn.cn"
  },
  "advertising": {
    "provider": "taku",
    "providers": {
      "gromore": {
        "registeredAppName": "待配置广告应用",
        "appId": "000000",
        "splashPlacementId": "000000",
        "feedPlacementId": "000000",
        "fullScreenPlacementId": "000000",
        "rewardPlacementId": "000000"
      },
      "taku": {
        "registeredAppName": "幻乐智答",
        "appId": "a6aab990f86e52",
        "splashPlacementId": "b6aae2bab20f22",
        "feedPlacementId": "b6aae2b1428a5d",
        "bannerPlacementId": "b6aae2baa6a957",
        "fullScreenPlacementId": "b6aae2baabf972",
        "rewardPlacementId": "b6aae2baa12ce8"
      }
    }
  }
} as const;

export const productModules = productConfig.modules;
export type ProductModuleKey = keyof typeof productModules;
export type ProductModules = Record<ProductModuleKey, boolean>;
export type ContentType = 'music' | 'none' | 'novel' | 'quiz' | 'shortDrama';
export const contentType: ContentType = productConfig.content.type;
export type AdvertisingProvider = 'gromore' | 'none' | 'taku';
export const advertisingProvider: AdvertisingProvider = productConfig.advertising.provider;
