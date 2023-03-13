import { HRedis } from '../db/redis'
import SubApp, { SubAppBaseInfo } from '../model/SubApp'
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

/**
 * 获取子应用信息
 *
 * @param id appId
 * @param redis HRedis
 * @returns App信息
 */
export const getSubAppData = async (id: string, redis: HRedis) => {
  const appCache = await redis.get(`app-${id}`)

  if (appCache) {
    return appCache as SubAppBaseInfo
  }

  const app = await SubApp.findOne({ where: { id } })
  if (app === null) {
    throw new Error('app not exists')
  }

  await redis.set(`app-${app.id}`, app.getData())
  return app.getData()
}
