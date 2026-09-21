import { z } from "zod";

/** 穿山甲广告收入回调的内部统一格式；正式字段映射可在适配层单独调整。 */
export const pangleAdRevenueSchema = z.object({
  eventId: z.string().trim().min(8).max(100),
  userId: z.coerce.bigint().positive(),
  revenueYuan: z.string().trim().regex(/^\d+(\.\d{1,6})?$/, "广告收入必须是最多 6 位小数的人民币金额"),
  source: z.string().trim().min(1).max(30).default("PANGLE"),
});

/** GroMore 广告位维度激励回调参数，字段名必须保持平台规定的 snake_case。 */
export const groMoreRewardQuerySchema = z.object({
  user_id: z.coerce.bigint().positive(),
  trans_id: z.string().trim().min(1).max(100),
  reward_amount: z.coerce.number().int().nonnegative(),
  reward_name: z.string().trim().max(50).default("金币"),
  mediation_rit: z.string().trim().min(1).max(30),
  prime_rit: z.string().trim().max(30).optional(),
  adn_name: z.string().trim().max(50).optional(),
  ecpm: z.string().trim().regex(/^\d+(\.\d{1,6})?$/).optional(),
  extra: z.string().max(1000).optional(),
  sign: z.string().trim().regex(/^[a-fA-F0-9]{64}$/),
});

export type GroMoreRewardQuery = z.infer<typeof groMoreRewardQuerySchema>;

/** Taku 服务端激励使用 GET 查询参数；字符串字段保留原值以便严格按官方顺序验签。 */
export const takuRewardQuerySchema = z.object({
  user_id: z.coerce.bigint().positive(),
  trans_id: z.string().trim().min(1).max(90),
  reward_amount: z.string().trim().regex(/^\d+$/).refine((value) => {
    const amount = BigInt(value);
    return amount > 0n && amount <= 1_000_000_000n;
  }, "激励数量必须是 1 到 1000000000 的整数"),
  reward_name: z.string().trim().min(1).max(50),
  placement_id: z.string().trim().min(1).max(50),
  extra_data: z.string().max(2000).optional(),
  network_firm_id: z.string().trim().max(30).optional(),
  adsource_id: z.string().trim().min(1).max(50),
  scenario_id: z.string().trim().max(100).optional(),
  package_name: z.string().trim().max(150).optional(),
  platform: z.enum(["1", "2"]).optional(),
  sign: z.string().trim().regex(/^[a-fA-F0-9]{32}$/),
  ilrd: z.string().max(20_000).optional(),
  e_c: z.string().trim().max(2000).optional(),
  e_c_cny: z.string().trim().max(2000).optional(),
  s_id: z.string().trim().regex(/^\d+$/).max(30).optional(),
  is_test: z.string().optional(),
});

export type TakuRewardQuery = z.infer<typeof takuRewardQuerySchema>;
