import React from 'react';
import { Provider } from 'react-redux';
import renderer from 'react-test-renderer';
import { mount } from 'enzyme';
import configureStore from 'redux-mock-store';
import { getConfig, mergeConfig } from '@edx/frontend-platform';
import { IntlProvider, injectIntl, configure } from '@edx/frontend-platform/i18n';
import * as analytics from '@edx/frontend-platform/analytics';
import CookiePolicyBanner from '@edx/frontend-component-cookie-policy-banner';

import RegistrationPage from '../RegistrationPage';
import { RenderInstitutionButton } from '../../common-components';
import RegistrationFailureMessage from '../RegistrationFailure';
import { COMPLETE_STATE, PENDING_STATE } from '../../data/constants';
import { fetchRealtimeValidations, registerNewUser } from '../data/actions';
import { FORBIDDEN_REQUEST, INTERNAL_SERVER_ERROR } from '../data/constants';

jest.mock('@edx/frontend-platform/analytics');

analytics.sendTrackEvent = jest.fn();
analytics.sendPageEvent = jest.fn();

const IntlRegistrationPage = injectIntl(RegistrationPage);
const IntlRegistrationFailure = injectIntl(RegistrationFailureMessage);
const mockStore = configureStore();

describe('RegistrationPage', () => {
  mergeConfig({
    PRIVACY_POLICY: 'http://privacy-policy.com',
    REGISTRATION_OPTIONAL_FIELDS: 'gender,goals,levelOfEducation,yearOfBirth',
    TOS_AND_HONOR_CODE: 'http://tos-and-honot-code.com',
  });

  let props = {};
  let store = {};

  const reduxWrapper = children => (
    <IntlProvider locale="en">
      <Provider store={store}>{children}</Provider>
    </IntlProvider>
  );

  const initialState = {
    register: {
      registrationResult: { success: false, redirectUrl: '' },
      registrationError: null,
    },
    commonComponents: {
      thirdPartyAuthApiStatus: null,
      thirdPartyAuthContext: {
        platformName: 'openedX',
        currentProvider: null,
        finishAuthUrl: null,
        providers: [],
        secondaryProviders: [],
        pipelineUserDetails: null,
      },
    },
  };

  beforeEach(() => {
    store = mockStore(initialState);
    configure({
      loggingService: { logError: jest.fn() },
      config: {
        ENVIRONMENT: 'production',
        LANGUAGE_PREFERENCE_COOKIE_NAME: 'yum',
      },
      messages: { 'es-419': {}, de: {}, 'en-us': {} },
    });
    props = {
      registrationResult: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const populateRequiredFields = (registerPage, payload, isThirdPartyAuth = false) => {
    registerPage.find('input#name').simulate('change', { target: { value: payload.name, name: 'name' } });
    registerPage.find('input#username').simulate('change', { target: { value: payload.username, name: 'username' } });
    registerPage.find('input#email').simulate('change', { target: { value: payload.email, name: 'email' } });
    registerPage.find('select#country').simulate('change', { target: { value: payload.country, name: 'country' } });

    if (!isThirdPartyAuth) {
      registerPage.find('input#password').simulate('change', { target: { value: payload.password, name: 'password' } });
    }
  };

  describe('TestRegistrationPage', () => {
    const emptyFieldValidation = {
      name: 'Please enter your full name.',
      username: 'Please enter your public username.',
      email: 'Please enter your email.',
      password: 'Please enter your password.',
      country: 'Select your country or region of residence.',
    };

    const ssoProvider = {
      id: 'oa2-apple-id',
      name: 'Apple',
      iconClass: null,
      iconImage: 'https://edx.devstack.lms/logo.png',
      loginUrl: '/auth/login/apple-id/?auth_entry=login&next=/dashboard',
    };

    const secondaryProviders = {
      id: 'saml-test', name: 'Test University', loginUrl: '/dummy-auth', registerUrl: '/dummy_auth',
    };

    // ******** test registration form submission ********

    it('should submit form for valid input', () => {
      jest.spyOn(global.Date, 'now').mockImplementation(() => 0);

      const payload = {
        name: 'John Doe',
        username: 'john_doe',
        email: 'john.doe@example.com',
        password: 'password1',
        country: 'Pakistan',
        honor_code: true,
        totalRegistrationTime: 0,
      };

      store.dispatch = jest.fn(store.dispatch);
      const registerPage = mount(reduxWrapper(<IntlRegistrationPage />));

      populateRequiredFields(registerPage, payload);
      registerPage.find('button.btn-brand').simulate('click');
      expect(store.dispatch).toHaveBeenCalledWith(registerNewUser(payload));
    });

    it('should submit form without password field when current provider is present', () => {
      jest.spyOn(global.Date, 'now').mockImplementation(() => 0);
      const formPayload = {
        name: 'John Doe',
        username: 'john_doe',
        email: 'john.doe@example.com',
        country: 'Pakistan',
        honor_code: true,
        social_auth_provider: ssoProvider.name,
        totalRegistrationTime: 0,
      };

      store = mockStore({
        ...initialState,
        commonComponents: {
          ...initialState.commonComponents,
          thirdPartyAuthContext: {
            ...initialState.commonComponents.thirdPartyAuthContext,
            currentProvider: ssoProvider.name,
          },
        },
      });
      store.dispatch = jest.fn(store.dispatch);
      const registerPage = mount(reduxWrapper(<IntlRegistrationPage />));

      populateRequiredFields(registerPage, formPayload, true);
      registerPage.find('button.btn-brand').simulate('click');
      expect(store.dispatch).toHaveBeenCalledWith(registerNewUser(formPayload));
    });

    it('should not dispatch registerNewUser on empty form Submission', () => {
      store.dispatch = jest.fn(store.dispatch);

      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage />));
      registrationPage.find('button.btn-brand').simulate('click');
      expect(store.dispatch).not.toHaveBeenCalledWith(registerNewUser({}));
    });

    // ******** test registration form validations ********

    it('should show error messages for required fields on empty form submission', () => {
      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      registrationPage.find('button.btn-brand').simulate('click');

      expect(registrationPage.find('div[feedback-for="name"]').text()).toEqual(emptyFieldValidation.name);
      expect(registrationPage.find('div[feedback-for="username"]').text()).toEqual(emptyFieldValidation.username);
      expect(registrationPage.find('div[feedback-for="email"]').text()).toEqual(emptyFieldValidation.email);
      expect(registrationPage.find('div[feedback-for="password"]').text()).toEqual(emptyFieldValidation.password);
      expect(registrationPage.find('div[feedback-for="country"]').text()).toEqual(emptyFieldValidation.country);

      let alertBanner = 'We couldn\'t create your account.';
      Object.keys(emptyFieldValidation).forEach(key => {
        alertBanner += emptyFieldValidation[key];
      });

      expect(registrationPage.find('#validation-errors').first().text()).toEqual(alertBanner);
    });

    it('should update errors for frontend validations', () => {
      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));

      registrationPage.find('input#password').simulate('blur', { target: { value: 'pas', name: 'password' } });
      expect(registrationPage.find('RegistrationPage').state('errors')).toEqual({
        email: '', name: '', username: '', password: 'Your password must contain at least 8 characters', country: '',
      });

      registrationPage.find('input#password').simulate('blur', { target: { value: 'passwordd', name: 'password' } });
      expect(registrationPage.find('RegistrationPage').state('errors')).toEqual({
        email: '', name: '', username: '', password: 'Your password must contain at least 1 number.', country: '',
      });

      registrationPage.find('input#password').simulate('blur', { target: { value: '123456789', name: 'password' } });
      expect(registrationPage.find('RegistrationPage').state('errors')).toEqual({
        email: '', name: '', username: '', password: 'Your password must contain at least 1 letter.', country: '',
      });
    });

    it('should validate fields on blur event', () => {
      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      registrationPage.find('input#username').simulate('blur', { target: { value: '', name: 'username' } });
      registrationPage.find('input#name').simulate('blur', { target: { value: '', name: 'name' } });
      registrationPage.find('input#email').simulate('blur', { target: { value: '', name: 'email' } });
      registrationPage.find('input#password').simulate('blur', { target: { value: '', name: 'password' } });
      registrationPage.find('select#country').simulate('blur', { target: { value: '', name: 'country' } });
      expect(registrationPage.find('RegistrationPage').state('errors')).toEqual(emptyFieldValidation);
    });

    it('should validate field from backend on blur event', () => {
      store.dispatch = jest.fn(store.dispatch);

      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage />));
      IntlRegistrationPage.prototype.componentDidMount = jest.fn();

      // enter a valid username so that frontend validations are passed
      registrationPage.find('input#username').simulate('change', { target: { value: 'test', name: 'username' } });
      registrationPage.find('input#username').simulate('blur');

      const formPayload = {
        email: '', name: '', username: 'test', password: '', country: '', honor_code: true,
      };
      expect(store.dispatch).toHaveBeenCalledWith(fetchRealtimeValidations(formPayload));
    });

    it('should change validations and formValid state in shouldComponentUpdate', () => {
      store = mockStore({
        ...initialState,
        register: {
          ...initialState.register,
          updateFieldErrors: false,
        },
      });
      const nextProps = {
        validations: {
          validation_decisions: {
            username: 'Username must be between 2 and 30 characters long.',
          },
        },
        registrationError: {
          username: [{ username: 'Username must be between 2 and 30 characters long.' }],
        },
      };

      const root = mount(reduxWrapper(<IntlRegistrationPage {...props} />));

      // calling blur event to update the state
      root.find('input#username').simulate('blur', { target: { value: '', name: 'username' } });
      expect(root.find('RegistrationPage').instance().shouldComponentUpdate(nextProps)).toBe(false);
      expect(root.find('RegistrationPage').state('formValid')).not.toEqual(true);
    });

    it('should show error message on top of screen and below the fields in case of 409', () => {
      const errors = {
        email: 'It looks like test@gmail.com belongs to an existing account. Try again with a different email address.',
        username: 'It looks like test belongs to an existing account. Try again with a different username.',
      };
      store = mockStore({
        ...initialState,
        register: {
          ...initialState.register,
          registrationError: {
            email: [{ user_message: errors.email }],
            username: [{ user_message: errors.username }],
          },
        },
      });

      const nextProps = {
        validations: null,
        thirdPartyAuthContext: {
          pipelineUserDetails: null,
        },
        registrationError: {
          username: [{ username: errors.username }],
        },
      };

      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      registrationPage.find('button.btn-brand').simulate('click');
      registrationPage.find('RegistrationPage').instance().shouldComponentUpdate(nextProps);

      expect(registrationPage.find('div[feedback-for="email"]').text()).toEqual(errors.email);
      expect(registrationPage.find('div[feedback-for="username"]').text()).toEqual(errors.username);
      expect(registrationPage.find('#validation-errors').first().text()).toEqual(
        'We couldn\'t create your account.'.concat(errors.email + errors.username),
      );
    });

    it('test validationAlertMessages state is updated correctly', () => {
      const validationAlertMessages = {
        name: [{ user_message: 'Please enter your full name.' }],
        username: [{ user_message: 'Please enter your public username.' }],
        email: [{ user_message: 'Please enter your email.' }],
        password: [{ user_message: 'Please enter your password.' }],
        country: [{ user_message: 'Select your country or region of residence.' }],
      };
      store.dispatch = jest.fn(store.dispatch);

      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));

      // submit empty form
      registrationPage.find('button.btn-brand').simulate('click');
      expect(registrationPage.find('RegistrationPage').state('validationAlertMessages')).toEqual(validationAlertMessages);

      // simulate blur event on one of the form fields, this should not update the state
      registrationPage.find('input#name').simulate('blur', { target: { value: 'test', name: 'name' } });
      expect(registrationPage.find('RegistrationPage').state('validationAlertMessages')).toEqual(validationAlertMessages);
    });

    // ******** test alert messages ********

    it('should match third party auth alert', () => {
      store = mockStore({
        ...initialState,
        commonComponents: {
          ...initialState.commonComponents,
          thirdPartyAuthContext: {
            ...initialState.commonComponents.thirdPartyAuthContext,
            currentProvider: 'Apple',
          },
        },
      });

      const expectedMessage = 'You\'ve successfully signed into Apple. We just need a little more information before '
                              + 'you start learning with openedX.';

      const registerPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      expect(registerPage.find('#tpa-alert').find('span').text()).toEqual(expectedMessage);
    });

    it('should match internal server error message', () => {
      props = {
        errors: {
          errorCode: INTERNAL_SERVER_ERROR,
        },
      };

      const registrationPage = mount(reduxWrapper(<IntlRegistrationFailure {...props} />));
      expect(registrationPage.find('div.alert-heading').length).toEqual(1);
      const expectedMessage = 'We couldn\'t create your account.An error has occurred. Try refreshing the page, or check your internet connection.';
      expect(registrationPage.find('div.alert').first().text()).toEqual(expectedMessage);
    });

    it('should match registration api rate limit error message', () => {
      props = {
        errors: {
          errorCode: FORBIDDEN_REQUEST,
        },
      };

      const registrationPage = mount(reduxWrapper(<IntlRegistrationFailure {...props} />));
      expect(registrationPage.find('div.alert-heading').length).toEqual(1);
      const expectedMessage = 'We couldn\'t create your account.Too many failed registration attempts. Try again later.';
      expect(registrationPage.find('div.alert').first().text()).toEqual(expectedMessage);
    });

    // ******** test form buttons and fields ********

    it('should match default button state', () => {
      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      expect(registrationPage.find('button[type="submit"] span').first().text()).toEqual('Create an account');
    });

    it('should match pending button state', () => {
      store = mockStore({
        ...initialState,
        register: {
          ...initialState.register,
          submitState: PENDING_STATE,
        },
      });

      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      const button = registrationPage.find('button[type="submit"] span').first();

      // submit button has no text when it is loading
      expect(button.text()).toEqual('');
      expect(button.find('svg').prop('className')).toEqual(expect.stringContaining('fa-spinner'));
    });

    it('should match single sign on provider button', () => {
      store = mockStore({
        ...initialState,
        commonComponents: {
          ...initialState.commonComponents,
          thirdPartyAuthContext: {
            ...initialState.commonComponents.thirdPartyAuthContext,
            providers: [ssoProvider],
          },
        },
      });

      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      expect(registrationPage.find('button#oa2-apple-id').length).toEqual(1);
    });

    it('should display institution register button', () => {
      store = mockStore({
        ...initialState,
        commonComponents: {
          ...initialState.commonComponents,
          thirdPartyAuthContext: {
            ...initialState.commonComponents.thirdPartyAuthContext,
            secondaryProviders: [secondaryProviders],
          },
        },
      });
      delete window.location;
      window.location = { href: getConfig().BASE_URL };

      const root = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      expect(root.text().includes('Use my institution/campus credentials')).toBe(true);
    });

    it('should not display institution register button', () => {
      store = mockStore({
        ...initialState,
        commonComponents: {
          ...initialState.commonComponents,
          thirdPartyAuthContext: {
            ...initialState.commonComponents.thirdPartyAuthContext,
            secondaryProviders: [secondaryProviders],
          },
        },
      });
      delete window.location;
      window.location = { href: getConfig().BASE_URL };

      const root = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      root.find(RenderInstitutionButton).simulate('click', { institutionLogin: true });
      expect(root.text().includes('Test University')).toBe(true);
    });

    it('should display no password field when current provider is present', () => {
      store = mockStore({
        ...initialState,
        commonComponents: {
          ...initialState.commonComponents,
          thirdPartyAuthContext: {
            ...initialState.commonComponents.thirdPartyAuthContext,
            currentProvider: ssoProvider.name,
          },
        },
      });

      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      expect(registrationPage.find('input#password').length).toEqual(0);
    });

    // ******** test redirection ********

    it('should redirect to url returned in registration result after successful account creation', () => {
      const dasboardUrl = 'http://test.com/testing-dashboard/';
      store = mockStore({
        ...initialState,
        register: {
          ...initialState.register,
          registrationResult: {
            success: true,
            redirectUrl: dasboardUrl,
          },
        },
      });
      delete window.location;
      window.location = { href: getConfig().BASE_URL };
      renderer.create(reduxWrapper(<IntlRegistrationPage />));
      expect(window.location.href).toBe(dasboardUrl);
    });

    it('should redirect to social auth provider url on SSO button click', () => {
      const registerUrl = '/auth/login/apple-id/?auth_entry=register&next=/dashboard';
      store = mockStore({
        ...initialState,
        commonComponents: {
          ...initialState.commonComponents,
          thirdPartyAuthContext: {
            ...initialState.commonComponents.thirdPartyAuthContext,
            providers: [{
              ...ssoProvider,
              registerUrl,
            }],
          },
        },
      });

      delete window.location;
      window.location = { href: getConfig().BASE_URL };

      const loginPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));

      loginPage.find('button#oa2-apple-id').simulate('click');
      expect(window.location.href).toBe(getConfig().LMS_BASE_URL + registerUrl);
    });

    it('should redirect to finishAuthUrl upon successful registration via SSO', () => {
      const authCompleteUrl = '/auth/complete/google-oauth2/';
      store = mockStore({
        ...initialState,
        register: {
          ...initialState.register,
          registrationResult: {
            success: true,
          },
        },
        commonComponents: {
          ...initialState.commonComponents,
          thirdPartyAuthContext: {
            ...initialState.commonComponents.thirdPartyAuthContext,
            finishAuthUrl: authCompleteUrl,
          },
        },
      });

      delete window.location;
      window.location = { href: getConfig().BASE_URL };

      renderer.create(reduxWrapper(<IntlRegistrationPage {...props} />));
      expect(window.location.href).toBe(getConfig().LMS_BASE_URL + authCompleteUrl);
    });

    // ******** test hinted third party auth ********

    it('should render tpa button for tpa_hint id in primary provider', () => {
      const expectedMessage = `Sign in using ${ssoProvider.name}`;
      store = mockStore({
        ...initialState,
        commonComponents: {
          ...initialState.commonComponents,
          thirdPartyAuthContext: {
            ...initialState.commonComponents.thirdPartyAuthContext,
            providers: [ssoProvider],
          },
          thirdPartyAuthApiStatus: COMPLETE_STATE,
        },
      });

      delete window.location;
      window.location = { href: getConfig().BASE_URL.concat('/login'), search: `?next=/dashboard&tpa_hint=${ssoProvider.id}` };
      ssoProvider.iconImage = null;

      const registerPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      expect(registerPage.find(`button#${ssoProvider.id}`).find('span').text()).toEqual(expectedMessage);
    });

    it('should render tpa button for tpa_hint id in secondary provider', () => {
      store = mockStore({
        ...initialState,
        commonComponents: {
          ...initialState.commonComponents,
          thirdPartyAuthContext: {
            ...initialState.commonComponents.thirdPartyAuthContext,
            secondaryProviders: [secondaryProviders],
          },
          thirdPartyAuthApiStatus: COMPLETE_STATE,
        },
      });

      delete window.location;
      window.location = { href: getConfig().BASE_URL.concat('/login'), search: `?next=/dashboard&tpa_hint=${secondaryProviders.id}` };
      secondaryProviders.iconImage = null;

      mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      expect(window.location.href).toEqual(getConfig().LMS_BASE_URL + secondaryProviders.registerUrl);
    });

    it('should render regular tpa button for invalid tpa_hint value', () => {
      const expectedMessage = `${ssoProvider.name}`;
      store = mockStore({
        ...initialState,
        commonComponents: {
          ...initialState.commonComponents,
          thirdPartyAuthContext: {
            ...initialState.commonComponents.thirdPartyAuthContext,
            providers: [ssoProvider],
          },
          thirdPartyAuthApiStatus: COMPLETE_STATE,
        },
      });

      delete window.location;
      window.location = { href: getConfig().BASE_URL.concat('/login'), search: '?next=/dashboard&tpa_hint=invalid' };
      ssoProvider.iconImage = null;

      const registerPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      expect(registerPage.find(`button#${ssoProvider.id}`).find('span#provider-name').text()).toEqual(expectedMessage);
    });

    // ******** miscellaneous tests ********

    it('tests shouldComponentUpdate with pipeline user data', () => {
      const nextProps = {
        validations: null,
        thirdPartyAuthContext: {
          pipelineUserDetails: {
            name: 'test',
            email: 'test@example.com',
            username: 'test-username',
          },
        },
      };

      const root = mount(reduxWrapper(<IntlRegistrationPage {...props} />));

      const shouldUpdate = root.find('RegistrationPage').instance().shouldComponentUpdate(nextProps);
      expect(shouldUpdate).toBe(false);
    });

    it('check cookie rendered', () => {
      const registerPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      expect(registerPage.find(<CookiePolicyBanner />)).toBeTruthy();
    });

    it('send page event when register page is rendered', () => {
      mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      expect(analytics.sendPageEvent).toHaveBeenCalledWith('login_and_registration', 'register');
    });

    it('test username suggestions', () => {
      store = mockStore({
        ...initialState,
        register: {
          ...initialState.register,
          validations: {
            validation_decisions: {
              username: 'It looks like test belongs to an existing account. Try again with a different username.',
            },
            username_suggestions: ['test_1', 'test_12', 'test_123'],
          },
        },
      });

      const registerPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
      expect(registerPage.find('button.username-suggestion').length).toEqual(3);
      registerPage.find('button.username-suggestion').at(0).simulate('click');
      expect(registerPage.find('RegistrationPage').state('username')).toEqual('test_1');
    });
  });

  describe('TestOptionalFields', () => {
    it('should toggle optional fields state', () => {
      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage />));

      registrationPage.find('input#optional-field-checkbox').simulate('click', { target: { name: 'optionalFields', checked: true } });
      expect(registrationPage.find('RegistrationPage').state('showOptionalField')).toEqual(true);

      // it should also works when change is made directly instead of click
      registrationPage.find('input#optional-field-checkbox').simulate('change', { target: { name: 'optionalFields', checked: false } });
      expect(registrationPage.find('RegistrationPage').state('showOptionalField')).toEqual(false);
    });

    it('should show optional fields section on optional check enabled', () => {
      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage />));
      registrationPage.find('input#optional-field-checkbox').simulate('change', { target: { name: 'optionalFields', checked: true } });
      registrationPage.update();

      expect(registrationPage.find('textarea#goals').length).toEqual(1);
      expect(registrationPage.find('select#levelOfEducation').length).toEqual(1);
      expect(registrationPage.find('select#yearOfBirth').length).toEqual(1);
      expect(registrationPage.find('select#gender').length).toEqual(1);
    });

    it('should show optional field check based on environment variable', () => {
      mergeConfig({
        REGISTRATION_OPTIONAL_FIELDS: '',
      });
      let registrationPage = mount(reduxWrapper(<IntlRegistrationPage />));
      expect(registrationPage.find('input#optional-field-checkbox').length).toEqual(0);

      mergeConfig({
        REGISTRATION_OPTIONAL_FIELDS: 'gender,goals,levelOfEducation,yearOfBirth',
      });

      registrationPage = mount(reduxWrapper(<IntlRegistrationPage />));
      expect(registrationPage.find('input#optional-field-checkbox').length).toEqual(1);
    });

    it('send tracking event on optional checkbox enabled', () => {
      const registrationPage = mount(reduxWrapper(<IntlRegistrationPage />));

      registrationPage.find('input#optional-field-checkbox').simulate('change', { target: { name: 'optionalFields', checked: true } });
      expect(analytics.sendTrackEvent).toHaveBeenCalledWith('edx.bi.user.register.optional_fields_selected', {});
    });

    it('should submit form with optional fields', () => {
      jest.spyOn(global.Date, 'now').mockImplementation(() => 0);

      const payload = {
        name: 'John Doe',
        username: 'john_doe',
        email: 'john.doe@example.com',
        password: 'password1',
        country: 'Pakistan',
        gender: 'm',
        year_of_birth: '1997',
        level_of_education: 'other',
        goals: 'edX goals',
        honor_code: true,
        totalRegistrationTime: 0,
      };

      store.dispatch = jest.fn(store.dispatch);
      delete window.location;
      window.location = { href: getConfig().BASE_URL };

      const registerPage = mount(reduxWrapper(<IntlRegistrationPage />));
      populateRequiredFields(registerPage, payload);

      // submit optional fields
      registerPage.find('input#optional-field-checkbox').simulate('change', { target: { name: 'optionalFields', checked: true } });
      registerPage.find('select#gender').simulate('change', { target: { value: 'm', name: 'gender' } });
      registerPage.find('select#yearOfBirth').simulate('change', { target: { value: '1997', name: 'yearOfBirth' } });
      registerPage.find('select#levelOfEducation').simulate('change', { target: { value: 'other', name: 'levelOfEducation' } });
      registerPage.find('textarea#goals').simulate('change', { target: { value: 'edX goals', name: 'goals' } });

      registerPage.find('button.btn-brand').simulate('click');
      expect(store.dispatch).toHaveBeenCalledWith(registerNewUser(payload));
    });
  });
});
