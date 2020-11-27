import {
  REGISTER_NEW_USER,
  LOGIN_REQUEST,
  THIRD_PARTY_AUTH_CONTEXT,
} from './actions';

import { DEFAULT_STATE, PENDING_STATE } from '../../data/constants';

export const defaultState = {
  loginError: null,
  loginResult: {},
  registrationError: null,
  registrationResult: {},
};

const reducer = (state = defaultState, action) => {
  switch (action.type) {
    case REGISTER_NEW_USER.BEGIN:
      return {
        ...state,
        submitState: PENDING_STATE,
      };
    case REGISTER_NEW_USER.SUCCESS:
      return {
        ...state,
        registrationResult: action.payload,
      };
    case REGISTER_NEW_USER.FAILURE:
      return {
        ...state,
        registrationError: action.payload.error,
        submitState: DEFAULT_STATE,
      };
    case LOGIN_REQUEST.BEGIN:
      return {
        ...state,
        submitState: PENDING_STATE,
      };
    case LOGIN_REQUEST.SUCCESS:
      return {
        ...state,
        loginResult: action.payload,
      };
    case LOGIN_REQUEST.FAILURE:
      return {
        ...state,
        loginError: action.payload.loginError,
        submitState: DEFAULT_STATE,
      };
    case THIRD_PARTY_AUTH_CONTEXT.BEGIN:
      return {
        ...state,
      };
    case THIRD_PARTY_AUTH_CONTEXT.SUCCESS:
      return {
        ...state,
        thirdPartyAuthContext: action.payload.thirdPartyAuthContext,
      };
    case THIRD_PARTY_AUTH_CONTEXT.FAILURE:
      return {
        ...state,
      };
    default:
      return state;
  }
};

export default reducer;
