export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 只允许 GHCR Registry API，避免变成开放代理
    if (!url.pathname.startsWith("/v2/")) {
      return new Response("Not Found", { status: 404 });
    }

    const upstreamUrl = new URL(url.pathname + url.search, "https://ghcr.io");

    const headers = new Headers(request.headers);
    headers.set("Host", "ghcr.io");

    // 清理一些没必要的头
    headers.delete("cf-connecting-ip");
    headers.delete("x-forwarded-for");
    headers.delete("x-real-ip");

    const method = request.method.toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);

    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method,
      headers,
      body: hasBody ? request.body : undefined,
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

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  },
};