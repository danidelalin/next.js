/// <reference types="node" />
import RenderResult from './render-result';
export interface CachedRedirectValue {
    kind: 'REDIRECT';
    props: Object;
}
interface CachedPageValue {
    kind: 'PAGE';
    html: RenderResult;
    pageData: Object;
}
export interface CachedImageValue {
    kind: 'IMAGE';
    etag: string;
    buffer: Buffer;
    extension: string;
    isMiss?: boolean;
    isStale?: boolean;
}
interface IncrementalCachedPageValue {
    kind: 'PAGE';
    html: string;
    pageData: Object;
}
export declare type IncrementalCacheEntry = {
    curRevalidate?: number | false;
    revalidateAfter: number | false;
    isStale?: boolean;
    value: IncrementalCacheValue | null;
};
export declare type IncrementalCacheValue = CachedRedirectValue | IncrementalCachedPageValue | CachedImageValue;
export declare type ResponseCacheValue = CachedRedirectValue | CachedPageValue | CachedImageValue;
export declare type ResponseCacheEntry = {
    revalidate?: number | false;
    value: ResponseCacheValue | null;
    isStale?: boolean;
    isMiss?: boolean;
};
declare type ResponseGenerator = (hasResolved: boolean, hadCache: boolean) => Promise<ResponseCacheEntry | null>;
declare type IncrementalCacheItem = {
    revalidateAfter?: number | false;
    curRevalidate?: number | false;
    revalidate?: number | false;
    value: IncrementalCacheValue | null;
    isStale?: boolean;
    isMiss?: boolean;
} | null;
interface IncrementalCache {
    get: (key: string) => Promise<IncrementalCacheItem>;
    set: (key: string, data: IncrementalCacheValue | null, revalidate?: number | false) => Promise<void>;
}
export default class ResponseCache {
    incrementalCache: IncrementalCache;
    pendingResponses: Map<string, Promise<ResponseCacheEntry | null>>;
    previousCacheItem?: {
        key: string;
        entry: ResponseCacheEntry | null;
        expiresAt: number;
    };
    minimalMode?: boolean;
    constructor(incrementalCache: IncrementalCache, minimalMode: boolean);
    get(key: string | null, responseGenerator: ResponseGenerator, context: {
        isManualRevalidate?: boolean;
        isPrefetch?: boolean;
    }): Promise<ResponseCacheEntry | null>;
}
export {};
