export interface AppError extends Error {
  statusCode?: number;
}

export interface AppErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
  path: string;
  stack?: string;
}
