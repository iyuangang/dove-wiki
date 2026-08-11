export function publicAssetUrl(path: string, basePath = import.meta.env.BASE_URL): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) return path

  const trimmedBase = basePath.trim()
  const normalizedBase = trimmedBase && trimmedBase !== '/'
    ? `/${trimmedBase.replace(/^\/+|\/+$/g, '')}/`
    : '/'

  return `${normalizedBase}${path.replace(/^\/+/, '')}`
}
