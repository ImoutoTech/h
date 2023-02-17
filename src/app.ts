import express from "express";
import logger from "./utils/logger";

import indexRouter from "./routes/index";
import usersRouter from "./routes/users";

const app = express();

app.use(logger);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/", indexRouter);
app.use("/users", usersRouter);

export default app;
