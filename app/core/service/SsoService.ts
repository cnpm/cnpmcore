import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';

import { AbstractService } from '../../common/AbstractService';
import { EggContextHttpClient } from 'egg';
import { ForbiddenError } from 'egg-errors';
import { randomToken } from '../../../app/common/UserUtil';
import { UserData } from '../entity/User';

// sso user info must have fields name and email, edit next line if you custom response.
type SSOUserInfo = Pick<UserData, 'name' | 'email'>;

interface AccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class SsoService extends AbstractService {
  @Inject()
  private readonly httpclient: EggContextHttpClient;
  private timeout = 10000;

  getLoginUrlAndToken() {
    const { clientId, scope, authorizationUri, redirectUri } = this.config.cnpmcore.oauth2;
    const token = randomToken(this.config.cnpmcore.name);
    const params = new URLSearchParams({
      client_id: clientId,
      scope,
      response_type: 'code',
      redirect_uri: redirectUri,
      state: token,
    });
    const loginUrl = `${authorizationUri}?${decodeURIComponent(params.toString())}`;
    return [ loginUrl, token ];
  }

  async getAccessToken(code: string): Promise<AccessToken> {
    const {
      clientIdName,
      clientSecretName,
      accessTokenUri,
      clientId,
      clientSecret,
      redirectUri,
    } = this.config.cnpmcore.oauth2;

    const params = {
      code,
      [clientIdName || 'client_id']: clientId,
      [clientSecretName || 'client_secret']: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };

    const { status, data } = await this.httpclient.request(accessTokenUri, {
      method: 'POST',
      data: params,
      contentType: 'application/x-www-form-urlencoded',
      dataType: 'json',
      timing: true,
      timeout: this.timeout,
      followRedirect: true,
    });

    if (status !== 200) {
      throw new ForbiddenError(`Get access_token error, status: "${status}", body: ${data}`);
    }

    return data;
  }


  async getUserInfo(accessToken: string): Promise<SSOUserInfo> {
    const { userInfoUri } = this.config.cnpmcore.oauth2;
    const url = new URL(userInfoUri);
    url.searchParams.append('access_token', accessToken);

    const { status, data } = await this.httpclient.curl(url.href, {
      timeout: this.timeout,
      dataType: 'json',
    });

    if (status !== 200) {
      throw new ForbiddenError(`Get user info error, status: "${status}", data: ${data}`);
    }

    return data;
  }

}
