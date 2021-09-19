// import { AccessLevel, ContextProto, EventBus, Inject } from '@eggjs/tegg';
// import { PackageRepository } from '../../repository/PackageRepository';
// import { Package } from '../entity/Package';
// import { PACKAGE_PUBLISHED } from '../event';

// @ContextProto({
//   accessLevel: AccessLevel.PUBLIC,
// })
// export class NpmUpstreamSyncer {
//   @Inject()
//   private readonly eventBus: EventBus;

//   @Inject()
//   private readonly packageRepository: PackageRepository;

//   async listenReplicate() {
//     // 1. npm replicate upstream -> Event<UpstreamPayload>
//     // this.eventBus.emit(PACKAGE_PUBLISHED, pkgVersion.packageVersionId);

//     // curl -v 'https://replicate.npmjs.com/_changes?since=905254'
//     // {"results":[
//     //   {"seq":905255,"id":"yimo-vue-editor-ru","changes":[{"rev":"1-9ec3f5009ea64a386997af9fff6fd4c5"}]},
//     //   {"seq":905256,"id":"@nodert-win10-cu/windows.networking.servicediscovery.dnssd","changes":[{"rev":"1-8e250c0d36f4c18432d557bec209d38c"}]},
//     //   {"seq":905257,"id":"cms-web-package","changes":[{"rev":"1-3e88786419bbb6c928188cd9f3b16d87"}]},
      
//   }
// }
