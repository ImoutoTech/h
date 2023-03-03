import { RegisterParam, LoginParam } from "./types";
import { ValidationError } from "sequelize";
import jwt from "jsonwebtoken";
import User from "../model/User";
import { ENV } from "../config";
import { UserInfo } from "../utils/types";

/**
 * 用户注册
 * @param body 注册信息
 */
export const Register = async (body: RegisterParam) => {
  const user = await User.create({
    ...body,
  });

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
 * @returns 用户信息
 */
export const getUser = async (body: { id: number }) => {
  const user = await User.findOne({ where: { id: body.id } });
  if (user === null) {
    throw new Error("User not exists");
  }

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
