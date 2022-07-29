/// <reference types="node" />
import type { IncomingMessage } from 'http';
import { Readable } from 'stream';
declare type BodyStream = ReadableStream<Uint8Array>;
/**
 * Creates a ReadableStream from a Node.js HTTP request
 */
export declare function requestToBodyStream(request: IncomingMessage): BodyStream;
export declare function bodyStreamToNodeStream(bodyStream: BodyStream): Readable;
/**
 * An interface that encapsulates body stream cloning
 * of an incoming request.
 */
export declare function clonableBodyForRequest<T extends IncomingMessage>(incomingMessage: T): {
    /**
     * Replaces the original request body if necessary.
     * This is done because once we read the body from the original request,
     * we can't read it again.
     */
    finalize(): Promise<void>;
    /**
     * Clones the body stream
     * to pass into a middleware
     */
    cloneBodyStream(): BodyStream;
};
export {};
