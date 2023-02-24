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
  const ret = {
    status: true,
    data: {},
  };

  try {
    const user = await User.create({
      ...body,
    });

    ret.data = user.getData();
  } catch (e) {
    ret.status = false;

    if (e instanceof ValidationError) {
      ret.data = e.errors.map((error) => error.message).join(",");
    } else {
      ret.data = e as unknown as Object;
    }
  }

  return ret;
};

/**
 * 用户登录
 */
export const Login = async (body: LoginParam) => {
  const ret = {
    status: true,
    data: {},
  };

  try {
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

      ret.data = {
        token,
        user: user.getData(),
      };
    } else {
      throw new Error("wrong password");
    }
  } catch (e) {
    ret.status = false;
    if (e instanceof Error) {
      ret.data = e.message;
    }
  }

  return ret;
};
