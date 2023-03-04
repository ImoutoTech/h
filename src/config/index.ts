import * as dotenv from "dotenv";
dotenv.config();

export const ENV = {
  DB: {
    NAME: process.env.DB_NAME,
    HOST: process.env.DB_HOST,
    PWD: process.env.DB_PWD,
    USER: process.env.DB_USER,
    PORT: Number(process.env.DB_PORT),
  },
  SALTROUND: Number(process.env.SALTROUND),
  PORT: process.env.PORT,
  MODE: process.env.MODE,
  TOKEN_SECRET: String(process.env.TOKEN_SECRET),
  REDIS_URL: process.env.REDIS_URL,
};

export const CONFIG = {
  TITLE: "Homepod",
  VERSION: "0.1.0",
};
