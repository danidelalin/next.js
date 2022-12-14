import type { WasmBinding } from '../loaders/get-module-build-info';
import { webpack5 } from 'next/dist/compiled/webpack/webpack';
interface EdgeFunctionDefinition {
    env: string[];
    files: string[];
    name: string;
    page: string;
    regexp: string;
    wasm?: WasmBinding[];
}
export interface MiddlewareManifest {
    version: 1;
    sortedMiddleware: string[];
    middleware: {
        [page: string]: EdgeFunctionDefinition;
    };
    functions: {
        [page: string]: EdgeFunctionDefinition;
    };
}
export default class MiddlewarePlugin {
    dev: boolean;
    constructor({ dev }: {
        dev: boolean;
    });
    apply(compiler: webpack5.Compiler): void;
}
export {};
