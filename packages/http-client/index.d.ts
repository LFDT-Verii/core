export interface HttpClientContext {
  traceId?: string;
  log?: {
    info?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
  };
}

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  searchParams?: URLSearchParams;
}

export interface HttpResponse<T = unknown> {
  rawBody: unknown;
  statusCode: number;
  resHeaders: Record<string, string | string[] | undefined>;
  json(): Promise<T>;
  text(): Promise<string>;
}

export interface HttpClient {
  get<T = unknown>(
    url: string,
    reqOptions?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;
  post<TBody = unknown, TResponse = unknown>(
    url: string,
    payload?: TBody,
    reqOptions?: HttpRequestOptions,
  ): Promise<HttpResponse<TResponse>>;
  delete<T = unknown>(
    url: string,
    reqOptions?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;
  responseType: 'promise';
}

export interface HttpClientInitOptions {
  prefixUrl?: string;
  isTest?: boolean;
  bearerToken?: string;
  requestTimeout?: number;
  traceIdHeader?: string;
  customHeaders?: Record<string, string>;
  cache?: unknown;
  tokensEndpoint?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
  audience?: string;
  tlsRejectUnauthorized?: boolean;
  caCertificate?: string;
  clientCertificate?: string;
  clientKey?: string;
  clientCertificatePassword?: string;
}

export function initHttpClient(options: HttpClientInitOptions): {
  (context: HttpClientContext): HttpClient;
  (host: string, context: HttpClientContext): HttpClient;
};

export function initCache(): unknown;
