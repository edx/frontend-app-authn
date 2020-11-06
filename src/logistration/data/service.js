import { camelCaseObject, getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient, getHttpClient } from '@edx/frontend-platform/auth';
import querystring from 'querystring';

export async function postNewUser(registrationInformation) {
  const requestConfig = {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    isPublic: true,
  };

  const { data } = await getAuthenticatedHttpClient()
    .post(
      `${getConfig().LMS_BASE_URL}/user_api/v1/account/registration/`,
      querystring.stringify(registrationInformation),
      requestConfig,
    )
    .catch((e) => {
      throw (e);
    });

  return {
    redirectUrl: data.redirect_url || `${getConfig().LMS_BASE_URL}/dashboard`,
    success: data.success || false,
  };
}

export async function login(creds) {
  const requestConfig = {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    isPublic: true,
  };

  const { data } = await getAuthenticatedHttpClient()
    .post(
      `${getConfig().LMS_BASE_URL}/login_ajax`,
      querystring.stringify(creds),
      requestConfig,
    )
    .catch((e) => {
      throw (e);
    });

  return {
    redirectUrl: data.redirect_url || `${getConfig().LMS_BASE_URL}/dashboard`,
    success: data.success || false,
  };
}


export async function getThirdPartyAuthContext(urlParams) {
  const requestConfig = {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  };

  const { data } = await getHttpClient()
    .get(
      `${getConfig().LMS_BASE_URL}/api/third_party_auth_context`,
      { params: urlParams },
      requestConfig,
    )
    .catch((e) => {
      throw (e);
    });

  return {
    thirdPartyAuthContext: camelCaseObject(data),
  };
}
