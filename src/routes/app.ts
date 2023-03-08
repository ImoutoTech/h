import express from 'express'
import { retSuccess } from '../utils/restful'

const router = express.Router()

/**
 * 子应用注册
 */
router.post('/reg', async (req, res, next) => {
  try {
    if (!req.user) {
      throw new Error('give me the token')
    }

    retSuccess(res, {})
  } catch (e) {
    next(e)
  }
})

/**
 * 子应用回调
 */
router.post('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      throw new Error('give me the token')
    }

    retSuccess(res, {})
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
