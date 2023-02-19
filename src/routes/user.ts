import express from "express";
import { retError, retSuccess } from "../utils/restful";
import { RegisterParam } from "../service/types";
import { Register } from "../service/UserService";

const router = express.Router();

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

/**
 * 用户注册
 */
router.post("/register", async function (req, res, _next) {
  const { body } = req;
  const paramList = ["nickname", "email", "password"];

  if (!body || paramList.some((key) => !Object.keys(body).includes(key))) {
    retError(res, {}, "参数错误");
  } else {
    const { status, data } = await Register(body);
    if (status) {
      retSuccess(res, data);
    } else {
      retError(res, data);
    }
  }
});

export default router;
