"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
var _sandbox = require("../../../server/web/sandbox");
var _fs = require("fs");
var _path = _interopRequireDefault(require("path"));
var _isError = _interopRequireDefault(require("../../../lib/is-error"));
var _constants = require("../../../shared/lib/constants");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const originModules = [
    require.resolve("../../../server/require"),
    require.resolve("../../../server/load-components"), 
];
const RUNTIME_NAMES = [
    "webpack-runtime",
    "webpack-api-runtime"
];
function deleteCache(filePath) {
    try {
        filePath = (0, _fs).realpathSync(filePath);
    } catch (e) {
        if ((0, _isError).default(e) && e.code !== "ENOENT") throw e;
    }
    const module = require.cache[filePath];
    if (module) {
        // remove the child reference from the originModules
        for (const originModule of originModules){
            const parent = require.cache[originModule];
            if (parent) {
                const idx = parent.children.indexOf(module);
                if (idx >= 0) parent.children.splice(idx, 1);
            }
        }
        // remove parent references from external modules
        for (const child of module.children){
            child.parent = null;
        }
        delete require.cache[filePath];
        return true;
    }
    return false;
}
const PLUGIN_NAME = "NextJsRequireCacheHotReloader";
class NextJsRequireCacheHotReloader {
    prevAssets = null;
    previousOutputPathsWebpack5 = new Set();
    currentOutputPathsWebpack5 = new Set();
    constructor(opts){
        this.hasServerComponents = opts.hasServerComponents;
    }
    apply(compiler) {
        compiler.hooks.assetEmitted.tap(PLUGIN_NAME, (file, { targetPath , content  })=>{
            this.currentOutputPathsWebpack5.add(targetPath);
            deleteCache(targetPath);
            (0, _sandbox).clearModuleContext(targetPath, content.toString("utf-8"));
            if (this.hasServerComponents && /^(app|pages)\//.test(file) && /\.js$/.test(targetPath)) {
                // Also clear the potential __sc_client__ cache.
                // @TODO: Investigate why the client ssr bundle isn't emitted as an asset here.
                const clientComponentsSSRTarget = targetPath.replace(/\.js$/, _constants.NEXT_CLIENT_SSR_ENTRY_SUFFIX + ".js");
                if (deleteCache(clientComponentsSSRTarget)) {
                    this.currentOutputPathsWebpack5.add(clientComponentsSSRTarget);
                    (0, _sandbox).clearModuleContext(clientComponentsSSRTarget, content.toString("utf-8"));
                }
            }
        });
        compiler.hooks.afterEmit.tap(PLUGIN_NAME, (compilation)=>{
            RUNTIME_NAMES.forEach((name)=>{
                const runtimeChunkPath = _path.default.join(compilation.outputOptions.path, `${name}.js`);
                deleteCache(runtimeChunkPath);
            });
            // we need to make sure to clear all server entries from cache
            // since they can have a stale webpack-runtime cache
            // which needs to always be in-sync
            const entries = [
                ...compilation.entries.keys()
            ].filter((entry)=>entry.toString().startsWith("pages/"));
            entries.forEach((page)=>{
                const outputPath = _path.default.join(compilation.outputOptions.path, page + ".js");
                deleteCache(outputPath);
            });
        });
        this.previousOutputPathsWebpack5 = new Set(this.currentOutputPathsWebpack5);
        this.currentOutputPathsWebpack5.clear();
    }
}
exports.NextJsRequireCacheHotReloader = NextJsRequireCacheHotReloader;

//# sourceMappingURL=nextjs-require-cache-hot-reloader.js.map