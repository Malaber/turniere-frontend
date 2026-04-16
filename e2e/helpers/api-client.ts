/** TypeScript port of turniere-backend/e2e/lib/api_client.rb */

export interface ApiResponse<T = unknown> {
  status: number;
  json: T;
  headers: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private authHeaders: Record<string, string> = {};
  private static readonly REQUEST_TIMEOUT_MS = 120_000;

  constructor(private readonly baseUrl: string) { }

  isAuthenticated(): boolean {
    return Object.keys(this.authHeaders).length > 0;
  }

  async register(email: string, password: string, username: string): Promise<ApiResponse> {
    const res = await this.request('POST', '/users', {
      email,
      password,
      password_confirmation: password,
      username,
    });
    this.storeAuthHeaders(res.headers);
    return res;
  }

  async login(email: string, password: string): Promise<ApiResponse> {
    const res = await this.request('POST', '/users/sign_in', { email, password });
    this.storeAuthHeaders(res.headers);
    return res;
  }

  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, params);
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body);
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    let url = `${this.baseUrl}${path}`;
    if (params && Object.keys(params).length > 0) {
      url += '?' + new URLSearchParams(params).toString();
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
      ...this.authHeaders,
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(ApiClient.REQUEST_TIMEOUT_MS),
    });

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => { responseHeaders[key] = value; });

    let json: T;
    try {
      const text = await res.text();
      json = text ? JSON.parse(text) : ({} as T);
    } catch {
      json = {} as T;
    }

    return { status: res.status, json, headers: responseHeaders };
  }

  private storeAuthHeaders(headers: Record<string, string>): void {
    const next: Record<string, string> = {};
    for (const key of ['access-token', 'client', 'uid']) {
      if (headers[key]) next[key] = headers[key];
    }
    if (Object.keys(next).length > 0) {
      this.authHeaders = next;
    }
  }
}

/** Assert an expected status and throw ApiError otherwise. */
export function expectStatus(res: ApiResponse, expected: number, action: string): void {
  if (res.status !== expected) {
    throw new ApiError(
      `${action} failed: expected ${expected}, got ${res.status}`,
      res.status,
      res.json,
    );
  }
}
