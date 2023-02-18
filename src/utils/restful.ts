export interface Restful<T> {
  code: number;
  msg?: string;
  data: T;
}

export const Restful = (
  code: number,
  message: string,
  data: any
): Restful<any> => {
  return {
    code,
    msg: message,
    data,
  };
};
