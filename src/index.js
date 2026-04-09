export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url)
    const targetUrl = new URL(request.url)

    targetUrl.protocol = "https:"
    targetUrl.hostname = "ghcr.io"

    const headers = new Headers(request.headers)
    headers.set("Host", "ghcr.io")

    // 某些情况下，避免把 Worker 自己的压缩协商透传得太激进
    // 一般不删也行；出问题时可取消注释：
    // headers.delete("Accept-Encoding")

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    }

    const upstreamResp = await fetch(new Request(targetUrl.toString(), init))

    const respHeaders = new Headers(upstreamResp.headers)

    // 改写 Location，把 ghcr.io 跳转改回你的代理域名
    const location = respHeaders.get("Location")
    if (location) {
      try {
        const locUrl = new URL(location)
        if (locUrl.hostname === "ghcr.io") {
          locUrl.hostname = incomingUrl.hostname
          locUrl.protocol = incomingUrl.protocol
          respHeaders.set("Location", locUrl.toString())
        }
      } catch {
        // 非标准 Location 就保持原样
      }
    }

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: respHeaders,
    })
  }
}