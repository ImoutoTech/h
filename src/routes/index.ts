import express from "express";
import { Index } from "../service/BaseService";
import { retSuccess } from "../utils/restful";
const router = express.Router();

/**
 * 首页状态返回
 */
router.get("/", function (_req, res, _next) {
  retSuccess(res, Index());
});

export default router;
