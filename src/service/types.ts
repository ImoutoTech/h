export interface LoginParam {
  email: string
  password: string
}

export interface RegisterParam extends LoginParam {
  nickname: string
}

export interface AppRegParam {
  name: string
  callback: string
}
