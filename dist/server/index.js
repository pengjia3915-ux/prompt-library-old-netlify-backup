const fallbackPath = "/index.html";

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404) {
      return response;
    }

    const url = new URL(request.url);
    if (url.pathname === "/" || !url.pathname.includes(".")) {
      return env.ASSETS.fetch(new Request(new URL(fallbackPath, request.url), request));
    }

    return response;
  },
};
