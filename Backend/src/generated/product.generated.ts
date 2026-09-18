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
    "advertising": false,
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
    "productionApiOrigin": "https://api.example.com"
  },
  "advertising": {
    "provider": "none",
    "providers": {
      "gromore": {
        "registeredAppName": "待配置广告应用",
        "appId": "000000",
        "splashPlacementId": "000000",
        "feedPlacementId": "000000",
        "fullScreenPlacementId": "000000",
        "rewardPlacementId": "000000"
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
