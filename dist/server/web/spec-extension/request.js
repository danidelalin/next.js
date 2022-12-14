"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.INTERNALS = void 0;
var _nextUrl = require("../next-url");
var _utils = require("../utils");
var _error = require("../error");
var _cookies = require("./cookies");
const INTERNALS = Symbol("internal request");
exports.INTERNALS = INTERNALS;
class NextRequest extends Request {
    constructor(input, init = {}){
        const url = typeof input === "string" ? input : input.url;
        (0, _utils).validateURL(url);
        super(input, init);
        this[INTERNALS] = {
            cookies: new _cookies.NextCookies(this),
            geo: init.geo || {},
            ip: init.ip,
            url: new _nextUrl.NextURL(url, {
                headers: (0, _utils).toNodeHeaders(this.headers),
                nextConfig: init.nextConfig
            })
        };
    }
    get cookies() {
        return this[INTERNALS].cookies;
    }
    get geo() {
        return this[INTERNALS].geo;
    }
    get ip() {
        return this[INTERNALS].ip;
    }
    get nextUrl() {
        return this[INTERNALS].url;
    }
    get page() {
        throw new _error.RemovedPageError();
    }
    get ua() {
        throw new _error.RemovedUAError();
    }
    get url() {
        return this[INTERNALS].url.toString();
    }
}
exports.NextRequest = NextRequest;

//# sourceMappingURL=request.js.map