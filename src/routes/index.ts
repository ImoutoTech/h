import express from "express";
import { Index } from "../service/BaseService";
import { retSuccess } from "../utils/restful";
const router = express.Router();

/* GET home page. */
router.get("/", function (_req, res, _next) {
  retSuccess(res, Index());
});

export default router;
