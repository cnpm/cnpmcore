import { Middleware } from '@eggjs/tegg';
import { AlwaysAuth } from './AlwaysAuth';
import { errorHandler } from './ErrorHandler';
import { Tracing } from './Tracing';

@Middleware(AlwaysAuth)
@Middleware(Tracing)
@Middleware(errorHandler)
export abstract class MiddlewareController {}
