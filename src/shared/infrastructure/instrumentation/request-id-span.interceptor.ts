import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { trace } from '@opentelemetry/api';

@Injectable()
export class RequestIdSpanInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ id?: string }>();
    const span = trace.getActiveSpan();
    if (span && req.id) {
      span.setAttribute('app.request_id', req.id);
    }

    return next.handle();
  }
}
