import { Router } from "express";
import { ok } from "../../lib/http.js";
import { validate } from "../../middleware/request.js";
import { groMoreRewardQuerySchema, pangleAdRevenueSchema, takuRewardQuerySchema } from "./webhook.schema.js";
import { receiveGroMoreReward, receivePangleAdRevenue, receiveTakuReward, recordInvalidTakuReward, verifyPangleSignature } from "./webhook.service.js";
import {advertisingProvider} from "../../generated/product.generated.js";

const router = Router();

/** POST /pangle/ad-revenue：接收广告收入事件；需携带时间戳、随机串和 HMAC-SHA256 签名。 */
if (advertisingProvider === "gromore") {
  router.post("/pangle/ad-revenue", validate(pangleAdRevenueSchema), async (req, res) => {
    verifyPangleSignature(req);
    return ok(res, await receivePangleAdRevenue(req.body, req), "广告回调处理成功");
  });

  /** GET /pangle/reward：GroMore 广告位维度服务端激励验证，响应格式必须保持平台约定。 */
  router.get("/pangle/reward", async (req, res) => {
    const parsed = groMoreRewardQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.json({ is_verify: false, reason: 40001 });
    return res.json(await receiveGroMoreReward(parsed.data, req));
  });
}

if (advertisingProvider === "taku") {
  /** GET /taku/reward：Taku 服务端激励回调；测试探测不触发数据库结算。 */
  router.get("/taku/reward", async (req, res) => {
    if (String(req.query.is_test ?? "") === "1") return res.status(200).type("text/plain").send("200");
    const parsed = takuRewardQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const invalidFields = [...new Set(parsed.error.issues.map(issue => String(issue.path[0] ?? "unknown")))];
      await recordInvalidTakuReward(req.query, req, invalidFields);
      return res.status(602).type("text/plain").send("602");
    }
    const status = await receiveTakuReward(parsed.data, req);
    return res.status(status).type("text/plain").send(String(status));
  });
}

export default router;
