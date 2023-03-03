import { DataTypes, Model } from "sequelize";
import User from "./User";
import db from "../db";

class SK extends Model {
  // sk对应用户
  declare user: number;
  // sk值
  declare value: string;

  declare created_at: string;
  declare updated_at: string;

  public getData() {
    return {
      sk: this.value,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

SK.init(
  {
    user: {
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: "id",
      },
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize: db,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default SK;
