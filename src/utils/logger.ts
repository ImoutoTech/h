import { Request, Response, NextFunction } from "express";
import { ENV } from "../config";

export function echo(...args: any[]) {
  console.log(...args);
}

export default async function logger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!ENV.DEBUG) {
    next();
  } else {
    let start = performance.now();
    next();
    let end = performance.now();
    echo(`[${req.method}] ${req.path} - ${(end - start).toFixed(2)}ms`);
  }
}
