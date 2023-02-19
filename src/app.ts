import express from "express";
import logger from "./utils/logger";

import indexRouter from "./routes/index";
import userRouter from "./routes/user";

const app = express();

app.use(logger);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/", indexRouter);
app.use("/user", userRouter);

export default app;
