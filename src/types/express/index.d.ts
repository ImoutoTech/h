import { UserInfo } from "../../utils/types";
import { HRedis } from "../../db/redis";

declare global {
  namespace Express {
    export interface Request {
      user?: UserInfo;
      query: any;
      params: any;
      redis: HRedis;
    }
  }
}
