import { RegisterParam, LoginParam } from "./types";
import { ValidationError } from "sequelize";
import jwt from "jsonwebtoken";
import User from "../model/User";
import { ENV } from "../config";

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
        },
        ENV.TOKEN_SECRET,
        {
          expiresIn: 3600 * 24 * 24,
        }
      );

    return {
      token,
      user: user.getData(),
    };
  } else {
    throw new Error("wrong password");
  }
};
