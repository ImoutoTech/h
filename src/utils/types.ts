export interface UserTokenInfo {
  email: string
  role: number
  id: number
  refresh: boolean
}

export interface UserData {
  password: string
  nickname: string
  role: number
  avatar: string
  email: string
  [key: string]: string | number
}
