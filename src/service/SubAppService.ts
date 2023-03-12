import { HRedis } from '../db/redis'
import SubApp from '../model/SubApp'
import { AppRegParam } from './types'

/**
 * 注册子应用
 *
 * @param body 注册请求消息体
 * @param redis HRedis
 * @returns 新APP信息
 */
export const RegisterApp = async (body: AppRegParam, redis: HRedis) => {
  const app = await SubApp.create({
    ...body,
  })

  await redis.set(`app-${app.id}`, app.getData())
  return app.getData()
}
