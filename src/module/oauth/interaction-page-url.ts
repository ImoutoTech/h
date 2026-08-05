export function interactionPageUrl(baseUrl: string, uid: string) {
  return new URL(
    `/authorize/interaction/${encodeURIComponent(uid)}`,
    baseUrl,
  ).toString();
}
