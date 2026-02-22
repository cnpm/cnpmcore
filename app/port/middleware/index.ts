import { Middleware } from 'egg';

import { AlwaysAuth } from './AlwaysAuth.ts';
import { ErrorHandler } from './ErrorHandler.ts';
import { Tracing } from './Tracing.ts';

@Middleware(AlwaysAuth)
@Middleware(Tracing)
@Middleware(ErrorHandler)
export abstract class MiddlewareController {}
