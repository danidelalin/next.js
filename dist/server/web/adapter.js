"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.adapter = adapter;
exports.blockUnallowedResponse = blockUnallowedResponse;
var _error = require("./error");
var _utils = require("./utils");
var _fetchEvent = require("./spec-extension/fetch-event");
var _request = require("./spec-extension/request");
var _response = require("./spec-extension/response");
var _relativizeUrl = require("../../shared/lib/router/utils/relativize-url");
var _nextUrl = require("./next-url");
async function adapter(params) {
    const requestUrl = new _nextUrl.NextURL(params.request.url, {
        headers: params.request.headers,
        nextConfig: params.request.nextConfig
    });
    // Ensure users only see page requests, never data requests.
    const buildId = requestUrl.buildId;
    requestUrl.buildId = "";
    const isDataReq = params.request.headers["x-nextjs-data"];
    if (isDataReq && requestUrl.pathname === "/index") {
        requestUrl.pathname = "/";
    }
    // clean-up any internal query params
    for (const key of [
        ...requestUrl.searchParams.keys()
    ]){
        if (key.startsWith("__next")) {
            requestUrl.searchParams.delete(key);
        }
    }
    const request = new NextRequestHint({
        page: params.page,
        input: String(requestUrl),
        init: {
            body: params.request.body,
            geo: params.request.geo,
            headers: (0, _utils).fromNodeHeaders(params.request.headers),
            ip: params.request.ip,
            method: params.request.method,
            nextConfig: params.request.nextConfig
        }
    });
    /**
   * This allows to identify the request as a data request. The user doesn't
   * need to know about this property neither use it. We add it for testing
   * purposes.
   */ if (isDataReq) {
        Object.defineProperty(request, "__isData", {
            enumerable: false,
            value: true
        });
    }
    const event = new _fetchEvent.NextFetchEvent({
        request,
        page: params.page
    });
    let response = await params.handler(request, event);
    /**
   * For rewrites we must always include the locale in the final pathname
   * so we re-create the NextURL forcing it to include it when the it is
   * an internal rewrite. Also we make sure the outgoing rewrite URL is
   * a data URL if the request was a data request.
   */ const rewrite = response == null ? void 0 : response.headers.get("x-middleware-rewrite");
    if (response && rewrite) {
        const rewriteUrl = new _nextUrl.NextURL(rewrite, {
            forceLocale: true,
            headers: params.request.headers,
            nextConfig: params.request.nextConfig
        });
        if (rewriteUrl.host === request.nextUrl.host) {
            rewriteUrl.buildId = buildId || rewriteUrl.buildId;
            response.headers.set("x-middleware-rewrite", String(rewriteUrl));
        }
        /**
     * When the request is a data request we must show if there was a rewrite
     * with an internal header so the client knows which component to load
     * from the data request.
     */ if (isDataReq) {
            response.headers.set("x-nextjs-rewrite", (0, _relativizeUrl).relativizeURL(String(rewriteUrl), String(requestUrl)));
        }
    }
    /**
   * For redirects we will not include the locale in case when it is the
   * default and we must also make sure the outgoing URL is a data one if
   * the incoming request was a data request.
   */ const redirect = response == null ? void 0 : response.headers.get("Location");
    if (response && redirect) {
        const redirectURL = new _nextUrl.NextURL(redirect, {
            forceLocale: false,
            headers: params.request.headers,
            nextConfig: params.request.nextConfig
        });
        /**
     * Responses created from redirects have immutable headers so we have
     * to clone the response to be able to modify it.
     */ response = new Response(response.body, response);
        if (redirectURL.host === request.nextUrl.host) {
            redirectURL.buildId = buildId || redirectURL.buildId;
            response.headers.set("Location", String(redirectURL));
        }
        /**
     * When the request is a data request we can't use the location header as
     * it may end up with CORS error. Instead we map to an internal header so
     * the client knows the destination.
     */ if (isDataReq) {
            response.headers.delete("Location");
            response.headers.set("x-nextjs-redirect", (0, _relativizeUrl).relativizeURL(String(redirectURL), String(requestUrl)));
        }
    }
    return {
        response: response || _response.NextResponse.next(),
        waitUntil: Promise.all(event[_fetchEvent.waitUntilSymbol])
    };
}
function blockUnallowedResponse(promise) {
    return promise.then((result)=>{
        var ref;
        if ((ref = result.response) == null ? void 0 : ref.body) {
            console.error(new Error(`A middleware can not alter response's body. Learn more: https://nextjs.org/docs/messages/returning-response-body-in-middleware`));
            return {
                ...result,
                response: new Response("Internal Server Error", {
                    status: 500,
                    statusText: "Internal Server Error"
                })
            };
        }
        return result;
    });
}
class NextRequestHint extends _request.NextRequest {
    constructor(params){
        super(params.input, params.init);
        this.sourcePage = params.page;
    }
    get request() {
        throw new _error.PageSignatureError({
            page: this.sourcePage
        });
    }
    respondWith() {
        throw new _error.PageSignatureError({
            page: this.sourcePage
        });
    }
    waitUntil() {
        throw new _error.PageSignatureError({
            page: this.sourcePage
        });
    }
}

//# sourceMappingURL=adapter.js.map