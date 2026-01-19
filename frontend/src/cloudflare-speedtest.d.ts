declare module '@cloudflare/speedtest' {
  interface SpeedTestOptions {
    autoStart?: boolean
    measureDownloadLoadedLatency?: boolean
    measureUploadLoadedLatency?: boolean
  }
  interface SpeedTestInstance {
    onResultsChange?: (info: { type?: string }) => void
    onFinish?: (results: unknown) => void
    onError?: (e: unknown) => void
    stop?: () => void
  }
  const SpeedTest: new (opts?: SpeedTestOptions) => SpeedTestInstance
  export default SpeedTest
}
