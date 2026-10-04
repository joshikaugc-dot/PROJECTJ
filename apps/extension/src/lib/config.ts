declare const __CONTEXTOS_API_URL__: string;

/** The ContextOS API this build talks to (set at build time via CONTEXTOS_API_URL). */
export const API_URL: string = __CONTEXTOS_API_URL__;
export const API_ORIGIN = new URL(API_URL).origin;
