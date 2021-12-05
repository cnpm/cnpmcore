import { Middleware } from '@eggjs/tegg';
import { errorHandler } from '../middleware/ErrorHandler';
import { Tracing } from '../middleware/Tracing';

@Middleware(errorHandler)
@Middleware(Tracing)
export abstract class BaseController {}
