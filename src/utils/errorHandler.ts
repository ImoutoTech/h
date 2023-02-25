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
  retError(res, {}, err.message);
}
