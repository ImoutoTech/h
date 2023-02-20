export const checkParams = (
  body: object | undefined,
  params: string[]
): boolean => {
  if (!body) {
    return false;
  }

  return params.every((par) => Object.keys(body).includes(par));
};
