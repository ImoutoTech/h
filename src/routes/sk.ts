import express from 'express'
import { retSuccess } from '../utils/restful'
import { getSK } from '../service/SKService'

const router = express.Router()

/**
 * 获取用户SK
 */
router.get('/', async (req, res) => {
  if (!req.user) {
    throw new Error('give me the token')
  }

  retSuccess(res, await getSK(req.user.id, false))
})

/**
 * 更新用户SK
 */
router.put('/', async (req, res) => {
  if (!req.user) {
    throw new Error('give me the token')
  }

  retSuccess(res, await getSK(req.user.id, true))
})

export default router
