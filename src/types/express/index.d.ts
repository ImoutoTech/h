import { UserInfo } from "../../utils/types";
import { RedisClientType } from "redis";

declare global {
  namespace Express {
    export interface Request {
      user?: UserInfo;
      query: any;
      params: any;
      redis: RedisClientType<any, any, any>;
    }
  }
}
