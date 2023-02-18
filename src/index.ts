import app from "./app";
import { ENV, CONFIG } from "./config";
import { echo, info, error, success, space } from "./utils/logger";
import db from "./db";

try {
  space(2);
  echo(
    `[${CONFIG.TITLE}] starting ${CONFIG.TITLE} in ${info(ENV.MODE || "")} mode`
  );
  space();

  db.authenticate().then(() => {
    echo(`[${CONFIG.TITLE}] ` + success("connected to db"));
    app.listen(4000, () => {
      echo(
        `[${CONFIG.TITLE}] listening on port ${info(ENV.PORT || "unknown")}`
      );
    });
  });
} catch (e: any) {
  echo(`[${CONFIG.TITLE}] ${error(`error: ${e.message}`)}`);
  echo(e);
}
