import React from 'react';
import { Provider } from 'react-redux';
import renderer from 'react-test-renderer';
import configureStore from 'redux-mock-store';
import { mount } from 'enzyme';
import { getConfig } from '@edx/frontend-platform';
import { IntlProvider, injectIntl, configure } from '@edx/frontend-platform/i18n';

import RegistrationPage from '../RegistrationPage';
import { RenderInstitutionButton } from '../InstitutionLogistration';

const IntlRegistrationPage = injectIntl(RegistrationPage);
const mockStore = configureStore();


describe('./RegistrationPage.js', () => {
  const initialState = {
    logistration: {
      registrationResult: { success: false, redirectUrl: '' },
      thirdPartyAuthContext: {
        currentProvider: null,
        finishAuthUrl: null,
        providers: [],
        secondaryProviders: [],
      },
    },
  };

  let props = {};
  let store = {};

  const appleProvider = {
    id: 'oa2-apple-id',
    name: 'Apple',
    iconClass: null,
    iconImage: 'https://edx.devstack.lms/logo.png',
    loginUrl: '/auth/login/apple-id/?auth_entry=login&next=/dashboard',
  };

  const secondaryProviders = {
    id: 'saml-test',
    name: 'Test University',
    loginUrl: '/dummy-auth',
    registerUrl: '/dummy_auth',
  };

  const reduxWrapper = children => (
    <IntlProvider locale="en">
      <Provider store={store}>{children}</Provider>
    </IntlProvider>
  );

  beforeEach(() => {
    store = mockStore(initialState);
    configure({
      loggingService: { logError: jest.fn() },
      config: {
        ENVIRONMENT: 'production',
        LANGUAGE_PREFERENCE_COOKIE_NAME: 'yum',
      },
      messages: {
        'es-419': {},
        de: {},
        'en-us': {},
      },
    });
    props = {
      registrationResult: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should match default section snapshot', () => {
    const tree = renderer.create(reduxWrapper(<IntlRegistrationPage {...props} />));
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('should match TPA provider snapshot', () => {
    store = mockStore({
      ...initialState,
      logistration: {
        ...initialState.logistration,
        thirdPartyAuthContext: {
          providers: [appleProvider],
        },
      },
    });

    const tree = renderer.create(reduxWrapper(<IntlRegistrationPage {...props} />)).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('should match url after redirection', () => {
    const dasboardUrl = 'http://test.com/testing-dashboard/';
    store = mockStore({
      ...initialState,
      logistration: {
        ...initialState.logistration,
        registrationResult: {
          success: true,
          redirectUrl: dasboardUrl,
        },
      },
    });
    delete window.location;
    window.location = { href: '' };
    renderer.create(reduxWrapper(<IntlRegistrationPage />));
    expect(window.location.href).toBe(dasboardUrl);
  });

  it('should display institution register button', () => {
    store = mockStore({
      ...initialState,
      logistration: {
        ...initialState.logistration,
        thirdPartyAuthContext: {
          ...initialState.logistration.thirdPartyAuthContext,
          secondaryProviders: [secondaryProviders],
        },
      },
    });
    const root = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
    expect(root.text().includes('Use my institution/campus credentials')).toBe(true);
  });

  it('should not display institution register button', () => {
    store = mockStore({
      ...initialState,
      logistration: {
        ...initialState.logistration,
        thirdPartyAuthContext: {
          ...initialState.logistration.thirdPartyAuthContext,
          secondaryProviders: [secondaryProviders],
        },
      },
    });
    const root = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
    root.find(RenderInstitutionButton).simulate('click', { institutionLogin: true });
    expect(root.text().includes('Test University')).toBe(true);
  });

  it('should match url after TPA redirection', () => {
    const authCompleteUrl = '/auth/complete/google-oauth2/';
    store = mockStore({
      ...initialState,
      logistration: {
        ...initialState.logistration,
        registrationResult: {
          success: true,
          redirectUrl: '',
        },
        thirdPartyAuthContext: {
          ...initialState.logistration.thirdPartyAuthContext,
          finishAuthUrl: authCompleteUrl,
        },
      },
    });

    delete window.location;
    window.location = { href: '' };

    renderer.create(reduxWrapper(<IntlRegistrationPage {...props} />));
    expect(window.location.href).toBe(getConfig().LMS_BASE_URL + authCompleteUrl);
  });

  it('should redirect to social auth provider url', () => {
    const registerUrl = '/auth/login/apple-id/?auth_entry=register&next=/dashboard';
    store = mockStore({
      ...initialState,
      logistration: {
        ...initialState.logistration,
        thirdPartyAuthContext: {
          providers: [{
            ...appleProvider,
            registerUrl,
          }],
        },
      },
    });

    delete window.location;
    window.location = { href: '' };

    const loginPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));

    loginPage.find('button#oa2-apple-id').simulate('click');
    expect(window.location.href).toBe(getConfig().LMS_BASE_URL + registerUrl);
  });

  it('should match third party auth alert', () => {
    store = mockStore({
      ...initialState,
      logistration: {
        ...initialState.logistration,
        thirdPartyAuthContext: {
          ...initialState.logistration.thirdPartyAuthContext,
          currentProvider: 'Apple',
          platformName: 'edX',
        },
      },
    });

    const expectedMessage = 'You\'ve successfully signed into Apple. We just need a little more information before '
                            + 'you start learning with edX.';


    const loginPage = mount(reduxWrapper(<IntlRegistrationPage {...props} />));
    expect(loginPage.find('#tpa-alert').find('span').text()).toEqual(expectedMessage);
  });

  it('should show error message on 409', () => {
    const windowSpy = jest.spyOn(global, 'window', 'get');
    windowSpy.mockImplementation(() => ({
      scrollTo: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    store = mockStore({
      ...initialState,
      logistration: {
        ...initialState.logistration,
        registrationError: {
          email: [
            {
              user_message: 'It looks like test@gmail.com belongs to an existing account. Try again with a different email address.',
            },
          ],
          username: [
            {
              user_message: 'It looks like test belongs to an existing account. Try again with a different username.',
            },
          ],
        },
        response_status: 'complete',
      },
    });

    const tree = renderer.create(reduxWrapper(<IntlRegistrationPage {...props} />)).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
