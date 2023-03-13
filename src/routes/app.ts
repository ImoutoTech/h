import express from 'express'
import { checkParams } from '../utils'
import { retSuccess } from '../utils/restful'
import { RegisterApp, getSubAppData } from '../service/SubAppService'

const router = express.Router()

/**
 * 子应用注册
 */
router.post('/reg', async (req, res, next) => {
  try {
    if (!req.user) {
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
 * 子应用回调
 */
router.post('/:id', async (req, res, next) => {
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
    if (!req.user) {
      throw new Error('give me the token')
    }

    retSuccess(res, {})
  } catch (e) {
    next(e)
  }
})

export default router
