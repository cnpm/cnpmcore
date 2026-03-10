import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import { AbstractRepository } from './AbstractRepository';
import { Org as OrgModel } from './model/Org';
import { OrgMember as OrgMemberModel } from './model/OrgMember';
import { Org } from '../core/entity/Org';
import { OrgMember } from '../core/entity/OrgMember';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class OrgRepository extends AbstractRepository {
  @Inject()
  private readonly Org: typeof OrgModel;

  @Inject()
  private readonly OrgMember: typeof OrgMemberModel;

  async findOrgByName(name: string): Promise<Org | null> {
    const model = await this.Org.findOne({ name });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, Org);
  }

  async findOrgByOrgId(orgId: string): Promise<Org | null> {
    const model = await this.Org.findOne({ orgId });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, Org);
  }

  async saveOrg(org: Org): Promise<void> {
    if (org.id) {
      const model = await this.Org.findOne({ id: org.id });
      if (model) {
        await ModelConvertor.saveEntityToModel(org, model);
      }
      return;
    }
    await ModelConvertor.convertEntityToModel(org, this.Org);
  }

  async removeOrg(orgId: string): Promise<void> {
    await this.Org.remove({ orgId });
  }

  async findMember(orgId: string, userId: string): Promise<OrgMember | null> {
    const model = await this.OrgMember.findOne({ orgId, userId });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, OrgMember);
  }

  async saveMember(member: OrgMember): Promise<void> {
    if (member.id) {
      const model = await this.OrgMember.findOne({ id: member.id });
      if (model) {
        await ModelConvertor.saveEntityToModel(member, model);
      }
      return;
    }
    await ModelConvertor.convertEntityToModel(member, this.OrgMember);
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    await this.OrgMember.remove({ orgId, userId });
  }

  async listMembers(orgId: string): Promise<OrgMember[]> {
    const models = await this.OrgMember.find({ orgId });
    return models.map(model => ModelConvertor.convertModelToEntity(model, OrgMember));
  }

  async removeAllMembers(orgId: string): Promise<void> {
    await this.OrgMember.remove({ orgId });
  }
}
