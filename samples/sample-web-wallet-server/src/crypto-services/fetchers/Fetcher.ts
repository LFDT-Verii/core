/**
 * Created by Michael Avoyan on 24/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

interface FetcherConfig<T> {
  headers?: Record<string, string>;
  method: string;
  url: string;
  data?: T;
}

const fetcher = async <T, R>(config: FetcherConfig<T>): Promise<R> => {
  try {
    const response = await fetch(config.url, buildRequestInit(config));
    return parseResponse<R>(response);
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

const buildRequestInit = <T>(config: FetcherConfig<T>): RequestInit => {
  const method = config.method.toUpperCase();

  if (!['DELETE', 'GET', 'POST'].includes(method)) {
    throw new Error(`Unsupported HTTP method: ${config.method}`);
  }

  if (method === 'POST') {
    return {
      method,
      headers: {
        'content-type': 'application/json',
        ...config.headers,
      },
      body: config.data == null ? undefined : JSON.stringify(config.data),
    };
  }

  return {
    method,
    headers: config.headers,
  };
};

const parseResponse = async <R>(response: globalThis.Response): Promise<R> => {
  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok) {
    throw await parseErrorResponse(response, contentType);
  }

  return parseResponseBody(response, contentType) as Promise<R>;
};

const parseErrorResponse = async (
  response: globalThis.Response,
  contentType: string,
) => {
  const error = new Error(`Request failed with status ${response.status}`);

  error.name = 'FetchError';
  Object.assign(error, {
    statusCode: response.status,
    body: await parseResponseBody(response, contentType),
  });

  return error;
};

const parseResponseBody = async (
  response: globalThis.Response,
  contentType: string,
) => {
  if (contentType.startsWith('application/json')) {
    return response.json();
  }

  return response.text();
};

export default fetcher;
