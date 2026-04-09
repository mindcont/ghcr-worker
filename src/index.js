function registryError(code, message, status) {
  return new Response(
    JSON.stringify({ errors: [{ code, message }] }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

export default {
  async fetch(request, _env, _ctx) {
    const url = new URL(request.url);
    const UPSTREAM = "https://ghcr.io";
    const SELF = "https://ghcr.wio.me";

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    if (!url.pathname.startsWith("/v2/") && !url.pathname.startsWith("/token")) {
      return registryError("NAME_UNKNOWN", "Not Found", 404);
    }

    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      return registryError("UNSUPPORTED", "Method Not Allowed", 405);
    }

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
      return registryError("UNAVAILABLE", `Upstream fetch failed: ${err?.message || err}`, 502);
    }

    const outHeaders = new Headers(response.headers);
    outHeaders.set("Access-Control-Expose-Headers",
      "Docker-Content-Digest, WWW-Authenticate, Link, Location, Content-Length");
    outHeaders.set("X-Registry-Proxy", "ghcr.wio.me");

    const authHeader = outHeaders.get("WWW-Authenticate");
    if (authHeader) {
      outHeaders.set("WWW-Authenticate", authHeader.replaceAll(UPSTREAM, SELF));
    }

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
