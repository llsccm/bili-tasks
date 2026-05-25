declare module 'baihu' {
  interface BaihuSdk {
    notify(title: string, content: string): void | Promise<void>
  }

  const baihu: BaihuSdk
  export default baihu
}
