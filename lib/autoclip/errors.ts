export class AppError extends Error {
  constructor(
    message: string,
    public readonly code = "APP_ERROR",
    public readonly status = 500,
    public readonly details?: string[]
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        success: false as const,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
    };
  }

  const message = error instanceof Error ? error.message : "Unexpected error";

  return {
    status: 500,
    body: {
      success: false as const,
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    },
  };
}
