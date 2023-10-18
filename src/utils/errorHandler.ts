import { Request, Response, NextFunction } from 'express'
import { retError } from './restful'
import { AUTH_ERROR_TEXT } from '../config'
import { error, echo } from './logger'
import { ValidationError } from 'sequelize'

export default function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  echo(error(`error: ${err.message}`))

  if (err instanceof ValidationError) {
    retError(res, {}, err.errors.map((error) => error.message).join(','))
    return
  }

  retError(res, {}, err.message)
}

export const handleTokenExpire = (_req: Request) => {
  throw new Error(AUTH_ERROR_TEXT)
}
