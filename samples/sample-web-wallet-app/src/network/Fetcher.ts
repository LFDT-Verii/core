/**
 * Created by Michael Avoyan on 24/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { initHttpClient } from '@verii/http-client';

interface FetcherConfig<T> {
  headers?: Record<string, string>;
  method: string;
  url: string;
  data?: T;
}

const httpClient = initHttpClient({})({
  log: {
    error: (...args: unknown[]) => console.error(...args),
    info: () => undefined,
  },
  traceId: 'sample-web-wallet-app',
});

const fetcher = async <T, R>(config: FetcherConfig<T>): Promise<R> => {
  try {
    const method = config.method.toUpperCase();

    switch (method) {
      case 'GET': {
        const response = await httpClient.get<R>(config.url, {
          headers: config.headers,
        });
        return response.json();
      }
      case 'POST': {
        const response = await httpClient.post<T, R>(config.url, config.data, {
          headers: config.headers,
        });
        return response.json();
      }
      case 'DELETE': {
        const response = await httpClient.delete<R>(config.url, {
          headers: config.headers,
        });
        return response.json();
      }
      default:
        throw new Error(`Unsupported HTTP method: ${config.method}`);
    }
  } catch (error) {
    console.error('Http client error:', error);
    throw error;
  }
};

export default fetcher;
