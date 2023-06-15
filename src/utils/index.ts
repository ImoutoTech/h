import { Request, Response, NextFunction } from 'express'

export const checkParams = (
  body: object | undefined,
  params: string[]
): boolean => {
  if (!body) {
    return false
  }

  return params.every((par) => Object.keys(body).includes(par))
}

/**
 * 跨域处理
 * @param req 请求体
 * @param res 返回体
 * @param next Next
 */
export const corsConfig = (req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Allow-Headers', '*')
  if (req.method.toLowerCase() === 'options') res.sendStatus(200)
  else next()
}
