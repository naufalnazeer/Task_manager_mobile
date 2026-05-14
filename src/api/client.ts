import { ServerTask } from '../types/task';
import { AuthResponse } from '../types/auth';

/**
 * API Configuration
 * For Android emulator use 10.0.2.2, for iOS simulator use localhost.
 */
import { Platform } from 'react-native';

const BASE_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  ios: 'http://localhost:3000',
  default: 'http://localhost:3000',
});

const TIMEOUT_MS = 15000;

let authToken: string | null = null;

/**
 * Set the auth token for all subsequent requests.
 */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Get the current auth token.
 */
export function getAuthToken(): string | null {
  return authToken;
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: object;
  requiresAuth?: boolean;
}

interface ApiResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  status: number;
}

/**
 * HTTP client with timeout, auth headers, and error handling.
 */
async function request<T>(options: RequestOptions): Promise<ApiResult<T>> {
  const { method, path, body, requiresAuth = true } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (requiresAuth && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg =
        responseData?.error ||
        (Array.isArray(responseData?.error)
          ? responseData.error.join(', ')
          : `HTTP ${response.status}`);
      return {
        success: false,
        data: null,
        error: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
        status: response.status,
      };
    }

    return {
      success: true,
      data: responseData as T,
      error: null,
      status: response.status,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const message =
      error instanceof Error ? error.message : 'Network error';
    return {
      success: false,
      data: null,
      error: message,
      status: 0,
    };
  }
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export const AuthApi = {
  async register(
    name: string,
    email: string,
    password: string,
  ): Promise<ApiResult<AuthResponse>> {
    return request<AuthResponse>({
      method: 'POST',
      path: '/api/auth/register',
      body: { name, email, password },
      requiresAuth: false,
    });
  },

  async login(
    email: string,
    password: string,
  ): Promise<ApiResult<AuthResponse>> {
    return request<AuthResponse>({
      method: 'POST',
      path: '/api/auth/login',
      body: { email, password },
      requiresAuth: false,
    });
  },

  async getProfile(): Promise<ApiResult<{ user: { _id: string; name: string; email: string } }>> {
    return request({
      method: 'GET',
      path: '/api/auth/profile',
    });
  },
};

// ─── Task API ────────────────────────────────────────────────────────────────

export const TaskApi = {
  /**
   * GET /api/tasks — Fetch all tasks for the authenticated user.
   */
  async getAllTasks(params?: {
    status?: string;
    priority?: string;
    sort?: string;
  }): Promise<ApiResult<ServerTask[]>> {
    const query = new URLSearchParams();
    if (params?.status) {
      query.set('status', params.status);
    }
    if (params?.priority) {
      query.set('priority', params.priority);
    }
    if (params?.sort) {
      query.set('sort', params.sort);
    }
    const queryStr = query.toString();
    const path = queryStr ? `/api/tasks?${queryStr}` : '/api/tasks';
    return request<ServerTask[]>({ method: 'GET', path });
  },

  /**
   * GET /api/tasks/:id — Fetch a single task.
   */
  async getTask(id: string): Promise<ApiResult<ServerTask>> {
    return request<ServerTask>({ method: 'GET', path: `/api/tasks/${id}` });
  },

  /**
   * POST /api/tasks — Create a new task.
   */
  async createTask(body: {
    title: string;
    description?: string;
    priority?: string;
    status?: string;
    dueDate?: string | null;
  }): Promise<ApiResult<ServerTask>> {
    return request<ServerTask>({
      method: 'POST',
      path: '/api/tasks',
      body,
    });
  },

  /**
   * PUT /api/tasks/:id — Update a task.
   */
  async updateTask(
    id: string,
    body: {
      title?: string;
      description?: string;
      priority?: string;
      status?: string;
      dueDate?: string | null;
    },
  ): Promise<ApiResult<ServerTask>> {
    return request<ServerTask>({
      method: 'PUT',
      path: `/api/tasks/${id}`,
      body,
    });
  },

  /**
   * DELETE /api/tasks/:id — Delete a task.
   */
  async deleteTask(id: string): Promise<ApiResult<{ message: string }>> {
    return request<{ message: string }>({
      method: 'DELETE',
      path: `/api/tasks/${id}`,
    });
  },
};
