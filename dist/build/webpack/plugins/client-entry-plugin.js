"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.injectedClientEntries = void 0;
var _querystring = require("querystring");
var _webpack = require("next/dist/compiled/webpack/webpack");
var _constants = require("../../../shared/lib/constants");
var _utils = require("../loaders/utils");
var _normalizePagePath = require("../../../shared/lib/page-path/normalize-page-path");
var _denormalizePagePath = require("../../../shared/lib/page-path/denormalize-page-path");
var _onDemandEntryHandler = require("../../../server/dev/on-demand-entry-handler");
var _getPageStaticInfo = require("../../analysis/get-page-static-info");
var _constants1 = require("../../../lib/constants");
const PLUGIN_NAME = "ClientEntryPlugin";
const injectedClientEntries = new Map();
exports.injectedClientEntries = injectedClientEntries;
class ClientEntryPlugin {
    dev = false;
    constructor(options){
        if (typeof options.dev === "boolean") {
            this.dev = options.dev;
        }
        this.isEdgeServer = options.isEdgeServer;
    }
    apply(compiler) {
        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation, { normalModuleFactory  })=>{
            compilation.dependencyFactories.set(_webpack.webpack.dependencies.ModuleDependency, normalModuleFactory);
            compilation.dependencyTemplates.set(_webpack.webpack.dependencies.ModuleDependency, new _webpack.webpack.dependencies.NullDependency.Template());
        });
        // Only for webpack 5
        compiler.hooks.finishMake.tapAsync(PLUGIN_NAME, async (compilation, callback)=>{
            this.createClientEndpoints(compilation, callback);
        });
    }
    async createClientEndpoints(compilation, callback) {
        const context = this.context;
        const promises = [];
        // For each SC server compilation entry, we need to create its corresponding
        // client component entry.
        for (const [name, entry] of compilation.entries.entries()){
            var ref, ref1;
            // Check if the page entry is a server component or not.
            const entryDependency = (ref = entry.dependencies) == null ? void 0 : ref[0];
            const request = entryDependency == null ? void 0 : entryDependency.request;
            if (request && ((ref1 = entry.options) == null ? void 0 : ref1.layer) === "sc_server") {
                const visited = new Set();
                const clientComponentImports = [];
                function filterClientComponents(dependency) {
                    const module = compilation.moduleGraph.getResolvedModule(dependency);
                    if (!module) return;
                    if (visited.has(module.userRequest)) return;
                    visited.add(module.userRequest);
                    if (_utils.clientComponentRegex.test(module.userRequest)) {
                        clientComponentImports.push(module.userRequest);
                    }
                    compilation.moduleGraph.getOutgoingConnections(module).forEach((connection)=>{
                        filterClientComponents(connection.dependency);
                    });
                }
                // Traverse the module graph to find all client components.
                filterClientComponents(entryDependency);
                const entryModule = compilation.moduleGraph.getResolvedModule(entryDependency);
                const routeInfo = entryModule.buildInfo.route || {
                    page: (0, _denormalizePagePath).denormalizePagePath(name.replace(/^pages/, "")),
                    absolutePagePath: entryModule.resource
                };
                // Parse gSSP and gSP exports from the page source.
                const pageStaticInfo = this.isEdgeServer ? {} : await (0, _getPageStaticInfo).getPageStaticInfo({
                    pageFilePath: routeInfo.absolutePagePath,
                    nextConfig: {},
                    isDev: this.dev
                });
                const clientLoader = `next-flight-client-entry-loader?${(0, _querystring).stringify({
                    modules: clientComponentImports,
                    runtime: this.isEdgeServer ? _constants1.SERVER_RUNTIME.edge : _constants1.SERVER_RUNTIME.nodejs,
                    ssr: pageStaticInfo.ssr,
                    // Adding name here to make the entry key unique.
                    name
                })}!`;
                const bundlePath = "pages" + (0, _normalizePagePath).normalizePagePath(routeInfo.page);
                // Inject the entry to the client compiler.
                if (this.dev) {
                    const pageKey = "client" + routeInfo.page;
                    if (!_onDemandEntryHandler.entries[pageKey]) {
                        _onDemandEntryHandler.entries[pageKey] = {
                            bundlePath,
                            absolutePagePath: routeInfo.absolutePagePath,
                            clientLoader,
                            dispose: false,
                            lastActiveTime: Date.now()
                        };
                        const invalidator = (0, _onDemandEntryHandler).getInvalidator();
                        if (invalidator) {
                            invalidator.invalidate();
                        }
                    }
                } else {
                    injectedClientEntries.set(bundlePath, `next-client-pages-loader?${(0, _querystring).stringify({
                        isServerComponent: true,
                        page: (0, _denormalizePagePath).denormalizePagePath(bundlePath.replace(/^pages/, "")),
                        absolutePagePath: clientLoader
                    })}!` + clientLoader);
                }
                // Inject the entry to the server compiler.
                const clientComponentEntryDep = _webpack.webpack.EntryPlugin.createDependency(clientLoader, name + _constants.NEXT_CLIENT_SSR_ENTRY_SUFFIX);
                promises.push(new Promise((res, rej)=>{
                    compilation.addEntry(context, clientComponentEntryDep, this.isEdgeServer ? {
                        name: name + _constants.NEXT_CLIENT_SSR_ENTRY_SUFFIX,
                        library: {
                            name: [
                                "self._CLIENT_ENTRY"
                            ],
                            type: "assign"
                        },
                        runtime: _constants.EDGE_RUNTIME_WEBPACK,
                        asyncChunks: false
                    } : {
                        name: name + _constants.NEXT_CLIENT_SSR_ENTRY_SUFFIX,
                        runtime: "webpack-runtime"
                    }, (err)=>{
                        if (err) {
                            rej(err);
                        } else {
                            res();
                        }
                    });
                }));
            }
        }
        Promise.all(promises).then(()=>callback()).catch(callback);
    }
}
exports.ClientEntryPlugin = ClientEntryPlugin;

//# sourceMappingURL=client-entry-plugin.js.map