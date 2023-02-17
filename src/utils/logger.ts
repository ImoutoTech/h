import { Request, Response, NextFunction } from "express";
import { ENV } from "../config";
import chalk from "chalk";

/**
 * log
 * @param args 输出内容
 */
export function echo(...args: any[]) {
  console.log(...args);
}

/**
 * 输出空行
 * @param t 空行数
 */
export function space(t: number = 1) {
  for (let i = 0; i < t; i++) {
    echo();
  }
}

type log = string | number;

export const info = (c: log) => chalk.hex("#07f")(c);
export const success = (c: log) => chalk.greenBright(c);
export const warn = (c: log) => chalk.yellowBright(c);
export const error = (c: log) => chalk.redBright(c);

/**
 * 获得耗时对应颜色chalk
 * @param duration 耗时
 * @returns 耗时对应颜色chalk
 */
const perfomanceColor = (duration: number) => {
  if (duration <= 50) {
    return success;
  } else if (duration <= 100) {
    return warn;
  } else if (duration <= 500) {
    return error;
  }

  return info;
};

/**
 * 日志中间件
 * @param req 请求体
 * @param res 响应体
 * @param next NextFunction
 */
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
    echo(
      `${info(`[${req.method}]`)} ${req.path} - ${perfomanceColor(end - start)(
        (end - start).toFixed(2) + "ms"
      )}`
    );
  }
}
