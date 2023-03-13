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

/**
 * 删除子应用
 *
 * @param id 子应用id
 * @param user 请求用户id
 * @param redis HRedis
 * @returns 是否删除成功
 */
export const delSubApp = async (id: string, user: number, redis: HRedis) => {
  const app = await SubApp.findOne({ where: { id } })
  if (app === null) {
    throw new Error('app not exists')
  }

  if (user === app.owner) {
    await redis.del(`app-${id}`)
    await app.destroy()
  } else {
    throw new Error('not your app')
  }

  return true
}
