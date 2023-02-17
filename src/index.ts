import app from "./app";
import { ENV } from "./config";
import { echo } from "./utils/logger";

try {
  echo(`starting Homepod in ${ENV.MODE} mode`);
  app.listen(4000, () => {
    echo(`listening on port ${ENV.PORT}`);
  });
} catch (e) {
  console.log(e);
}
