import { CONFIG } from "../config";

/**
 * 返回应用基础信息
 * @returns 基础信息
 */
export const Index = () => {
  return {
    name: CONFIG.TITLE,
    version: CONFIG.VERSION,
  };
};
