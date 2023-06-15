import { Response, Request, NextFunction } from 'express'
import { Redis } from 'ioredis'
import { ENV, CONFIG } from '../config'
import { echo, success } from '../utils/logger'

export class HRedis {
  /**
   * Redis客户端
   */
  public client

  /**
   * 构造函数
   */
  constructor() {
    this.client = new Redis(ENV.REDIS_URL || '')
  }

  /**
   * 获取数据
   *
   * @param key key
   * @param isObj 是否为对象
   * @returns value
   */
  public async get(key: string, isObj = true) {
    const result = await this.client.get(key)

    if (result) {
      ENV.MODE === 'dev' && echo(`命中redis缓存: ${key}`)
      return isObj ? JSON.parse(result) : result
    }

    ENV.MODE === 'dev' && echo(`没有命中redis缓存: ${key}`)
    return undefined
  }

  /**
   * 设置值
   *
   * @param key key
   * @param value value
   */
  public async set(key: string, value: string | object) {
    const trueValue = typeof value === 'string' ? value : JSON.stringify(value)
    await this.client.set(key, trueValue)

    ENV.MODE === 'dev' && echo(`刷新redis缓存: ${key}`)
  }

  /**
   * 删除值
   *
   * @param key key
   */
  public async del(key: string) {
    await this.client.del(key)

    ENV.MODE === 'dev' && echo(`删除redis缓存: ${key}`)
  }
}

export const testRedis = async () => {
  const redis = new Redis(ENV.REDIS_URL || '')
  echo(`[${CONFIG.TITLE}] ` + success('connected to redis'))
  redis.quit()
}

export const useRedis = (req: Request, _res: Response, next: NextFunction) => {
  req.redis = new HRedis()
  next()
}
