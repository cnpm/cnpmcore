import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';

interface WebauthnCredentialData extends EntityData {
  wancId: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  browserType?: string;
}

export class WebauthnCredential extends Entity {
  wancId: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  browserType?: string;

  constructor(data: WebauthnCredentialData) {
    super(data);
    this.wancId = data.wancId;
    this.userId = data.userId;
    this.credentialId = data.credentialId;
    this.publicKey = data.publicKey;
    this.browserType = data.browserType;
  }

  static create(data: EasyData<WebauthnCredentialData, 'wancId'>): WebauthnCredential {
    const newData = EntityUtil.defaultData(data, 'wancId');
    return new WebauthnCredential(newData);
  }
}
