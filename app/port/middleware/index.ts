import { Middleware } from '@eggjs/tegg';
import { errorHandler } from './ErrorHandler';
import { Tracing } from './Tracing';

@Middleware(errorHandler)
@Middleware(Tracing)
export abstract class MiddlewareController {}
