import { ContextProto } from '@eggjs/tegg';

@ContextProto()
export class HelloService {
  async hello(name: string): Promise<string> {
    return `hello, ${name}`;
  }
}
