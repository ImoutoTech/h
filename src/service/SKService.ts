import SK from "../model/SK";
import { v4 as uuid } from "uuid";

/**
 * 获取用户SK
 *
 * @param userId 用户id
 * @param isUpdate 是否更新
 * @returns 用户sk信息
 */
export const getSK = async (userId: number, isUpdate: boolean) => {
  const [sk, isNew] = await SK.findOrCreate({
    where: { user: userId },
    defaults: {
      user: userId,
      value: uuid(),
    },
  });

  if (isUpdate && !isNew) {
    sk.value = uuid();
    await sk.save();
  }

  return sk.getData();
};
