import app from "./app";
import { ENV } from "./config";
import { echo, info, error, success, space } from "./utils/logger";
import db from "./db";

try {
  space(2);
  echo(`[homepod] starting Homepod in ${info(ENV.MODE || "")} mode`);
  space();

  db.authenticate().then(() => {
    echo("[homepod] " + success("connected to db"));
    app.listen(4000, () => {
      echo(`[homepod] listening on port ${info(ENV.PORT || "unknown")}`);
    });
  });
} catch (e: any) {
  echo(`[homepod] ${error(`error: ${e.message}`)}`);
  echo(e);
}
