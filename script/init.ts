import { echo, success, error } from "../src/utils/logger";
import User from "../src/model/User";
import SK from "../src/model/SK";

(async function () {
  try {
    const ModelList = [User, SK];

    await Promise.all(ModelList.map((model) => model.sync()));
    echo(success("成功初始化数据库"));
  } catch (e) {
    echo(error("初始化失败"), e);
  }
})();
