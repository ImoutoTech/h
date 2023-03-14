import { DataTypes, Model } from 'sequelize'
import db from '../db'
import User from './User'

export interface SubAppBaseInfo {
  name: string
  id: string
  callback: string
  owner: number
  created_at: string
  updated_at: string
}

class SubApp extends Model {
  // 子应用id
  declare id: string

  // 子应用回调地址
  declare callback: string

  // 子应用名称
  declare name: string

  // 子应用所有人
  declare owner: number

  declare created_at: string
  declare updated_at: string

  public getData(): SubAppBaseInfo {
    return {
      name: this.name,
      id: this.id,
      callback: this.callback,
      owner: this.owner,
      created_at: this.created_at,
      updated_at: this.updated_at,
    }
  }
}

SubApp.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    owner: {
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: 'id',
      },
    },
    callback: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize: db,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
)

export default SubApp
