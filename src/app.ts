import express from "express";
import logger from "./utils/logger";
import { expressjwt } from "express-jwt";
import errorHandler from "./utils/errorHandler";

import indexRouter from "./routes/index";
import userRouter from "./routes/user";

import { ENV } from "./config";

const app = express();

app.use(logger);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  expressjwt({
    secret: ENV.TOKEN_SECRET,
    algorithms: ["HS256"],
  }).unless({
    path: ["/user/login", "/user/register"],
  })
);

app.use("/", indexRouter);
app.use("/user", userRouter);

app.use(errorHandler);

export default app;
