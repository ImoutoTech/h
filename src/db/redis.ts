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

export class HRedis {
  /**
   * Redis客户端
   */
  public client;

  /**
   * 是否快速使用
   */
  public isManual: boolean = false;

  /**
   * 是否已经连接
   */
  private isConnected: boolean = false;

  /**
   * 构造函数
   */
  constructor() {
    this.client = redis;
  }

  /**
   * 手动连接
   *
   * 会开启手动模式
   */
  public async connect() {
    await this.client.connect();
    this.isManual = true;
    this.isConnected = true;
  }

  /**
   * 手动取消连接
   *
   * 会关闭手动模式
   */
  public async disconnect() {
    await this.client.disconnect();
    this.isManual = false;
    this.isConnected = false;
  }

  /**
   * 获取数据
   *
   * @param key key
   * @param isObj 是否为对象
   * @returns value
   */
  public async get(key: string, isObj = true) {
    !this.isManual && (await this.client.connect());
    const result = await this.client.get(key);

    if (result) {
      !this.isManual && (await this.client.disconnect());
      ENV.MODE === "dev" && echo(`命中redis缓存: ${key}`);
      return isObj ? JSON.parse(result) : result;
    }

    !this.isManual && (await this.client.disconnect());
    ENV.MODE === "dev" && echo(`没有命中redis缓存: ${key}`);
    return undefined;
  }

  /**
   * 设置值
   *
   * @param key key
   * @param value value
   */
  public async set(key: string, value: string | object) {
    !this.isManual && (await this.client.connect());
    const trueValue = typeof value === "string" ? value : JSON.stringify(value);
    await this.client.set(key, trueValue);

    !this.isManual && (await this.client.disconnect());
    ENV.MODE === "dev" && echo(`刷新redis缓存: ${key}`);
  }

  /**
   * 是否已经连接
   *
   * @returns boolean
   */
  public connected() {
    return this.isConnected;
  }
}

export const testRedis = async () => {
  await redis.connect();
  echo(`[${CONFIG.TITLE}] ` + success("connected to redis"));
  await redis.disconnect();
};

export const useRedis = (req: Request, _res: Response, next: NextFunction) => {
  req.redis = new HRedis();
  next();
};

export default redis;
