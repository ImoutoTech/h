import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { ENV_LIST } from '../utils/constants';

for (const path of ENV_LIST) config({ path });

export default new DataSource({
  type: 'mysql',
  host: process.env.MYSQL_SERVER || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  username: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'h',
  synchronize: false,
  entities: ['src/entity/*.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
