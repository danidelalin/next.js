"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = void 0;
var _crypto = _interopRequireDefault(require("crypto"));
var _fs = _interopRequireDefault(require("fs"));
var _chalk = _interopRequireDefault(require("next/dist/compiled/chalk"));
var _jestWorker = require("next/dist/compiled/jest-worker");
var _findUp = _interopRequireDefault(require("next/dist/compiled/find-up"));
var _path = require("path");
var _react = _interopRequireDefault(require("react"));
var _watchpack = _interopRequireDefault(require("next/dist/compiled/watchpack"));
var _output = require("../../build/output");
var _constants = require("../../lib/constants");
var _fileExists = require("../../lib/file-exists");
var _findPagesDir = require("../../lib/find-pages-dir");
var _loadCustomRoutes = _interopRequireDefault(require("../../lib/load-custom-routes"));
var _verifyTypeScriptSetup = require("../../lib/verifyTypeScriptSetup");
var _verifyPartytownSetup = require("../../lib/verify-partytown-setup");
var _constants1 = require("../../shared/lib/constants");
var _nextServer = _interopRequireWildcard(require("../next-server"));
var _routeMatcher = require("../../shared/lib/router/utils/route-matcher");
var _normalizePagePath = require("../../shared/lib/page-path/normalize-page-path");
var _absolutePathToPage = require("../../shared/lib/page-path/absolute-path-to-page");
var _router = _interopRequireDefault(require("../router"));
var _pathMatch = require("../../shared/lib/router/utils/path-match");
var _pathHasPrefix = require("../../shared/lib/router/utils/path-has-prefix");
var _removePathPrefix = require("../../shared/lib/router/utils/remove-path-prefix");
var _events = require("../../telemetry/events");
var _storage = require("../../telemetry/storage");
var _trace = require("../../trace");
var _hotReloader = _interopRequireDefault(require("./hot-reloader"));
var _findPageFile = require("../lib/find-page-file");
var _utils = require("../lib/utils");
var _coalescedFunction = require("../../lib/coalesced-function");
var _loadComponents = require("../load-components");
var _utils1 = require("../../shared/lib/utils");
var _middleware = require("next/dist/compiled/@next/react-dev-overlay/dist/middleware");
var Log = _interopRequireWildcard(require("../../build/output/log"));
var _isError = _interopRequireWildcard(require("../../lib/is-error"));
var _routeRegex = require("../../shared/lib/router/utils/route-regex");
var _utils2 = require("../../shared/lib/router/utils");
var _entries = require("../../build/entries");
var _getPageStaticInfo = require("../../build/analysis/get-page-static-info");
var _normalizePathSep = require("../../shared/lib/page-path/normalize-path-sep");
var _appPaths = require("../../shared/lib/router/utils/app-paths");
var _utils3 = require("../../build/utils");
class DevServer extends _nextServer.default {
    addedUpgradeListener = false;
    getStaticPathsWorker() {
        if (this.staticPathsWorker) {
            return this.staticPathsWorker;
        }
        this.staticPathsWorker = new _jestWorker.Worker(require.resolve("./static-paths-worker"), {
            maxRetries: 1,
            numWorkers: this.nextConfig.experimental.cpus,
            enableWorkerThreads: this.nextConfig.experimental.workerThreads,
            forkOptions: {
                env: {
                    ...process.env,
                    // discard --inspect/--inspect-brk flags from process.env.NODE_OPTIONS. Otherwise multiple Node.js debuggers
                    // would be started if user launch Next.js in debugging mode. The number of debuggers is linked to
                    // the number of workers Next.js tries to launch. The only worker users are interested in debugging
                    // is the main Next.js one
                    NODE_OPTIONS: (0, _utils).getNodeOptionsWithoutInspect()
                }
            }
        });
        this.staticPathsWorker.getStdout().pipe(process.stdout);
        this.staticPathsWorker.getStderr().pipe(process.stderr);
        return this.staticPathsWorker;
    }
    constructor(options){
        var ref, ref1;
        super({
            ...options,
            dev: true
        });
        this.renderOpts.dev = true;
        this.renderOpts.ErrorDebug = ReactDevOverlay;
        this.devReady = new Promise((resolve)=>{
            this.setDevReady = resolve;
        });
        var ref2;
        this.renderOpts.ampSkipValidation = (ref2 = (ref = this.nextConfig.experimental) == null ? void 0 : (ref1 = ref.amp) == null ? void 0 : ref1.skipValidation) != null ? ref2 : false;
        this.renderOpts.ampValidator = (html, pathname)=>{
            const validatorPath = this.nextConfig.experimental && this.nextConfig.experimental.amp && this.nextConfig.experimental.amp.validator;
            const AmpHtmlValidator = require("next/dist/compiled/amphtml-validator");
            return AmpHtmlValidator.getInstance(validatorPath).then((validator)=>{
                const result = validator.validateString(html);
                (0, _output).ampValidation(pathname, result.errors.filter((e)=>e.severity === "ERROR").filter((e)=>this._filterAmpDevelopmentScript(html, e)), result.errors.filter((e)=>e.severity !== "ERROR"));
            });
        };
        if (_fs.default.existsSync((0, _path).join(this.dir, "static"))) {
            console.warn(`The static directory has been deprecated in favor of the public directory. https://nextjs.org/docs/messages/static-dir-deprecated`);
        }
        // setup upgrade listener eagerly when we can otherwise
        // it will be done on the first request via req.socket.server
        if (options.httpServer) {
            this.setupWebSocketHandler(options.httpServer);
        }
        this.isCustomServer = !options.isNextDevCommand;
        // TODO: hot-reload root/pages dirs?
        const { pages: pagesDir , appDir  } = (0, _findPagesDir).findPagesDir(this.dir, this.nextConfig.experimental.appDir);
        this.pagesDir = pagesDir;
        this.appDir = appDir;
    }
    getBuildId() {
        return "development";
    }
    async addExportPathMapRoutes() {
        // Makes `next export` exportPathMap work in development mode.
        // So that the user doesn't have to define a custom server reading the exportPathMap
        if (this.nextConfig.exportPathMap) {
            console.log("Defining routes from exportPathMap");
            const exportPathMap = await this.nextConfig.exportPathMap({}, {
                dev: true,
                dir: this.dir,
                outDir: null,
                distDir: this.distDir,
                buildId: this.buildId
            }) // In development we can't give a default path mapping
            ;
            for(const path in exportPathMap){
                const { page , query ={}  } = exportPathMap[path];
                // We use unshift so that we're sure the routes is defined before Next's default routes
                this.router.addFsRoute({
                    match: (0, _pathMatch).getPathMatch(path),
                    type: "route",
                    name: `${path} exportpathmap route`,
                    fn: async (req, res, _params, parsedUrl)=>{
                        const { query: urlQuery  } = parsedUrl;
                        Object.keys(urlQuery).filter((key)=>query[key] === undefined).forEach((key)=>console.warn(`Url '${path}' defines a query parameter '${key}' that is missing in exportPathMap`));
                        const mergedQuery = {
                            ...urlQuery,
                            ...query
                        };
                        await this.render(req, res, page, mergedQuery, parsedUrl, true);
                        return {
                            finished: true
                        };
                    }
                });
            }
        }
    }
    async startWatcher() {
        if (this.webpackWatcher) {
            return;
        }
        const regexPageExtension = new RegExp(`\\.+(?:${this.nextConfig.pageExtensions.join("|")})$`);
        let resolved = false;
        return new Promise((resolve, reject)=>{
            // Watchpack doesn't emit an event for an empty directory
            _fs.default.readdir(this.pagesDir, (_, files)=>{
                if (files == null ? void 0 : files.length) {
                    return;
                }
                if (!resolved) {
                    resolve();
                    resolved = true;
                }
            });
            const wp = this.webpackWatcher = new _watchpack.default();
            const pages = [
                this.pagesDir
            ];
            const app = this.appDir ? [
                this.appDir
            ] : [];
            const directories = [
                ...pages,
                ...app
            ];
            const files1 = (0, _utils3).getPossibleMiddlewareFilenames((0, _path).join(this.pagesDir, ".."), this.nextConfig.pageExtensions);
            let nestedMiddleware = [];
            wp.watch(files1, directories, 0);
            wp.on("aggregated", async ()=>{
                const routedMiddleware = [];
                let middlewareMatcher;
                const routedPages = [];
                const knownFiles = wp.getTimeInfoEntries();
                const appPaths = {};
                const ssrMiddleware = new Set();
                for (const [fileName, meta] of knownFiles){
                    if ((meta == null ? void 0 : meta.accuracy) === undefined || !regexPageExtension.test(fileName)) {
                        continue;
                    }
                    const isAppPath = Boolean(this.appDir && (0, _normalizePathSep).normalizePathSep(fileName).startsWith((0, _normalizePathSep).normalizePathSep(this.appDir)));
                    const rootFile = (0, _absolutePathToPage).absolutePathToPage(fileName, {
                        pagesDir: this.dir,
                        extensions: this.nextConfig.pageExtensions
                    });
                    const staticInfo = await (0, _getPageStaticInfo).getPageStaticInfo({
                        pageFilePath: fileName,
                        nextConfig: this.nextConfig,
                        page: rootFile
                    });
                    if ((0, _utils3).isMiddlewareFile(rootFile)) {
                        var ref;
                        this.actualMiddlewareFile = rootFile;
                        middlewareMatcher = ((ref = staticInfo.middleware) == null ? void 0 : ref.pathMatcher) || new RegExp(".*");
                        routedMiddleware.push("/");
                        continue;
                    }
                    let pageName = (0, _absolutePathToPage).absolutePathToPage(fileName, {
                        pagesDir: isAppPath ? this.appDir : this.pagesDir,
                        extensions: this.nextConfig.pageExtensions,
                        keepIndex: isAppPath
                    });
                    if (isAppPath) {
                        // TODO: should only routes ending in /index.js be route-able?
                        const originalPageName = pageName;
                        pageName = (0, _appPaths).normalizeAppPath(pageName);
                        appPaths[pageName] = originalPageName;
                        if (routedPages.includes(pageName)) {
                            continue;
                        }
                    } else {
                        // /index is preserved for root folder
                        pageName = pageName.replace(/\/index$/, "") || "/";
                    }
                    /**
           * If there is a middleware that is not declared in the root we will
           * warn without adding it so it doesn't make its way into the system.
           */ if (/[\\\\/]_middleware$/.test(pageName)) {
                        nestedMiddleware.push(pageName);
                        continue;
                    }
                    (0, _entries).runDependingOnPageType({
                        page: pageName,
                        pageRuntime: staticInfo.runtime,
                        onClient: ()=>{},
                        onServer: ()=>{},
                        onEdgeServer: ()=>{
                            if (!pageName.startsWith("/api/")) {
                                routedMiddleware.push(pageName);
                            }
                            ssrMiddleware.add(pageName);
                        }
                    });
                    routedPages.push(pageName);
                }
                if (nestedMiddleware.length > 0) {
                    Log.error(new _utils3.NestedMiddlewareError(nestedMiddleware, this.dir, this.pagesDir).message);
                    nestedMiddleware = [];
                }
                this.appPathRoutes = appPaths;
                this.middleware = [];
                this.edgeFunctions = [];
                (0, _utils2).getSortedRoutes(routedMiddleware).forEach((page)=>{
                    const isRootMiddleware = page === "/" && !!middlewareMatcher;
                    const middlewareRegex = isRootMiddleware ? {
                        re: middlewareMatcher,
                        groups: {}
                    } : (0, _routeRegex).getMiddlewareRegex(page, {
                        catchAll: !ssrMiddleware.has(page)
                    });
                    const routeItem = {
                        match: (0, _routeMatcher).getRouteMatcher(middlewareRegex),
                        page,
                        re: middlewareRegex.re,
                        ssr: !isRootMiddleware
                    };
                    this.middleware.push(routeItem);
                    if (!isRootMiddleware) {
                        this.edgeFunctions.push(routeItem);
                    }
                });
                try {
                    var ref3;
                    // we serve a separate manifest with all pages for the client in
                    // dev mode so that we can match a page after a rewrite on the client
                    // before it has been built and is populated in the _buildManifest
                    const sortedRoutes = (0, _utils2).getSortedRoutes(routedPages);
                    if (!((ref3 = this.sortedRoutes) == null ? void 0 : ref3.every((val, idx)=>val === sortedRoutes[idx]))) {
                        // emit the change so clients fetch the update
                        this.hotReloader.send(undefined, {
                            devPagesManifest: true
                        });
                    }
                    this.sortedRoutes = sortedRoutes;
                    this.dynamicRoutes = this.sortedRoutes.filter(_utils2.isDynamicRoute).map((page)=>({
                            page,
                            match: (0, _routeMatcher).getRouteMatcher((0, _routeRegex).getRouteRegex(page))
                        }));
                    this.router.setDynamicRoutes(this.dynamicRoutes);
                    this.router.setCatchallMiddleware(this.generateCatchAllMiddlewareRoute(true));
                    if (!resolved) {
                        resolve();
                        resolved = true;
                    }
                } catch (e) {
                    if (!resolved) {
                        reject(e);
                        resolved = true;
                    } else {
                        console.warn("Failed to reload dynamic routes:", e);
                    }
                }
            });
        });
    }
    async stopWatcher() {
        if (!this.webpackWatcher) {
            return;
        }
        this.webpackWatcher.close();
        this.webpackWatcher = null;
    }
    async prepare() {
        (0, _trace).setGlobal("distDir", this.distDir);
        (0, _trace).setGlobal("phase", _constants1.PHASE_DEVELOPMENT_SERVER);
        await (0, _verifyTypeScriptSetup).verifyTypeScriptSetup(this.dir, [
            this.pagesDir,
            this.appDir
        ].filter(Boolean), false, this.nextConfig.typescript.tsconfigPath, this.nextConfig.images.disableStaticImages);
        this.customRoutes = await (0, _loadCustomRoutes).default(this.nextConfig);
        // reload router
        const { redirects , rewrites , headers  } = this.customRoutes;
        if (rewrites.beforeFiles.length || rewrites.afterFiles.length || rewrites.fallback.length || redirects.length || headers.length) {
            this.router = new _router.default(this.generateRoutes());
        }
        this.hotReloader = new _hotReloader.default(this.dir, {
            pagesDir: this.pagesDir,
            distDir: this.distDir,
            config: this.nextConfig,
            previewProps: this.getPreviewProps(),
            buildId: this.buildId,
            rewrites,
            appDir: this.appDir
        });
        await super.prepare();
        await this.addExportPathMapRoutes();
        await this.hotReloader.start();
        await this.startWatcher();
        this.setDevReady();
        if (this.nextConfig.experimental.nextScriptWorkers) {
            await (0, _verifyPartytownSetup).verifyPartytownSetup(this.dir, (0, _path).join(this.distDir, _constants1.CLIENT_STATIC_FILES_PATH));
        }
        const telemetry = new _storage.Telemetry({
            distDir: this.distDir
        });
        telemetry.record((0, _events).eventCliSession(this.distDir, this.nextConfig, {
            webpackVersion: 5,
            cliCommand: "dev",
            isSrcDir: (0, _path).relative(this.dir, this.pagesDir).startsWith("src"),
            hasNowJson: !!await (0, _findUp).default("now.json", {
                cwd: this.dir
            }),
            isCustomServer: this.isCustomServer
        }));
        // This is required by the tracing subsystem.
        (0, _trace).setGlobal("telemetry", telemetry);
        process.on("unhandledRejection", (reason)=>{
            this.logErrorWithOriginalStack(reason, "unhandledRejection").catch(()=>{});
        });
        process.on("uncaughtException", (err)=>{
            this.logErrorWithOriginalStack(err, "uncaughtException").catch(()=>{});
        });
    }
    async close() {
        await this.stopWatcher();
        await this.getStaticPathsWorker().end();
        if (this.hotReloader) {
            await this.hotReloader.stop();
        }
    }
    async hasPage(pathname) {
        let normalizedPath;
        try {
            normalizedPath = (0, _normalizePagePath).normalizePagePath(pathname);
        } catch (err) {
            console.error(err);
            // if normalizing the page fails it means it isn't valid
            // so it doesn't exist so don't throw and return false
            // to ensure we return 404 instead of 500
            return false;
        }
        if ((0, _utils3).isMiddlewareFile(normalizedPath)) {
            return (0, _findPageFile).findPageFile(this.dir, normalizedPath, this.nextConfig.pageExtensions).then(Boolean);
        }
        // check appDir first if enabled
        if (this.appDir) {
            const pageFile = await (0, _findPageFile).findPageFile(this.appDir, normalizedPath, this.nextConfig.pageExtensions);
            if (pageFile) return true;
        }
        const pageFile = await (0, _findPageFile).findPageFile(this.pagesDir, normalizedPath, this.nextConfig.pageExtensions);
        return !!pageFile;
    }
    async _beforeCatchAllRender(req, res, params, parsedUrl) {
        const { pathname  } = parsedUrl;
        const pathParts = params.path || [];
        const path = `/${pathParts.join("/")}`;
        // check for a public file, throwing error if there's a
        // conflicting page
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(path);
        } catch (_) {
            throw new _utils1.DecodeError("failed to decode param");
        }
        if (await this.hasPublicFile(decodedPath)) {
            if (await this.hasPage(pathname)) {
                const err = new Error(`A conflicting public file and page file was found for path ${pathname} https://nextjs.org/docs/messages/conflicting-public-file-page`);
                res.statusCode = 500;
                await this.renderError(err, req, res, pathname, {});
                return true;
            }
            await this.servePublic(req, res, pathParts);
            return true;
        }
        return false;
    }
    setupWebSocketHandler(server, _req) {
        if (!this.addedUpgradeListener) {
            var ref5;
            this.addedUpgradeListener = true;
            server = server || ((ref5 = _req == null ? void 0 : _req.originalRequest.socket) == null ? void 0 : ref5.server);
            if (!server) {
                // this is very unlikely to happen but show an error in case
                // it does somehow
                Log.error(`Invalid IncomingMessage received, make sure http.createServer is being used to handle requests.`);
            } else {
                const { basePath  } = this.nextConfig;
                server.on("upgrade", (req, socket, head)=>{
                    var ref;
                    let assetPrefix = (this.nextConfig.assetPrefix || "").replace(/^\/+/, "");
                    // assetPrefix can be a proxy server with a url locally
                    // if so, it's needed to send these HMR requests with a rewritten url directly to /_next/webpack-hmr
                    // otherwise account for a path-like prefix when listening to socket events
                    if (assetPrefix.startsWith("http")) {
                        assetPrefix = "";
                    } else if (assetPrefix) {
                        assetPrefix = `/${assetPrefix}`;
                    }
                    if ((ref = req.url) == null ? void 0 : ref.startsWith(`${basePath || assetPrefix || ""}/_next/webpack-hmr`)) {
                        var ref4;
                        (ref4 = this.hotReloader) == null ? void 0 : ref4.onHMR(req, socket, head);
                    }
                });
            }
        }
    }
    async runMiddleware(params) {
        try {
            const result = await super.runMiddleware({
                ...params,
                onWarning: (warn)=>{
                    this.logErrorWithOriginalStack(warn, "warning");
                }
            });
            if ("finished" in result) {
                return result;
            }
            result.waitUntil.catch((error)=>{
                this.logErrorWithOriginalStack(error, "unhandledRejection");
            });
            return result;
        } catch (error) {
            if (error instanceof _utils1.DecodeError) {
                throw error;
            }
            /**
       * We only log the error when it is not a MiddlewareNotFound error as
       * in that case we should be already displaying a compilation error
       * which is what makes the module not found.
       */ if (!(error instanceof _utils1.MiddlewareNotFoundError)) {
                this.logErrorWithOriginalStack(error);
            }
            const err = (0, _isError).getProperError(error);
            err.middleware = true;
            const { request , response , parsedUrl  } = params;
            /**
       * When there is a failure for an internal Next.js request from
       * middleware we bypass the error without finishing the request
       * so we can serve the required chunks to render the error.
       */ if (request.url.includes("/_next/static") || request.url.includes("/__nextjs_original-stack-frame")) {
                return {
                    finished: false
                };
            }
            response.statusCode = 500;
            this.renderError(err, request, response, parsedUrl.pathname);
            return {
                finished: true
            };
        }
    }
    async runEdgeFunction(params) {
        try {
            return super.runEdgeFunction(params);
        } catch (error) {
            if (error instanceof _utils1.DecodeError) {
                throw error;
            }
            this.logErrorWithOriginalStack(error, "warning");
            const err = (0, _isError).getProperError(error);
            const { req , res , page  } = params;
            res.statusCode = 500;
            this.renderError(err, req, res, page);
            return null;
        }
    }
    async run(req, res, parsedUrl) {
        await this.devReady;
        this.setupWebSocketHandler(undefined, req);
        const { basePath  } = this.nextConfig;
        let originalPathname = null;
        if (basePath && (0, _pathHasPrefix).pathHasPrefix(parsedUrl.pathname || "/", basePath)) {
            // strip basePath before handling dev bundles
            // If replace ends up replacing the full url it'll be `undefined`, meaning we have to default it to `/`
            originalPathname = parsedUrl.pathname;
            parsedUrl.pathname = (0, _removePathPrefix).removePathPrefix(parsedUrl.pathname || "/", basePath);
        }
        const { pathname  } = parsedUrl;
        if (pathname.startsWith("/_next")) {
            if (await (0, _fileExists).fileExists((0, _path).join(this.publicDir, "_next"))) {
                throw new Error(_constants.PUBLIC_DIR_MIDDLEWARE_CONFLICT);
            }
        }
        const { finished =false  } = await this.hotReloader.run(req.originalRequest, res.originalResponse, parsedUrl);
        if (finished) {
            return;
        }
        if (originalPathname) {
            // restore the path before continuing so that custom-routes can accurately determine
            // if they should match against the basePath or not
            parsedUrl.pathname = originalPathname;
        }
        try {
            return await super.run(req, res, parsedUrl);
        } catch (error) {
            res.statusCode = 500;
            const err = (0, _isError).getProperError(error);
            try {
                this.logErrorWithOriginalStack(err).catch(()=>{});
                return await this.renderError(err, req, res, pathname, {
                    __NEXT_PAGE: (0, _isError).default(err) && err.page || pathname || ""
                });
            } catch (internalErr) {
                console.error(internalErr);
                res.body("Internal Server Error").send();
            }
        }
    }
    async logErrorWithOriginalStack(err, type) {
        let usedOriginalStack = false;
        if ((0, _isError).default(err) && err.stack) {
            try {
                const frames = (0, _middleware).parseStack(err.stack);
                const frame = frames.find(({ file  })=>{
                    return !(file == null ? void 0 : file.startsWith("eval"));
                });
                if (frame.lineNumber && (frame == null ? void 0 : frame.file)) {
                    var ref, ref7;
                    const moduleId = frame.file.replace(/^(webpack-internal:\/\/\/|file:\/\/)/, "");
                    let compilation;
                    const src = (0, _middleware).getErrorSource(err);
                    if (src === "edge-server") {
                        var ref8, ref9;
                        compilation = (ref8 = this.hotReloader) == null ? void 0 : (ref9 = ref8.edgeServerStats) == null ? void 0 : ref9.compilation;
                    } else {
                        var ref10, ref11;
                        compilation = (ref10 = this.hotReloader) == null ? void 0 : (ref11 = ref10.serverStats) == null ? void 0 : ref11.compilation;
                    }
                    const source = await (0, _middleware).getSourceById(!!((ref = frame.file) == null ? void 0 : ref.startsWith(_path.sep)) || !!((ref7 = frame.file) == null ? void 0 : ref7.startsWith("file:")), moduleId, compilation);
                    const originalFrame = await (0, _middleware).createOriginalStackFrame({
                        line: frame.lineNumber,
                        column: frame.column,
                        source,
                        frame,
                        modulePath: moduleId,
                        rootDirectory: this.dir
                    });
                    if (originalFrame) {
                        const { originalCodeFrame , originalStackFrame  } = originalFrame;
                        const { file , lineNumber , column , methodName  } = originalStackFrame;
                        console.error((type === "warning" ? _chalk.default.yellow("warn") : _chalk.default.red("error")) + " - " + `${file} (${lineNumber}:${column}) @ ${methodName}`);
                        console.error(`${(type === "warning" ? _chalk.default.yellow : _chalk.default.red)(err.name)}: ${err.message}`);
                        console.error(originalCodeFrame);
                        usedOriginalStack = true;
                    }
                }
            } catch (_) {
            // failed to load original stack using source maps
            // this un-actionable by users so we don't show the
            // internal error and only show the provided stack
            }
        }
        if (!usedOriginalStack) {
            if (type === "warning") {
                Log.warn(err);
            } else if (type) {
                Log.error(`${type}:`, err);
            } else {
                Log.error(err);
            }
        }
    }
    // override production loading of routes-manifest
    getCustomRoutes() {
        // actual routes will be loaded asynchronously during .prepare()
        return {
            redirects: [],
            rewrites: {
                beforeFiles: [],
                afterFiles: [],
                fallback: []
            },
            headers: []
        };
    }
    getPreviewProps() {
        if (this._devCachedPreviewProps) {
            return this._devCachedPreviewProps;
        }
        return this._devCachedPreviewProps = {
            previewModeId: _crypto.default.randomBytes(16).toString("hex"),
            previewModeSigningKey: _crypto.default.randomBytes(32).toString("hex"),
            previewModeEncryptionKey: _crypto.default.randomBytes(32).toString("hex")
        };
    }
    getPagesManifest() {
        return undefined;
    }
    getAppPathsManifest() {
        return undefined;
    }
    getMiddleware() {
        var _middleware1;
        return (_middleware1 = this.middleware) != null ? _middleware1 : [];
    }
    getEdgeFunctions() {
        var _edgeFunctions;
        return (_edgeFunctions = this.edgeFunctions) != null ? _edgeFunctions : [];
    }
    getServerComponentManifest() {
        return undefined;
    }
    async hasMiddleware(pathname, isSSR) {
        return this.hasPage(isSSR ? pathname : this.actualMiddlewareFile);
    }
    async ensureMiddleware(pathname, isSSR) {
        return this.hotReloader.ensurePage(isSSR ? pathname : this.actualMiddlewareFile);
    }
    generateRoutes() {
        const { fsRoutes , ...otherRoutes } = super.generateRoutes();
        // In development we expose all compiled files for react-error-overlay's line show feature
        // We use unshift so that we're sure the routes is defined before Next's default routes
        fsRoutes.unshift({
            match: (0, _pathMatch).getPathMatch("/_next/development/:path*"),
            type: "route",
            name: "_next/development catchall",
            fn: async (req, res, params)=>{
                const p = (0, _path).join(this.distDir, ...params.path || []);
                await this.serveStatic(req, res, p);
                return {
                    finished: true
                };
            }
        });
        fsRoutes.unshift({
            match: (0, _pathMatch).getPathMatch(`/_next/${_constants1.CLIENT_STATIC_FILES_PATH}/${this.buildId}/${_constants1.DEV_CLIENT_PAGES_MANIFEST}`),
            type: "route",
            name: `_next/${_constants1.CLIENT_STATIC_FILES_PATH}/${this.buildId}/${_constants1.DEV_CLIENT_PAGES_MANIFEST}`,
            fn: async (_req, res)=>{
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.body(JSON.stringify({
                    pages: this.sortedRoutes
                })).send();
                return {
                    finished: true
                };
            }
        });
        fsRoutes.unshift({
            match: (0, _pathMatch).getPathMatch(`/_next/${_constants1.CLIENT_STATIC_FILES_PATH}/${this.buildId}/${_constants1.DEV_MIDDLEWARE_MANIFEST}`),
            type: "route",
            name: `_next/${_constants1.CLIENT_STATIC_FILES_PATH}/${this.buildId}/${_constants1.DEV_MIDDLEWARE_MANIFEST}`,
            fn: async (_req, res)=>{
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.body(JSON.stringify(this.getMiddleware().map((middleware)=>[
                        middleware.re.source,
                        !!middleware.ssr, 
                    ]))).send();
                return {
                    finished: true
                };
            }
        });
        fsRoutes.push({
            match: (0, _pathMatch).getPathMatch("/:path*"),
            type: "route",
            name: "catchall public directory route",
            fn: async (req, res, params, parsedUrl)=>{
                const { pathname  } = parsedUrl;
                if (!pathname) {
                    throw new Error("pathname is undefined");
                }
                // Used in development to check public directory paths
                if (await this._beforeCatchAllRender(req, res, params, parsedUrl)) {
                    return {
                        finished: true
                    };
                }
                return {
                    finished: false
                };
            }
        });
        return {
            fsRoutes,
            ...otherRoutes
        };
    }
    // In development public files are not added to the router but handled as a fallback instead
    generatePublicRoutes() {
        return [];
    }
    // In development dynamic routes cannot be known ahead of time
    getDynamicRoutes() {
        return [];
    }
    _filterAmpDevelopmentScript(html, event) {
        if (event.code !== "DISALLOWED_SCRIPT_TAG") {
            return true;
        }
        const snippetChunks = html.split("\n");
        let snippet;
        if (!(snippet = html.split("\n")[event.line - 1]) || !(snippet = snippet.substring(event.col))) {
            return true;
        }
        snippet = snippet + snippetChunks.slice(event.line).join("\n");
        snippet = snippet.substring(0, snippet.indexOf("</script>"));
        return !snippet.includes("data-amp-development-mode-only");
    }
    async getStaticPaths(pathname) {
        // we lazy load the staticPaths to prevent the user
        // from waiting on them for the page to load in dev mode
        const __getStaticPaths = async ()=>{
            const { configFileName , publicRuntimeConfig , serverRuntimeConfig , httpAgentOptions ,  } = this.nextConfig;
            const { locales , defaultLocale  } = this.nextConfig.i18n || {};
            const paths = await this.getStaticPathsWorker().loadStaticPaths(this.distDir, pathname, !this.renderOpts.dev && this._isLikeServerless, {
                configFileName,
                publicRuntimeConfig,
                serverRuntimeConfig
            }, httpAgentOptions, locales, defaultLocale);
            return paths;
        };
        const { paths: staticPaths , fallback  } = (await (0, _coalescedFunction).withCoalescedInvoke(__getStaticPaths)(`staticPaths-${pathname}`, [])).value;
        return {
            staticPaths,
            fallbackMode: fallback === "blocking" ? "blocking" : fallback === true ? "static" : false
        };
    }
    async ensureApiPage(pathname) {
        return this.hotReloader.ensurePage(pathname);
    }
    async findPageComponents(pathname, query = {}, params = null) {
        await this.devReady;
        const compilationErr = await this.getCompilationError(pathname);
        if (compilationErr) {
            // Wrap build errors so that they don't get logged again
            throw new _nextServer.WrappedBuildError(compilationErr);
        }
        try {
            await this.hotReloader.ensurePage(pathname);
            const serverComponents = this.nextConfig.experimental.serverComponents;
            // When the new page is compiled, we need to reload the server component
            // manifest.
            if (serverComponents) {
                this.serverComponentManifest = super.getServerComponentManifest();
            }
            return super.findPageComponents(pathname, query, params);
        } catch (err) {
            if (err.code !== "ENOENT") {
                throw err;
            }
            return null;
        }
    }
    async getFallbackErrorComponents() {
        await this.hotReloader.buildFallbackError();
        // Build the error page to ensure the fallback is built too.
        // TODO: See if this can be moved into hotReloader or removed.
        await this.hotReloader.ensurePage("/_error");
        return await (0, _loadComponents).loadDefaultErrorComponents(this.distDir);
    }
    setImmutableAssetCacheControl(res) {
        res.setHeader("Cache-Control", "no-store, must-revalidate");
    }
    servePublic(req, res, pathParts) {
        const p = (0, _path).join(this.publicDir, ...pathParts);
        return this.serveStatic(req, res, p);
    }
    async hasPublicFile(path) {
        try {
            const info = await _fs.default.promises.stat((0, _path).join(this.publicDir, path));
            return info.isFile();
        } catch (_) {
            return false;
        }
    }
    async getCompilationError(page) {
        const errors = await this.hotReloader.getCompilationErrors(page);
        if (errors.length === 0) return;
        // Return the very first error we found.
        return errors[0];
    }
    isServeableUrl(untrustedFileUrl) {
        // This method mimics what the version of `send` we use does:
        // 1. decodeURIComponent:
        //    https://github.com/pillarjs/send/blob/0.17.1/index.js#L989
        //    https://github.com/pillarjs/send/blob/0.17.1/index.js#L518-L522
        // 2. resolve:
        //    https://github.com/pillarjs/send/blob/de073ed3237ade9ff71c61673a34474b30e5d45b/index.js#L561
        let decodedUntrustedFilePath;
        try {
            // (1) Decode the URL so we have the proper file name
            decodedUntrustedFilePath = decodeURIComponent(untrustedFileUrl);
        } catch  {
            return false;
        }
        // (2) Resolve "up paths" to determine real request
        const untrustedFilePath = (0, _path).resolve(decodedUntrustedFilePath);
        // don't allow null bytes anywhere in the file path
        if (untrustedFilePath.indexOf("\0") !== -1) {
            return false;
        }
        // During development mode, files can be added while the server is running.
        // Checks for .next/static, .next/server, static and public.
        // Note that in development .next/server is available for error reporting purposes.
        // see `packages/next/server/next-server.ts` for more details.
        if (untrustedFilePath.startsWith((0, _path).join(this.distDir, "static") + _path.sep) || untrustedFilePath.startsWith((0, _path).join(this.distDir, "server") + _path.sep) || untrustedFilePath.startsWith((0, _path).join(this.dir, "static") + _path.sep) || untrustedFilePath.startsWith((0, _path).join(this.dir, "public") + _path.sep)) {
            return true;
        }
        return false;
    }
}
exports.default = DevServer;
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _getRequireWildcardCache() {
    if (typeof WeakMap !== "function") return null;
    var cache = new WeakMap();
    _getRequireWildcardCache = function() {
        return cache;
    };
    return cache;
}
function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache();
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
// Load ReactDevOverlay only when needed
let ReactDevOverlayImpl;
const ReactDevOverlay = (props)=>{
    if (ReactDevOverlayImpl === undefined) {
        ReactDevOverlayImpl = require("next/dist/compiled/@next/react-dev-overlay/dist/client").ReactDevOverlay;
    }
    return ReactDevOverlayImpl(props);
};

//# sourceMappingURL=next-dev-server.js.map