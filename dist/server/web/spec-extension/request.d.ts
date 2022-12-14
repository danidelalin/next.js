import type { I18NConfig } from '../../config-shared';
import type { RequestData } from '../types';
import { NextURL } from '../next-url';
import { NextCookies } from './cookies';
export declare const INTERNALS: unique symbol;
export declare class NextRequest extends Request {
    [INTERNALS]: {
        cookies: NextCookies;
        geo: RequestData['geo'];
        ip?: string;
        url: NextURL;
    };
    constructor(input: Request | string, init?: RequestInit);
    get cookies(): NextCookies;
    get geo(): {
        city?: string | undefined;
        country?: string | undefined;
        region?: string | undefined;
        latitude?: string | undefined;
        longitude?: string | undefined;
    } | undefined;
    get ip(): string | undefined;
    get nextUrl(): NextURL;
    get page(): void;
    get ua(): void;
    get url(): string;
}
export interface RequestInit extends globalThis.RequestInit {
    geo?: {
        city?: string;
        country?: string;
        region?: string;
    };
    ip?: string;
    nextConfig?: {
        basePath?: string;
        i18n?: I18NConfig | null;
        trailingSlash?: boolean;
    };
}
