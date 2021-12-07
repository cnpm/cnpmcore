import { Middleware } from '@eggjs/tegg';
import { AlwaysAuth } from './AlwaysAuth';
import { ErrorHandler } from './ErrorHandler';
import { Tracing } from './Tracing';

@Middleware(AlwaysAuth)
@Middleware(Tracing)
@Middleware(ErrorHandler)
export abstract class MiddlewareController {}
