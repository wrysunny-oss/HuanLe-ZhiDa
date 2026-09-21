import test from "node:test";
import assert from "node:assert/strict";
import { constants, createHash, generateKeyPairSync, publicEncrypt } from "node:crypto";
import { takuRewardQuerySchema } from "./webhook.schema.js";
import { decryptTakuCnyEcpm, resolveTakuEncryptedEcpm, takuCnyEcpmToRevenueYuan, takuRewardSignatureText, verifyTakuRewardSign } from "./webhook.service.js";

const securityKey = "cyvmwmzrqts7csphhexpqxqxxgljfisb";
const base = {
  user_id: 1n,
  trans_id: "xxxxxxxxxxxxxxxx",
  reward_amount: "1",
  reward_name: "coin",
  placement_id: "b5b449fb3d89d7",
  adsource_id: "56789",
};

test("Taku 服务端激励按官方字段顺序生成并校验 MD5", () => {
  const sign = "f3430a708850870011b76c70f4c64583";
  assert.equal(takuRewardSignatureText(base, securityKey), "trans_id=xxxxxxxxxxxxxxxx&placement_id=b5b449fb3d89d7&adsource_id=56789&reward_amount=1&reward_name=coin&sec_key=cyvmwmzrqts7csphhexpqxqxxgljfisb");
  assert.equal(verifyTakuRewardSign({ ...base, sign }, securityKey), true);
  assert.equal(verifyTakuRewardSign({ ...base, reward_amount: "2", sign }, securityKey), false);
});

test("Taku 携带 ilrd 时将原始 ilrd 追加到签名原文", () => {
  assert.equal(verifyTakuRewardSign({ ...base, ilrd: "abc", sign: "afa3656c9bae5acec9a1a43c34dd8e7b" }, securityKey), true);
});

test("Taku signed ILRD supplies encrypted CNY eCPM only when show and ad context match", () => {
  const ilrd = JSON.stringify({
    id: base.trans_id,
    adunit_id: base.placement_id,
    adsource_id: base.adsource_id,
    adunit_format: "RewardedVideo",
    network_firm_id: 66,
    e_c: "encrypted-usd",
    e_c_cny: "encrypted-cny",
    s_id: 7,
    publisher_revenue: 999999,
  });
  const input = { ...base, network_firm_id: "66", ilrd, sign: createHash("md5").update(takuRewardSignatureText({ ...base, ilrd }, securityKey)).digest("hex") };
  assert.equal(verifyTakuRewardSign(input, securityKey), true);
  const resolved = resolveTakuEncryptedEcpm(input);
  assert.equal(resolved.e_c_cny, "encrypted-cny");
  assert.equal(resolved.s_id, "7");
  assert.equal(resolved.e_c, "encrypted-usd");
  assert.throws(() => resolveTakuEncryptedEcpm({ ...input, trans_id: "other" }), /show ID mismatch/);
  assert.throws(() => resolveTakuEncryptedEcpm({ ...input, adsource_id: "other" }), /ad source ID mismatch/);
  assert.throws(() => resolveTakuEncryptedEcpm({ ...input, e_c_cny: "conflicting" }), /e_c_cny mismatch/);
  assert.throws(() => resolveTakuEncryptedEcpm({ ...input, ilrd: "not-json" }), /JSON is invalid/);
});

test("Taku 回调参数限制金币范围、交易号和签名格式", () => {
  assert.equal(takuRewardQuerySchema.safeParse({ ...base, user_id: "1", sign: "f3430a708850870011b76c70f4c64583" }).success, true);
  assert.equal(takuRewardQuerySchema.safeParse({ ...base, user_id: "1", reward_amount: "0", sign: "f3430a708850870011b76c70f4c64583" }).success, false);
  assert.equal(takuRewardQuerySchema.safeParse({ ...base, user_id: "1", trans_id: "x".repeat(91), sign: "f3430a708850870011b76c70f4c64583" }).success, false);
});

test("Taku 人民币 eCPM 经 RSA 解密后校验广告源并换算单次展示收入", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  const encrypted = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from("56789_94.9905_request123", "utf8"),
  ).toString("base64");
  const keys = { "7": privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
  const result = decryptTakuCnyEcpm({ adsource_id: "56789", e_c_cny: encrypted, s_id: "7" }, keys);
  assert.deepEqual(result, { ecpmCny: "94.9905", requestId: "request123" });
  assert.equal(takuCnyEcpmToRevenueYuan(result.ecpmCny), "0.094990");
  assert.throws(
    () => decryptTakuCnyEcpm({ adsource_id: "other", e_c_cny: encrypted, s_id: "7" }, keys),
    /广告源校验失败/,
  );
});
