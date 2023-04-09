import { Response } from 'express'

/**
 * 错误码：
 * 0: 成功
 * 100: 错误
 */

export interface Restful {
  code: number
  msg?: string
  data: any
}

export const Restful = (code: number, data: any, message?: string): Restful => {
  return {
    code,
    msg: message,
    data,
  }
}

/**
 * 返回成功
 * @param res 响应体
 * @param data 响应数据
 */
export const retSuccess = (res: Response, data: any, msg?: string) => {
  res.json(Restful(0, data, msg || 'OK'))
}

/**
 * 返回成功
 * @param res 响应体
 * @param data 响应数据
 */
export const retError = (res: Response, data: any, msg?: string) => {
  if (msg === 'token 已经过期') {
    res.status(401).json(Restful(100, data, msg || 'Error'))
  }

  res.json(Restful(100, data, msg || 'Error'))
}
