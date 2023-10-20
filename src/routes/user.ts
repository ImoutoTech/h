import express, { NextFunction, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { Md5 } from 'ts-md5'
import { retError, retSuccess } from '../utils/restful'
import { LoginParam, RegisterParam } from '../service/types'
import {
  Login,
  Register,
  getUser,
  Refresh,
  ModifyData,
  ModifyPass,
  getAllUser,
} from '../service/UserService'
import { checkParams } from '../utils'
import { ENV, ROLE } from '../config'

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
router.post('/register', async function (req, res) {
  const { body, query } = req
  const paramList = ['nickname', 'email', 'password']

  const regParam = {
    ...body,
  }

  if (!query.md5) {
    regParam.password = Md5.hashStr(regParam.password)
  }

  if (!checkParams(body, paramList)) {
    retError(res, {}, '参数缺失')
  } else {
    retSuccess(res, await Register(regParam as RegisterParam, req.redis))
  }
})

/**
 * 用户登录
 */
router.post('/login', async function (req, res) {
  const { body, query } = req
  const paramList = ['email', 'password']

  const loginParam = {
    ...body,
  }

  if (!query.md5) {
    loginParam.password = Md5.hashStr(loginParam.password)
  }

  if (!checkParams(body, paramList)) {
    retError(res, {}, '参数缺失')
  } else {
    retSuccess(res, await Login(loginParam as LoginParam))
  }
})

/**
 * 用户token校验
 * 其实就是把token的payload返回
 */
router.get('/validate', async function (req, res) {
  retSuccess(res, req.user)
})

/**
 * 刷新token
 */
router.get('/refresh', async function (req, res) {
  if (!req.user?.refresh) {
    throw new Error('not refresh token')
  }

  retSuccess(res, Refresh(req.user))
})

/**
 * 获取所有用户列表
 */
router.get('/all', async (req, res) => {
  if (!req.user || req.user.refresh) {
    throw new Error('give me the token')
  }

  if (req.user.role !== ROLE.ADMIN) {
    throw new Error('not admin')
  }

  const { page, size, search } = req.query

  retSuccess(
    res,
    await getAllUser(Number(page), Number(size), search as string)
  )
})

/**
 * 获取用户信息
 */
router.get('/:id', async function (req, res) {
  const { params } = req

  if (!params.id) {
    throw new Error('参数缺失')
  }

  retSuccess(res, await getUser({ id: Number(params.id) }, req.redis))
})

/**
 * 更新用户信息
 */
router.put('/:id', async function (req, res) {
  const { params, redis, body, user } = req

  if (!params.id || !Object.keys(body).length) {
    throw new Error('参数缺失')
  }

  if (!user?.id || user?.refresh) {
    throw new Error('token invalid')
  }

  retSuccess(res, await ModifyData(body, user.id, redis))
})

/**
 * 更新用户密码
 */
router.put('/:id/password', async function (req, res) {
  const { params, redis, body, user, query } = req

  if (!params.id || !Object.keys(body).length) {
    throw new Error('参数缺失')
  }

  if (!user?.id || user?.refresh) {
    throw new Error('token invalid')
  }

  const passData = {
    ...body,
  }

  if (!query.md5) {
    passData.oldVal = Md5.hashStr(passData.oldVal)
    passData.newVal = Md5.hashStr(passData.newVal)
  }

  retSuccess(res, await ModifyPass(passData, user.id, redis))
})

export default router
