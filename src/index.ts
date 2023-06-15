import app from './app'
import { ENV, CONFIG } from './config'
import { echo, info, error, success, space } from './utils/logger'
import db from './db'
import { testRedis } from './db/redis'

;(async function () {
  try {
    space(2)
    echo(
      `[${CONFIG.TITLE}] starting ${CONFIG.TITLE} in ${info(
        ENV.MODE || ''
      )} mode`
    )
    space()

    await db.authenticate()
    echo(`[${CONFIG.TITLE}] ` + success('connected to db'))

    await testRedis()

    app.listen(4000, () => {
      echo(`[${CONFIG.TITLE}] listening on port ${info(ENV.PORT || 'unknown')}`)
    })
  } catch (e: any) {
    echo(`[${CONFIG.TITLE}] ${error(`error: ${e.message}`)}`)
    echo(e)
  }
})()
