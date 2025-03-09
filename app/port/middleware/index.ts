import { Middleware } from '@eggjs/tegg';

import { AlwaysAuth } from './AlwaysAuth.js';
import { ErrorHandler } from './ErrorHandler.js';
import { Tracing } from './Tracing.js';

@Middleware(AlwaysAuth)
@Middleware(Tracing)
@Middleware(ErrorHandler)
export abstract class MiddlewareController {}
