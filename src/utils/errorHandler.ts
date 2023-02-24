import { Request, Response, NextFunction } from "express";
import { retError } from "./restful";
import { error, echo } from "./logger";

export default function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  echo(error(`error: ${err.message}`));
  if (err.name === "UnauthorizedError") {
    retError(res, {}, "认证失败");
  }
}
