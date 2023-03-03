import { UserInfo } from "../../utils/types";

declare global {
  namespace Express {
    export interface Request {
      user?: UserInfo;
      query: any;
      params: any;
    }
  }
}
