import express from 'express'
import { checkParams } from '../utils'
import { retSuccess } from '../utils/restful'
import {
  RegisterApp,
  getSubAppData,
  delSubApp,
  ModifySubApp,
  getUserApp,
  callbackSubApp,
} from '../service/SubAppService'

const router = express.Router()

/**
 * 子应用注册
 */
router.post('/reg', async (req, res, next) => {
  try {
    if (!req.user || req.user.refresh) {
      throw new Error('give me the token')
    }

    const { body } = req
    const paramList = ['name', 'callback']

    if (!checkParams(body, paramList)) {
      throw new Error('missing params')
    }

    retSuccess(
      res,
      await RegisterApp(
        {
          ...body,
          owner: req.user.id,
        },
        req.redis
      )
    )
  } catch (e) {
    next(e)
  }
})

/**
 * 获取用户子应用列表
 */
router.get('/my', async (req, res, next) => {
  try {
    if (!req.user || req.user.refresh) {
      throw new Error('give me the token')
    }

    retSuccess(res, await getUserApp(req.user.id))
  } catch (e) {
    next(e)
  }
})

/**
 * 子应用回调
 */
router.post('/:id', async (req, res, next) => {
  try {
    if (!req.user || req.user.refresh) {
      throw new Error('give me the token')
    }
    retSuccess(res, await callbackSubApp(req.params.id, req.user.id, req.redis))
  } catch (e) {
    next(e)
  }
})

/**
 * 获取子应用信息
 */
router.get('/:id', async (req, res, next) => {
  try {
    retSuccess(res, await getSubAppData(req.params.id, req.redis))
  } catch (e) {
    next(e)
  }
})

/**
 * 子应用删除
 */
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user || req.user.refresh) {
      throw new Error('give me the token')
    }

    retSuccess(res, {
      result: await delSubApp(req.params.id, req.user.id, req.redis),
    })
  } catch (e) {
    next(e)
  }
})

/**
 * 更新应用信息
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { params, redis, body, user } = req

    if (!params.id || !Object.keys(body).length) {
      throw new Error('参数缺失')
    }

    if (!user.id || user?.refresh) {
      throw new Error('token invalid')
    }

    retSuccess(res, await ModifySubApp(body, params.id, user, redis))
  } catch (e) {
    next(e)
  }
})

export default router
