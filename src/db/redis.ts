import { Response, Request, NextFunction } from "express";
import { createClient } from "redis";
import { ENV, CONFIG } from "../config";
import { echo, error, success } from "../utils/logger";

const redis = createClient({
  url: ENV.REDIS_URL,
});

redis.on("error", (err) => {
  echo(error("Redis Error"), err);
});

export const testRedis = async () => {
  await redis.connect();
  echo(`[${CONFIG.TITLE}] ` + success("connected to redis"));
  await redis.disconnect();
};

export const useRedis = (req: Request, _res: Response, next: NextFunction) => {
  req.redis = redis;
  next();
};

export default redis;
