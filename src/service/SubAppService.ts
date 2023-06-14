import { HRedis } from '../db/redis'
import SubApp, { SubAppBaseInfo } from '../model/SubApp'
import type { AppRegParam } from './types'
import type { UserTokenInfo } from '../utils/types'
import { ENV } from '../config'
import jwt from 'jsonwebtoken'
import { getUser } from './UserService'

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

/**
 * 修改应用数据
 *
 * @param body 请求体
 * @param id 应用id
 * @param user 用户信息
 * @param redis HRedis
 * @returns 更新后的应用数据
 */
export const ModifySubApp = async (
  body: Partial<SubAppBaseInfo>,
  id: string,
  user: UserTokenInfo,
  redis: HRedis
) => {
  const editableData = ['name', 'callback', 'description']
  const app = await SubApp.findOne({ where: { id } })
  const data2Modify: Partial<SubAppBaseInfo> = {}

  if (app === null) {
    throw new Error('app not exists')
  }

  editableData.forEach((key: string) => {
    if (body[key]) {
      if (app.owner !== user.id && user.role !== 1) {
        throw new Error('permission denied')
      }

      data2Modify[key] = body[key]
    }
  })

  await app.update(data2Modify)

  redis.set(`app-${app.id}`, app.getData())
  return app.getData()
}

/**
 * 获取用户子应用列表
 *
 * @param userId 用户id
 * @returns 用户app列表
 */
export const getUserApp = async (userId: number): Promise<SubAppBaseInfo[]> => {
  const apps = await SubApp.findAll({ where: { owner: userId } })

  return apps.map((app) => app.getData())
}

/**
 * 用户回调子应用
 * @param id 应用id
 * @param userId 用户id
 * @param redis HRedis
 * @returns ticket
 */
export const callbackSubApp = async (
  id: string,
  userId: number,
  redis: HRedis
) => {
  const app = await SubApp.findOne({ where: { id } })
  const user = await getUser({ id: userId }, redis)

  if (app === null) {
    throw new Error('app not exists')
  }

  app.visitNum += 1
  await app.save()

  const ticket = jwt.sign(
    {
      email: user.email,
      role: user.role,
      id: user.id,
      refresh: false,
    },
    ENV.TOKEN_SECRET,
    {
      expiresIn: '1d',
    }
  )

  return {
    ticket,
  }
}
