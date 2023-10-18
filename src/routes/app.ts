import express from 'express'
import { checkParams } from '../utils'
import { retSuccess } from '../utils/restful'
import { ROLE } from '../config'
import {
  RegisterApp,
  getSubAppData,
  delSubApp,
  ModifySubApp,
  getUserApp,
  callbackSubApp,
  getAllApp,
} from '../service/SubAppService'

const router = express.Router()

/**
 * 子应用注册
 */
router.post('/reg', async (req, res) => {
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
})

/**
 * 获取用户子应用列表
 */
router.get('/my', async (req, res) => {
  if (!req.user || req.user.refresh) {
    throw new Error('give me the token')
  }

  retSuccess(res, await getUserApp(req.user.id))
})

/**
 * 获取所有子应用列表
 */
router.get('/all', async (req, res) => {
  if (!req.user || req.user.refresh) {
    throw new Error('give me the token')
  }

  if (req.user.role !== ROLE.ADMIN) {
    throw new Error('not admin')
  }

  const { page, size } = req.query

  retSuccess(res, await getAllApp(Number(page), Number(size)))
})

/**
 * 子应用回调
 */
router.post('/:id', async (req, res) => {
  if (!req.user || req.user.refresh) {
    throw new Error('give me the token')
  }
  retSuccess(res, await callbackSubApp(req.params.id, req.user.id, req.redis))
})

/**
 * 获取子应用信息
 */
router.get('/:id', async (req, res) => {
  retSuccess(res, await getSubAppData(req.params.id, req.redis))
})

/**
 * 子应用删除
 */
router.delete('/:id', async (req, res) => {
  if (!req.user || req.user.refresh) {
    throw new Error('give me the token')
  }

  retSuccess(res, {
    result: await delSubApp(req.params.id, req.user.id, req.redis),
  })
})

/**
 * 更新应用信息
 */
router.put('/:id', async (req, res) => {
  const { params, redis, body, user } = req

  if (!params.id || !Object.keys(body).length) {
    throw new Error('参数缺失')
  }

  if (!user?.id || user?.refresh) {
    throw new Error('token invalid')
  }

  retSuccess(res, await ModifySubApp(body, params.id, user, redis))
})

export default router
