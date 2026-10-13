// 此文件由 scripts/generate-contracts.mjs 自动生成，请勿手动修改。
export type RewardMilestonePeriod = "DAILY" | "LIFETIME";

export interface RewardMilestoneDefinition {
  count: number;
  rewardCoins: number;
  period: RewardMilestonePeriod;
  adFormat?: 'REWARD' | 'NATIVE';
  networkFirmId?: 'AUTO' | '8' | '15' | '28' | '49' | '66';
  minIntervalSeconds?: number;
}

export interface UpdateAdRewardConfig {
  defaultShareRateBps: number;
  directShareRateBps: number;
  indirectShareRateBps: number;
  dailyRewardedAdLimit: number;
  splashRewardEnabled: boolean;
  feedRewardEnabled: boolean;
  fullScreenRewardEnabled: boolean;
  rewardedVideoRewardEnabled: boolean;
  contentUnlockRewardEnabled: boolean;
  rewardedAdMilestones: RewardMilestoneDefinition[];
  inviteMilestones: RewardMilestoneDefinition[];
}

export interface RewardMilestoneProgress extends RewardMilestoneDefinition {
  progress: number;
  completed: boolean;
}
