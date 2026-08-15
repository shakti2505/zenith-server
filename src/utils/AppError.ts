export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, details?: unknown, isOperational: boolean = true) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, details);
  }

  static unauthorized(message: string = 'Unauthorized access', details?: unknown): AppError {
    return new AppError(message, 401, details);
  }

  static forbidden(message: string = 'Access forbidden', details?: unknown): AppError {
    return new AppError(message, 403, details);
  }

  static notFound(message: string = 'Resource not found', details?: unknown): AppError {
    return new AppError(message, 404, details);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(message, 409, details);
  }

  static internal(message: string = 'Internal server error', details?: unknown): AppError {
    return new AppError(message, 500, details, false);
  }
}
