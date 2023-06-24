import { UserTokenInfo } from '../../utils/types'
import { HRedis } from '../../db/redis'

declare global {
  namespace Express {
    export interface Request {
      user?: UserTokenInfo
      query: any
      params: any
      redis: HRedis
    }
  }
}
