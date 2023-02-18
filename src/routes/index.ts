import express from "express";
import { Index } from "../service/BaseService";
const router = express.Router();

/* GET home page. */
router.get("/", function (_req, res, _next) {
  res.json(Index());
});

export default router;
