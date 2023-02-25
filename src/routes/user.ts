import express, { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import { retError, retSuccess } from "../utils/restful";
import { LoginParam, RegisterParam } from "../service/types";
import { Login, Register } from "../service/UserService";
import { checkParams } from "../utils";
import { ENV } from "../config";

const router = express.Router();

/**
 * 仅测试用
 * 密码生成
 */
router.get(
  "/pass-gen",
  function (req: Request, res: Response, _next: NextFunction) {
    if (ENV.MODE === "dev") {
      const { plain = "" } = req.query;

      if (plain === "") {
        res.json({ password: "" });
      } else {
        console.log(req.user);
        res.json({
          password: bcrypt.hashSync(plain as string, ENV.SALTROUND),
        });
      }
    } else {
      res.json({ password: "" });
    }
  }
);

/**
 * 用户注册
 */
router.post("/register", async function (req, res, _next) {
  const { body } = req;
  const paramList = ["nickname", "email", "password"];

  if (!checkParams(body, paramList)) {
    retError(res, {}, "参数缺失");
  } else {
    const { status, data } = await Register(body as RegisterParam);
    if (status) {
      retSuccess(res, data);
    } else {
      retError(res, data);
    }
  }
});

/**
 * 用户登录
 */
router.post("/login", async function (req, res, _next) {
  const { body } = req;
  const paramList = ["email", "password"];

  if (!checkParams(body, paramList)) {
    retError(res, {}, "参数缺失");
  } else {
    const { status, data } = await Login(body as LoginParam);
    if (status) {
      retSuccess(res, data);
    } else {
      retError(res, data);
    }
  }
});

export default router;
