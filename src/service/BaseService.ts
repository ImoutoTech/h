import { CONFIG } from "../config";

export const Index = () => {
  return {
    name: CONFIG.TITLE,
    version: CONFIG.VERSION,
  };
};
