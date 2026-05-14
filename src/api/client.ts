import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import { ServerTask } from '../types/task';
import { AuthResponse } from '../types/auth';

/**
 * API Configuration.
 * Android emulator uses 10.0.2.2, iOS simulator uses localhost.
 */
const BASE_URL = Platform.select({
  android: 'https://task-manager-backend-r5eb.onrender.com',
  ios: 'https://task-manager-backend-r5eb.onrender.com',
  default: 'https://task-manager-backend-r5eb.onrender.com',
});

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/**
 * Axios instance with interceptors for auth and error handling.
 */
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor: attach JWT token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Response interceptor: let errors pass through to safeRequest for proper status capture
api.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    // Pass through — safeRequest handles error extraction
    return Promise.reject(error);
  },
);

interface ApiResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  status: number;
}

async function safeRequest<T>(
  fn: () => Promise<{ data: T; status: number }>,
): Promise<ApiResult<T>> {
  try {
    const response = await fn();
    return { success: true, data: response.data, error: null, status: response.status };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const data = error.response.data as Record<string, unknown>;
      const message =
        typeof data?.error === 'string'
          ? data.error
          : Array.isArray(data?.error)
            ? (data.error as string[]).join(', ')
            : `HTTP ${error.response.status}`;
      return { success: false, data: null, error: message, status: error.response.status };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, data: null, error: message, status: 0 };
  }
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export const AuthApi = {
  async register(name: string, email: string, password: string): Promise<ApiResult<AuthResponse>> {
    return safeRequest(() => api.post('/api/auth/register', { name, email, password }));
  },

  async login(email: string, password: string): Promise<ApiResult<AuthResponse>> {
    return safeRequest(() => api.post('/api/auth/login', { email, password }));
  },

  async getProfile(): Promise<ApiResult<{ user: { _id: string; name: string; email: string } }>> {
    return safeRequest(() => api.get('/api/auth/profile'));
  },
};

// ─── Task API ────────────────────────────────────────────────────────────────

export const TaskApi = {
  async getAllTasks(params?: {
    status?: string;
    priority?: string;
    sort?: string;
  }): Promise<ApiResult<ServerTask[]>> {
    return safeRequest(() => api.get('/api/tasks', { params }));
  },

  async getTask(id: string): Promise<ApiResult<ServerTask>> {
    return safeRequest(() => api.get(`/api/tasks/${id}`));
  },

  async createTask(body: {
    title: string;
    description?: string;
    priority?: string;
    status?: string;
    dueDate?: string | null;
    category?: string;
    labels?: string[];
    notes?: string;
    subtasks?: object[];
    recurrence?: object;
    attachments?: object[];
    voiceNotes?: object[];
  }): Promise<ApiResult<ServerTask>> {
    return safeRequest(() => api.post('/api/tasks', body));
  },

  async updateTask(
    id: string,
    body: Record<string, unknown>,
  ): Promise<ApiResult<ServerTask>> {
    return safeRequest(() => api.put(`/api/tasks/${id}`, body));
  },

  async deleteTask(id: string): Promise<ApiResult<{ message: string }>> {
    return safeRequest(() => api.delete(`/api/tasks/${id}`));
  },

  /**
   * Upload an attachment file via multipart form data.
   */
  async uploadAttachment(
    taskId: string,
    filePath: string,
    fileName: string,
    mimeType: string,
  ): Promise<ApiResult<{ url: string; fileName: string }>> {
    const formData = new FormData();
    formData.append('file', {
      uri: filePath,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);

    return safeRequest(() =>
      api.post(`/api/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },

  /**
   * Upload a voice note file.
   */
  async uploadVoiceNote(
    taskId: string,
    filePath: string,
    duration: number,
  ): Promise<ApiResult<{ url: string; duration: number }>> {
    const formData = new FormData();
    formData.append('audio', {
      uri: filePath,
      name: `voice_${Date.now()}.m4a`,
      type: 'audio/m4a',
    } as unknown as Blob);
    formData.append('duration', String(duration));

    return safeRequest(() =>
      api.post(`/api/tasks/${taskId}/voice-notes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },
};

export { api };
