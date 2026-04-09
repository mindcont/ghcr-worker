export default {
  async fetch(request, _env, _ctx) {
    const url = new URL(request.url);
    const UPSTREAM = "https://ghcr.io";
    const SELF = "https://ghcr.wio.me";

    // 健康检查
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    // 只允许 GHCR Registry API，避免变成开放代理
    if (!url.pathname.startsWith("/v2/")) {
      return new Response("Not Found", { status: 404 });
    }

    // 只允许只读方法，防止被滥用推送镜像
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // CORS 预检请求本地返回
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Accept, Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const upstreamUrl = new URL(url.pathname + url.search, UPSTREAM);

    const headers = new Headers(request.headers);
    headers.set("Host", "ghcr.io");

    // 清理客户端 IP 相关头部
    headers.delete("cf-connecting-ip");
    headers.delete("x-forwarded-for");
    headers.delete("x-real-ip");

    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: null,
      redirect: "follow",
    });

    let response;
    try {
      response = await fetch(upstreamRequest);
    } catch (err) {
      return new Response(`Upstream fetch failed: ${err?.message || err}`, {
        status: 502,
      });
    }

    const outHeaders = new Headers(response.headers);
    outHeaders.set(
      "Access-Control-Expose-Headers",
      "Docker-Content-Digest, WWW-Authenticate, Link, Location, Content-Length"
    );
    outHeaders.set("X-Registry-Proxy", "ghcr.wio.me");

    // 改写 WWW-Authenticate realm，让认证也走代理
    const authHeader = outHeaders.get("WWW-Authenticate");
    if (authHeader) {
      outHeaders.set(
        "WWW-Authenticate",
        authHeader.replaceAll(UPSTREAM, SELF)
      );
    }

    // 改写 Location 头，防止重定向绕过代理
    const location = outHeaders.get("Location");
    if (location && location.includes("ghcr.io")) {
      outHeaders.set("Location", location.replaceAll(UPSTREAM, SELF));
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  },
};
