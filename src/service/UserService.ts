import { RegisterParam } from "./types";
import { ValidationError } from "sequelize";
import User from "../model/User";

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
