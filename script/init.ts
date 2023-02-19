import { echo, success, error } from "../src/utils/logger";
import User from "../src/model/User";

const ModelList = [User];

Promise.all(ModelList.map((model) => model.sync({ force: true })))
  .then(() => {
    echo(success("成功初始化数据库"));
  })
  .catch((e) => {
    echo(error("初始化失败"), e);
  });
