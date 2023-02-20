import { DataTypes, Model } from "sequelize";
import bcrypt from "bcrypt";
import db from "../db";

class User extends Model {
  declare password: string;

  public getData() {
    return JSON.parse(
      JSON.stringify(this, [
        "id",
        "nickname",
        "email",
        "created_at",
        "avatar",
        "updated_at",
        "role",
      ])
    );
  }

  public checkPassword(pwd: string) {
    return bcrypt.compareSync(pwd, this.password);
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      unique: true,
      autoIncrement: true,
    },
    nickname: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("0", "1"),
      allowNull: false,
      defaultValue: "1",
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default User;
