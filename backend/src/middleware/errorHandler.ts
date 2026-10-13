import { Request, Response, NextFunction } from 'express';
import { TraceableRequest } from './requestLogger';

export const errorHandler = (err: any, req: TraceableRequest, res: Response, next: NextFunction) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const requestId = req.id || (req.headers['x-request-id'] as string) || 'unknown';

  // Handle malformed JSON body errors from express.json()
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload in request body.',
      statusCode: 400,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  // Handle Payload Too Large errors
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      error: 'Payload Too Large: Maximum allowed request size is 1MB.',
      statusCode: 413,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  // CORS rejection
  if (err.message && err.message.includes('not allowed by LifeLink CORS policy')) {
    return res.status(403).json({
      success: false,
      error: err.message,
      statusCode: 403,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  const status = typeof err.status === 'number' ? err.status : 500;
  const message = status === 500 && isProduction
    ? 'An unexpected internal server error occurred. Please contact system support with your Request ID.'
    : (err.message || 'Internal Server Error');

  // Log error with correlation ID
  console.error(`[UNHANDLED ERROR] [${requestId}] ${req.method} ${req.url} (Status ${status}):`, {
    message: err.message,
    name: err.name,
    stack: isProduction ? undefined : err.stack
  });

  res.status(status).json({
    success: false,
    error: message,
    statusCode: status,
    requestId,
    timestamp: new Date().toISOString(),
    stack: !isProduction ? err.stack : undefined
  });
};

/**
 * 404 Handler for undefined API routes
 */
export const notFoundHandler = (req: TraceableRequest, res: Response) => {
  const requestId = req.id || (req.headers['x-request-id'] as string) || 'unknown';
  res.status(404).json({
    success: false,
    error: `Resource not found: ${req.method} ${req.originalUrl || req.url}`,
    statusCode: 404,
    requestId,
    timestamp: new Date().toISOString()
  });
};
