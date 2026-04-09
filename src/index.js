export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url)
    const targetUrl = new URL(request.url)

    // 所有请求都转到 ghcr.io
    targetUrl.protocol = "https:"
    targetUrl.hostname = "ghcr.io"

    const headers = new Headers(request.headers)
    headers.set("Host", "ghcr.io")

    const reqInit = {
      method: request.method,
      headers,
      redirect: "manual",
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    }

    const upstreamResp = await fetch(new Request(targetUrl.toString(), reqInit))

    const respHeaders = new Headers(upstreamResp.headers)

    // 改写 Location
    const location = respHeaders.get("Location")
    if (location) {
      try {
        const locUrl = new URL(location)
        if (locUrl.hostname === "ghcr.io") {
          locUrl.hostname = incomingUrl.hostname
          locUrl.protocol = incomingUrl.protocol
          respHeaders.set("Location", locUrl.toString())
        }
      } catch {}
    }

    // 改写 WWW-Authenticate 中的 realm
    const wwwAuth = respHeaders.get("WWW-Authenticate")
    if (wwwAuth) {
      let newAuth = wwwAuth

      newAuth = newAuth.replace(
        /realm="https:\/\/ghcr\.io/gi,
        `realm="${incomingUrl.protocol}//${incomingUrl.host}`
      )

      // 有些实现里也可能需要把 service 改成代理域名
      // 但对 ghcr 来说，通常先只改 realm 更稳
      respHeaders.set("WWW-Authenticate", newAuth)
    }

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: respHeaders,
    })
  }
}