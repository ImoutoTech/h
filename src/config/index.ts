import * as dotenv from "dotenv";
dotenv.config();

export const ENV = {
  DB: {
    NAME: process.env.DB_NAME,
    HOST: process.env.DB_HOST,
    PWD: process.env.DB_PWD,
    USER: process.env.DB_USER,
    PORT: process.env.PORT,
  },
  DEBUG: Boolean(process.env.DEBUG),
  PORT: process.env.PORT,
  MODE: process.env.MODE,
};
