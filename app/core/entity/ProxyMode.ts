import { Entity, EntityData } from './Entity';

interface ProxyModeData extends EntityData {
  targetName: string;
  fileType: string;
  filePath: string;
}

export class ProxyMode extends Entity {
  readonly targetName: string;
  readonly fileType: string;
  readonly filePath: string;

  constructor(data: ProxyModeData) {
    super(data);
    this.targetName = data.targetName;
    this.fileType = data.fileType;
    this.filePath = data.filePath;
  }

}
