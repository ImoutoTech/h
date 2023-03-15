import express, { NextFunction, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { retError, retSuccess } from '../utils/restful'
import { LoginParam, RegisterParam } from '../service/types'
import {
  Login,
  Register,
  getUser,
  Refresh,
  ModifyData,
} from '../service/UserService'
import { checkParams } from '../utils'
import { ENV } from '../config'
import { HRedis } from '../db/redis'

const router = express.Router()

/**
 * 仅测试用
 * 密码生成
 */
router.get(
  '/pass-gen',
  function (req: Request, res: Response, _next: NextFunction) {
    if (ENV.MODE === 'dev') {
      const { plain = '' } = req.query

      if (plain === '') {
        res.json({ password: '' })
      } else {
        console.log(req.user)
        res.json({
          password: bcrypt.hashSync(plain as string, ENV.SALTROUND),
        })
      }
    } else {
      res.json({ password: '' })
    }
  }
)

/**
 * 用户注册
 */
router.post('/register', async function (req, res, next) {
  const { body } = req
  const paramList = ['nickname', 'email', 'password']

  if (!checkParams(body, paramList)) {
    retError(res, {}, '参数缺失')
  } else {
    try {
      retSuccess(res, await Register(body as RegisterParam, req.redis))
    } catch (e) {
      next(e)
    }
  }
})

/**
 * 用户登录
 */
router.post('/login', async function (req, res, next) {
  const { body } = req
  const paramList = ['email', 'password']

  if (!checkParams(body, paramList)) {
    retError(res, {}, '参数缺失')
  } else {
    try {
      retSuccess(res, await Login(body as LoginParam))
    } catch (e) {
      next(e)
    }
  }
})

/**
 * 用户token校验
 * 其实就是把token的payload返回
 */
router.get('/validate', async function (req, res, next) {
  try {
    retSuccess(res, req.user)
  } catch (e) {
    next(e)
  }
})

/**
 * 刷新token
 */
router.get('/refresh', async function (req, res, next) {
  try {
    if (!req.user?.refresh) {
      throw new Error('not refresh token')
    }

    retSuccess(res, Refresh(req.user))
  } catch (e) {
    next(e)
  }
})

/**
 * 获取用户信息
 */
router.get('/:id', async function (req, res, next) {
  try {
    const { params } = req

    if (!params.id) {
      throw new Error('参数缺失')
    }

    retSuccess(res, await getUser({ id: Number(params.id) }, req.redis))
  } catch (e) {
    next(e)
  }
})

/**
 * 更新用户信息
 */
router.put('/:id', async function (req, res, next) {
  try {
    const { params, redis, body, user } = req

    if (!params.id || !Object.keys(body).length) {
      throw new Error('参数缺失')
    }

    if (!user.id || user?.refresh) {
      throw new Error('token invalid')
    }

    retSuccess(res, await ModifyData(body, user.id, redis))
  } catch (e) {
    next(e)
  }
})

export default router
