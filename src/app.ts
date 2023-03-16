import express from 'express'
import logger from './utils/logger'
import { expressjwt } from 'express-jwt'
import errorHandler, { handleTokenExpire } from './utils/errorHandler'
import { useRedis } from './db/redis'

import indexRouter from './routes/index'
import userRouter from './routes/user'
import skRouter from './routes/sk'
import subAppRouter from './routes/app'

import { ENV } from './config'

const app = express()

app.use(logger)
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(
  expressjwt({
    secret: ENV.TOKEN_SECRET,
    algorithms: ['HS256'],
    credentialsRequired: false,
    requestProperty: 'user',
    onExpired: handleTokenExpire,
  })
)
app.use(useRedis)

app.use('/', indexRouter)
app.use('/user', userRouter)
app.use('/sk', skRouter)
app.use('/app', subAppRouter)

app.use(errorHandler)

export default app
