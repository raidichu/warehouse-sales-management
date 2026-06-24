import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: any[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      message = res?.message || exception.message;
      code = res?.code || this.statusToCode(status);
      details = Array.isArray(res?.message) ? res.message : [];
      if (details.length > 0) message = 'Validation failed';
    } else if (exception instanceof Error) {
      console.error(exception);
      // Prisma unique constraint
      if ((exception as any).code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Dữ liệu đã tồn tại';
        code = 'DUPLICATE_ENTRY';
      }
    }

    response.status(status).json({
      success: false,
      code,
      message,
      details,
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
    };
    return map[status] || 'ERROR';
  }
}
