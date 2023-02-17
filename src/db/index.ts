import { Sequelize } from "sequelize";
import { ENV } from "../config";

const {
  NAME: DBNAME = "",
  PORT: DBPORT = 3006,
  USER: DBUSER = "",
  HOST: DBHOST = "",
  PWD: DBPWD = "",
} = ENV.DB;

const db = new Sequelize(DBNAME, DBUSER, DBPWD, {
  host: DBHOST,
  port: DBPORT,
  dialect: "mysql",
});

export default db;
