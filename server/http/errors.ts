import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'REQUEST_FAILED') {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new HttpError(404, 'Recurso no encontrado.', 'NOT_FOUND'));
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  void _next;
  if (error instanceof ZodError) {
    response.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Revisa los datos enviados.', fields: error.flatten().fieldErrors },
    });
    return;
  }

  if (error instanceof MulterError) {
    response.status(400).json({
      error: { code: error.code, message: 'El archivo no es válido o excede el tamaño permitido (máx. 5MB).' },
    });
    return;
  }

  const status = error instanceof HttpError ? error.status : 500;
  const code = error instanceof HttpError ? error.code : 'INTERNAL_ERROR';
  const message = error instanceof HttpError ? error.message : 'No fue posible completar la solicitud.';

  if (status >= 500) request.log?.error({ err: error }, 'request failed');
  response.status(status).json({ error: { code, message } });
};
