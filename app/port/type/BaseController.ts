import { Middleware } from '@eggjs/tegg';
import { errorHandler } from '../middleware/ErrorHandler';

@Middleware(errorHandler)
export abstract class BaseController {}
