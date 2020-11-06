import { AsyncActionType } from '../../data/utils';

export const REGISTER_NEW_USER = new AsyncActionType('REGISTRATION', 'REGISTER_NEW_USER');
export const LOGIN_REQUEST = new AsyncActionType('LOGIN', 'REQUEST');
export const THIRD_PARTY_AUTH_CONTEXT = new AsyncActionType('THIRD_PARTY_AUTH', 'GET_THIRD_PARTY_AUTH_CONTEXT');

// Register

export const registerNewUser = registrationInfo => ({
  type: REGISTER_NEW_USER.BASE,
  payload: { registrationInfo },
});

export const registerNewUserBegin = () => ({
  type: REGISTER_NEW_USER.BEGIN,
});

export const registerNewUserSuccess = (redirectUrl, success) => ({
  type: REGISTER_NEW_USER.SUCCESS,
  payload: { redirectUrl, success },
});

export const registerNewUserFailure = () => ({
  type: REGISTER_NEW_USER.FAILURE,
});

// Login
export const loginRequest = creds => ({
  type: LOGIN_REQUEST.BASE,
  payload: { creds },
});

export const loginRequestBegin = () => ({
  type: LOGIN_REQUEST.BEGIN,
});

export const loginRequestSuccess = (redirectUrl, success) => ({
  type: LOGIN_REQUEST.SUCCESS,
  payload: { redirectUrl, success },
});

export const loginRequestFailure = () => ({
  type: LOGIN_REQUEST.FAILURE,
});

// Third party auth context
export const getThirdPartyAuthContext = (urlParams) => ({
  type: THIRD_PARTY_AUTH_CONTEXT.BASE,
  payload: { urlParams },
});

export const getThirdPartyAuthContextBegin = () => ({
  type: THIRD_PARTY_AUTH_CONTEXT.BEGIN,
});

export const getThirdPartyAuthContextSuccess = (thirdPartyAuthContext) => ({
  type: THIRD_PARTY_AUTH_CONTEXT.SUCCESS,
  payload: { thirdPartyAuthContext },
});

export const getThirdPartyAuthContextFailure = () => ({
  type: THIRD_PARTY_AUTH_CONTEXT.FAILURE,
});
