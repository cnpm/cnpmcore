import { ContextProto } from '@eggjs/tegg';
import { RegistryType } from 'app/common/enum/Registry';
import { Registry } from 'app/core/entity/Registry';
import { AbstractChangeStream, FetchChangesResult, RegistryChangesStream } from './AbstractChangesStream';

@ContextProto()
@RegistryChangesStream(RegistryType.Npm)
export class NpmChangesStream extends AbstractChangeStream {

  async getInitialSince(registry: Registry): Promise<string> {
    const db = (new URL(registry.changeStream)).origin;
    const { status, data } = await this.httpclient.request(db, {
      followRedirect: true,
      timeout: 10000,
      dataType: 'json',
    });
    const since = String((data.update_seq || 7139548) - 10);
    this.logger.warn('[ChangesStreamService.executeTask:firstSeq] GET %s status: %s, data: %j, since: %s',
      registry.name, registry.changeStream, status, data, since);
    return since;
  }

  async fetchChanges(registry: Registry, since: string): Promise<FetchChangesResult> {
    let lastSince = since;
    let taskCount = 0;
    const changes: FetchChangesResult['changes'] = [];

    const db = `${registry.changeStream}?since=${since}`;
    const { res } = await this.httpclient.request(db, {
      streaming: true,
      timeout: 10000,
    });
    for await (const chunk of res) {
      const text: string = chunk.toString();
      // {"seq":7138879,"id":"@danydodson/prettier-config","changes":[{"rev":"5-a56057032714af25400d93517773a82a"}]}
      // console.log('😄%j😄', text);
      // 😄"{\"seq\":7138738,\"id\":\"wargerm\",\"changes\":[{\"rev\":\"59-f0a0d326db4c62ed480987a04ba3bf8f\"}]}"😄
      // 😄",\n{\"seq\":7138739,\"id\":\"@laffery/webpack-starter-kit\",\"changes\":[{\"rev\":\"4-84a8dc470a07872f4cdf85cf8ef892a1\"}]},\n{\"seq\":7138741,\"id\":\"venom-bot\",\"changes\":[{\"rev\":\"103-908654b1ad4b0e0fd40b468d75730674\"}]}"😄
      // 😄",\n{\"seq\":7138743,\"id\":\"react-native-template-pytorch-live\",\"changes\":[{\"rev\":\"40-871c686b200312303ba7c4f7f93e0362\"}]}"😄
      // 😄",\n{\"seq\":7138745,\"id\":\"ccxt\",\"changes\":[{\"rev\":\"10205-25367c525a0a3bd61be3a72223ce212c\"}]}"😄
      const matchs = text.matchAll(/"seq":(\d+),"id":"([^"]+)"/gm);
      for (const match of matchs) {
        const seq = match[1];
        const fullname = match[2];
        if (seq && fullname) {
          taskCount++;
          changes.push({
            fullname,
            seq,
          });
          lastSince = seq;
        }
      }
    }
    return {
      lastSince,
      taskCount,
      changes,
    };
  }
}
