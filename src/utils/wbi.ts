function getFilenameFromUrl(url: string): string {
  return url.substring(url.lastIndexOf('/') + 1).split('.')[0]
}

const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28,
  14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54,
  21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
]

export function createWbiSalt(imgUrl = '', subUrl = ''): string {
  const rawKey = getFilenameFromUrl(imgUrl) + getFilenameFromUrl(subUrl)
  return mixinKeyEncTab
    .map((index) => rawKey[index])
    .join('')
    .slice(0, 32)
}
