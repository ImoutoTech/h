import { RegisterParam, LoginParam } from "./types";
import jwt from "jsonwebtoken";
import User from "../model/User";
import { ENV } from "../config";
import { UserInfo } from "../utils/types";
import { HRedis } from "../db/redis";

/**
 * 获取用户信息
 *
 * @param body 用户信息
 * @param redis redis
 * @returns 用户信息
 */
export const Register = async (body: RegisterParam, redis: HRedis) => {
  const user = await User.create({
    ...body,
  });

  await redis.set(`user-${user.id}`, user.getData());
  return user.getData();
};

/**
 * 用户登录
 */
export const Login = async (body: LoginParam) => {
  const user = await User.findOne({ where: { email: body.email } });

  if (user === null) {
    throw new Error("User not exists");
  }
  if (user.checkPassword(body.password)) {
    const token =
      "Bearer " +
      jwt.sign(
        {
          email: user.email,
          role: user.role,
          id: user.id,
          refresh: false,
        },
        ENV.TOKEN_SECRET,
        {
          expiresIn: "2h",
        }
      );

    const refresh =
      "Bearer " +
      jwt.sign(
        {
          email: user.email,
          role: user.role,
          id: user.id,
          refresh: true,
        },
        ENV.TOKEN_SECRET,
        {
          expiresIn: "7d",
        }
      );

    return {
      token,
      refresh,
      user: user.getData(),
    };
  } else {
    throw new Error("wrong password");
  }
};

/**
 * 获取用户信息
 *
 * @param body 消息体
 * @param redis redis客户端
 * @returns 用户信息
 */
export const getUser = async (body: { id: number }, redis: HRedis) => {
  const value = await redis.get(`user-${body.id}`);

  if (value) {
    return value;
  }

  const user = await User.findOne({ where: { id: body.id } });
  if (user === null) {
    throw new Error("User not exists");
  }

  await redis.set(`user-${body.id}`, user.getData());

  return user.getData();
};

/**
 * 刷新token
 *
 * @param user UserInfo
 * @returns token
 */
export const Refresh = (user: UserInfo) => {
  return {
    token:
      "Bearer " +
      jwt.sign(
        {
          email: user.email,
          role: user.role,
          id: user.id,
          refresh: false,
        },
        ENV.TOKEN_SECRET,
        {
          expiresIn: "2h",
        }
      ),
  };
};
