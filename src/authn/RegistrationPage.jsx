import React from 'react';
import { connect } from 'react-redux';
import Skeleton from 'react-loading-skeleton';
import PropTypes from 'prop-types';
import {
  Input,
  StatefulButton,
  Hyperlink,
  ValidationFormGroup,
  Form,
} from '@edx/paragon';

import {
  injectIntl, intlShape,
} from '@edx/frontend-platform/i18n';

import camelCase from 'lodash.camelcase';
import {
  getThirdPartyAuthContext,
  registerNewUser,
  fetchRegistrationForm,
  fetchRealtimeValidations,
} from './data/actions';
import { registrationRequestSelector, thirdPartyAuthContextSelector } from './data/selectors';
import { RedirectAuthn } from '../common-components';
import RegistrationFailure from './RegistrationFailure';
import {
  DEFAULT_REDIRECT_URL,
  DEFAULT_STATE,
  PENDING_STATE,
  LOGIN_PAGE,
  REGISTER_PAGE,
  REGISTRATION_VALIDITY_MAP,
  REGISTRATION_OPTIONAL_MAP,
  REGISTRATION_EXTRA_FIELDS,
} from '../data/constants';
import SocialAuthProviders from './SocialAuthProviders';
import ThirdPartyAuthAlert from './ThirdPartyAuthAlert';
import InstitutionAuthn, { RenderInstitutionButton } from './InstitutionLogistration';
import messages from './messages';
import { processLink } from '../data/utils/dataUtils';

class RegistrationPage extends React.Component {
  constructor(props, context) {
    super(props, context);

    this.intl = props.intl;

    this.state = {
      email: '',
      name: '',
      username: '',
      password: '',
      country: '',
      city: '',
      gender: '',
      yearOfBirth: '',
      mailingAddress: '',
      goals: '',
      honorCode: true,
      termsOfService: true,
      levelOfEducation: '',
      confirmEmail: '',
      enableOptionalField: false,
      validationFieldName: '',
      validationErrorsAlertMessages: {
        name: [{ user_message: '' }],
        username: [{ user_message: '' }],
        email: [{ user_message: '' }],
        emailFormat: [{ user_message: '' }],
        password: [{ user_message: '' }],
        country: [{ user_message: '' }],
      },
      currentValidations: null,
      errors: {
        email: '',
        name: '',
        username: '',
        password: '',
        country: '',
        honorCode: '',
        termsOfService: '',
      },
      emailValid: false,
      nameValid: false,
      usernameValid: false,
      passwordValid: false,
      countryValid: false,
      honorCodeValid: true,
      termsOfServiceValid: false,
      institutionLogin: false,
      formValid: false,
    };
  }

  componentDidMount() {
    const params = (new URL(document.location)).searchParams;
    const payload = {
      redirect_to: params.get('next') || DEFAULT_REDIRECT_URL,
    };
    this.props.getThirdPartyAuthContext(payload);
    this.props.fetchRegistrationForm();
  }

  shouldComponentUpdate(nextProps) {
    if (nextProps.statusCode !== 403 && this.props.validations !== nextProps.validations) {
      const { errors } = this.state;
      const errorMsg = nextProps.validations.validation_decisions[this.state.validationFieldName];
      errors[this.state.validationFieldName] = errorMsg;
      const stateValidKey = `${camelCase(this.state.validationFieldName)}Valid`;
      const currentValidations = nextProps.validations.validation_decisions;

      this.setState({
        [stateValidKey]: !errorMsg,
        errors,
        currentValidations,
      });
      return false;
    }

    if (this.props.thirdPartyAuthContext.pipelineUserDetails !== nextProps.thirdPartyAuthContext.pipelineUserDetails) {
      this.setState({
        ...nextProps.thirdPartyAuthContext.pipelineUserDetails,
      });
      return false;
    }

    if (this.props.registrationError !== nextProps.registrationError) {
      this.setState({
        formValid: false,
      });
      return false;
    }
    return true;
  }

  handleInstitutionLogin = () => {
    this.setState(prevState => ({ institutionLogin: !prevState.institutionLogin }));
  }

  handleSubmit = (e) => {
    e.preventDefault();
    const params = (new URL(document.location)).searchParams;
    const payload = {};
    const payloadMap = new Map();
    payloadMap.set('name', this.state.name);
    payloadMap.set('username', this.state.username);
    payloadMap.set('email', this.state.email);

    if (!this.props.thirdPartyAuthContext.currentProvider) {
      payloadMap.set('password', this.state.password);
    }

    const fieldMap = { ...REGISTRATION_VALIDITY_MAP, ...REGISTRATION_OPTIONAL_MAP };
    Object.entries(fieldMap).forEach(([key, value]) => {
      if (value) {
        payloadMap.set(key, this.state[camelCase(key)]);
      }
    });
    payloadMap.forEach((value, key) => { payload[key] = value; });

    const next = params.get('next');
    const courseId = params.get('course_id');
    if (next) {
      payload.next = params.next;
    }
    if (courseId) {
      payload.course_id = params.course_id;
    }

    let finalValidation = this.isFormValid();
    if (!this.isFormValid()) {
      // Special case where honor code and tos is a single field, true by default. We don't need
      // to validate this field
      payloadMap.forEach((value, key) => {
        if (key !== 'honor_code' || 'terms_of_service' in REGISTRATION_VALIDITY_MAP) {
          finalValidation = this.validateInput(key, value);
        }
      });
    }
    if (finalValidation) {
      this.props.registerNewUser(payload);
    } else {
      this.props.fetchRealtimeValidations(payload);
    }
  }

  checkNoValidationsErrors(validations) {
    let keyValidList = null;
    keyValidList = Object.entries(validations).map(([key]) => {
      const validation = validations[key][0];
      return !validation.user_message;
    });
    return keyValidList.every((current) => current === true);
  }

  isFormValid() {
    return this.state.formValid;
  }

  handleOnBlur(e) {
    this.setState({
      validationFieldName: e.target.name,
    });

    const payload = {
      email: this.state.email,
      username: this.state.username,
      password: this.state.password,
      name: this.state.name,
      honor_code: this.state.honorCode,
      country: this.state.country,
    };
    this.props.fetchRealtimeValidations(payload);
  }

  handleOnChange(e) {
    const targetValue = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    this.setState({
      [camelCase(e.target.name)]: targetValue,
    });
  }

  handleOnOptional(e) {
    const optionalEnable = this.state.enableOptionalField;
    const targetValue = e.target.id === 'additionalFields' ? !optionalEnable : e.target.checked;
    this.setState({
      enableOptionalField: targetValue,
    });
  }

  handleOnClick(e) {
    const { errors } = this.state;
    if (this.state.currentValidations) {
      const fieldName = e.target.name;
      errors[fieldName] = this.state.currentValidations[fieldName];
      const stateValidKey = `${camelCase(fieldName)}Valid`;
      this.setState(prevState => ({
        [stateValidKey]: !prevState.currentValidations[fieldName],
        errors,
      }));
    }
  }

  validateInput(inputName, value) {
    const {
      errors,
      validationErrorsAlertMessages,
    } = this.state;

    let {
      honorCodeValid,
      termsOfServiceValid,
      formValid,
    } = this.state;

    const validations = this.state.currentValidations;
    switch (inputName) {
      case 'email':
        if (this.props.statusCode !== 403 && validations && validations.email) {
          validationErrorsAlertMessages.email = [{ user_message: validations.email }];
        } else if (value.length < 1) {
          const errorEmpty = this.generateUserMessage(value.length < 1, 'authn.email.validation.message');
          validationErrorsAlertMessages.email = errorEmpty;
        } else {
          const errorCharlength = this.generateUserMessage(value.length <= 2, 'authn.email.ratelimit.less.chars.validation.message');
          const formatError = this.generateUserMessage(!value.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i), 'authn.email.ratelimit.incorrect.format.validation.message');
          validationErrorsAlertMessages.email = errorCharlength;
          validationErrorsAlertMessages.emailFormat = formatError;
        }
        break;
      case 'name':
        if (this.props.statusCode !== 403 && validations && validations.name) {
          validationErrorsAlertMessages.name = [{ user_message: validations.name }];
        } else if (value.length < 1) {
          const errorEmpty = this.generateUserMessage(value.length < 1, 'authn.fullname.validation.message');
          validationErrorsAlertMessages.name = errorEmpty;
        } else {
          validationErrorsAlertMessages.name = [{ user_message: '' }];
        }
        break;
      case 'username':
        if (this.props.statusCode !== 403 && validations && validations.username) {
          validationErrorsAlertMessages.username = [{ user_message: validations.username }];
        } else if (value.length < 1) {
          const errorEmpty = this.generateUserMessage(value.length < 1, 'authn.username.validation.message');
          validationErrorsAlertMessages.username = errorEmpty;
        } else {
          const errorCharLength = this.generateUserMessage(value.length <= 1, 'authn.username.ratelimit.less.chars.message');
          validationErrorsAlertMessages.username = errorCharLength;
        }
        break;
      case 'password':
        if (this.props.statusCode !== 403 && validations && validations.password) {
          validationErrorsAlertMessages.password = [{ user_message: validations.password }];
        } else if (value.length < 1) {
          const errorEmpty = this.generateUserMessage(value.length < 1, 'authn.register.page.password.validation.message');
          validationErrorsAlertMessages.password = errorEmpty;
        } else {
          const errorCharLength = this.generateUserMessage(value.length < 8, 'authn.email.ratelimit.password.validation.message');
          validationErrorsAlertMessages.password = errorCharLength;
        }
        break;
      case 'country':
        if (this.props.statusCode !== 403 && validations && validations.country) {
          validationErrorsAlertMessages.country = [{ user_message: validations.country }];
        } else {
          const emptyError = this.generateUserMessage(value === '', 'authn.country.validation.message');
          validationErrorsAlertMessages.country = emptyError;
        }
        break;
      case 'honor_code':
        honorCodeValid = value !== false;
        errors.honorCode = honorCodeValid ? '' : null;
        break;
      case 'terms_of_service':
        termsOfServiceValid = value !== false;
        errors.termsOfService = termsOfServiceValid ? '' : null;
        break;
      default:
        break;
    }

    formValid = this.checkNoValidationsErrors(validationErrorsAlertMessages);
    this.setState({
      formValid,
      validationErrorsAlertMessages,
      honorCodeValid,
      termsOfServiceValid,
    });
    return formValid;
  }

  addExtraRequiredFields() {
    const fields = this.props.formData.fields.map((field) => {
      let options = null;
      if (REGISTRATION_EXTRA_FIELDS.includes(field.name)) {
        if (field.required) {
          const stateVar = camelCase(field.name);

          let beforeLink;
          let link;
          let linkText;
          let afterLink;

          const props = {
            id: field.name,
            name: field.name,
            type: field.type,
            value: this.state[stateVar],
            required: true,
            onChange: e => this.handleOnChange(e),
          };

          REGISTRATION_VALIDITY_MAP[field.name] = true;
          if (field.type === 'plaintext' && field.name === 'honor_code') { // special case where honor code and tos are combined
            afterLink = field.label;
            props.type = 'hidden';
            const nodes = [];
            do {
              const matches = processLink(afterLink);
              [beforeLink, link, linkText, afterLink] = matches;
              nodes.push(
                <React.Fragment key={link}>
                  {beforeLink}
                  <Hyperlink destination={link}>{linkText}</Hyperlink>
                </React.Fragment>,
              );
            } while (afterLink.includes('a href'));
            nodes.push(<React.Fragment key={afterLink}>{afterLink}</React.Fragment>);

            return (
              <React.Fragment key={field.type}>
                <input {...props} />
                <ValidationFormGroup
                  for={field.name}
                  key={field.name}
                  className="pt-10 mb-0"
                >
                  { nodes }
                </ValidationFormGroup>
              </React.Fragment>
            );
          }
          if (field.type === 'checkbox') {
            const matches = processLink(field.label);
            [beforeLink, link, linkText, afterLink] = matches;
            props.checked = this.state[stateVar];
            return (
              <ValidationFormGroup
                for={field.name}
                key={field.name}
                invalid={this.state.errors[stateVar] !== ''}
                invalidMessage={field.errorMessages.required}
                className="custom-control mb-0"
              >
                <Input {...props} />
                {beforeLink}
                <Hyperlink destination={link}>{linkText}</Hyperlink>
                {afterLink}
              </ValidationFormGroup>
            );
          }
          if (field.type === 'select') {
            options = field.options.map((item) => ({
              value: item.value,
              label: item.name,
            }));
            props.options = options;
            props.onBlur = e => this.handleOnBlur(e);
            props.onClick = e => this.handleOnClick(e);
          }
          return (
            <ValidationFormGroup
              for={field.name}
              key={field.name}
              invalid={this.state.errors[stateVar] !== ''}
              invalidMessage={field.errorMessages.required}
              className="mb-0"
            >
              <label htmlFor={field.name} className="h6 pt-10">{field.label} (required)</label>
              <Input {...props} />
            </ValidationFormGroup>
          );
        }
      }
      return null;
    });
    return fields;
  }

  addExtraOptionalFields() {
    const fields = this.props.formData.fields.map((field) => {
      let options = null;
      let cssClass = 'mb-0';
      if (REGISTRATION_EXTRA_FIELDS.includes(field.name)) {
        if (!field.required && field.name !== 'honor_code' && field.name !== 'country') {
          REGISTRATION_OPTIONAL_MAP[field.name] = true;
          const props = {
            id: field.name,
            name: field.name,
            type: field.type,
            onChange: e => this.handleOnChange(e),
          };

          if (field.type === 'select') {
            options = field.options.map((item) => ({
              value: item.value,
              label: item.name,
            }));
            props.options = options;
          }
          if (field.name === 'gender') {
            cssClass += ' opt-inline-field';
          }

          if (field.name === 'year_of_birth') {
            cssClass += ' opt-inline-field opt-year-field';
          }

          return (
            <ValidationFormGroup
              for={field.name}
              key={field.name}
              className={cssClass}
            >
              <label htmlFor={field.name} className="h6 pt-10">
                {field.label} {this.props.intl.formatMessage(messages['authn.register.optional.label'])}
              </label>
              <Input {...props} />
            </ValidationFormGroup>
          );
        }
      }
      return null;
    });
    return fields;
  }

  generateUserMessage(isFieldInValid, messageID) {
    return [{ user_message: isFieldInValid ? this.intl.formatMessage(messages[messageID]) : '' }];
  }

  renderThirdPartyAuth(providers, secondaryProviders, currentProvider, thirdPartyAuthApiStatus, intl) {
    let thirdPartyComponent = null;
    if ((providers.length || secondaryProviders.length) && !currentProvider) {
      thirdPartyComponent = (
        <>
          <RenderInstitutionButton
            onSubmitHandler={this.handleInstitutionLogin}
            secondaryProviders={this.props.thirdPartyAuthContext.secondaryProviders}
            buttonTitle={intl.formatMessage(messages['authn.register.institution.login.button'])}
          />
          <div className="row tpa-container">
            <SocialAuthProviders socialAuthProviders={providers} referrer={REGISTER_PAGE} />
          </div>
          <h4 className="d-block mx-auto mt-4">
            {intl.formatMessage(messages['authn.create.a.new.one.here'])}
          </h4>
        </>
      );
    } else if (thirdPartyAuthApiStatus === PENDING_STATE) {
      thirdPartyComponent = <Skeleton height={36} count={2} />;
    }
    return thirdPartyComponent;
  }

  renderErrors() {
    let errorsObject = null;
    if (!this.checkNoValidationsErrors(this.state.validationErrorsAlertMessages)) {
      errorsObject = this.state.validationErrorsAlertMessages;
    } else if (this.props.registrationError) {
      errorsObject = this.props.registrationError;
    } else {
      return null;
    }
    return <RegistrationFailure errors={errorsObject} />;
  }

  render() {
    const { intl, submitState, thirdPartyAuthApiStatus } = this.props;
    const {
      currentProvider, finishAuthUrl, providers, secondaryProviders,
    } = this.props.thirdPartyAuthContext;

    if (!this.props.formData) {
      return <div />;
    }

    if (this.state.institutionLogin) {
      return (
        <InstitutionAuthn
          onSubmitHandler={this.handleInstitutionLogin}
          secondaryProviders={this.props.thirdPartyAuthContext.secondaryProviders}
          headingTitle={intl.formatMessage(messages['authn.register.institution.login.page.title'])}
          buttonTitle={intl.formatMessage(messages['authn.create.an.account'])}
        />
      );
    }

    return (
      <>
        <RedirectAuthn
          success={this.props.registrationResult.success}
          redirectUrl={this.props.registrationResult.redirectUrl}
          finishAuthUrl={finishAuthUrl}
        />
        <div className="d-flex justify-content-center m-4">
          <div className="d-flex flex-column">
            <div className="mw-500">
              {this.renderErrors()}
              {currentProvider && (
                <ThirdPartyAuthAlert
                  currentProvider={currentProvider}
                  platformName={this.props.thirdPartyAuthContext.platformName}
                  referrer="register"
                />
              )}
              <div className="text-left">
                <span>{intl.formatMessage(messages['authn.already.have.an.edx.account'])}</span>
                <a href={LOGIN_PAGE}>{intl.formatMessage(messages['authn.sign.in.hyperlink'])}</a>
              </div>
              {(providers.length || secondaryProviders.length || thirdPartyAuthApiStatus === PENDING_STATE)
                && !currentProvider ? (
                  <div className="d-block mb-4 mt-4">
                    <h4 className="d-block mx-auto mb-4">
                      {intl.formatMessage(messages['authn.create.an.account.using'])}
                    </h4>
                  </div>
                ) : null}
              {this.renderThirdPartyAuth(providers, secondaryProviders, currentProvider, thirdPartyAuthApiStatus, intl)}
              <Form className="mb-4 form-group">
                <ValidationFormGroup
                  for="name"
                  invalid={this.state.errors.name !== ''}
                  invalidMessage={this.state.errors.name}
                  className="mb-0"
                  helpText="This name will be used by any certificates that you earn."
                >
                  <label htmlFor="name" className="h6 pt-10">
                    {intl.formatMessage(messages['authn.fullname.label'])}
                  </label>
                  <Input
                    name="name"
                    id="name"
                    type="text"
                    placeholder=""
                    value={this.state.name}
                    onChange={e => this.handleOnChange(e)}
                    onBlur={e => this.handleOnBlur(e)}
                    onClick={e => this.handleOnClick(e)}
                    required
                  />
                </ValidationFormGroup>
                <ValidationFormGroup
                  for="username"
                  invalid={this.state.errors.username !== ''}
                  invalidMessage={this.state.errors.username}
                  className="mb-0"
                  helpText="The name that will identify you in your courses. It cannot be changed later."
                >
                  <label htmlFor="username" className="h6 pt-10">
                    {intl.formatMessage(messages['authn.username.label'])}
                  </label>
                  <Input
                    name="username"
                    id="username"
                    type="text"
                    placeholder=""
                    value={this.state.username}
                    maxLength="30"
                    onChange={e => this.handleOnChange(e)}
                    onBlur={e => this.handleOnBlur(e)}
                    onClick={e => this.handleOnClick(e)}
                    required
                  />
                </ValidationFormGroup>
                <ValidationFormGroup
                  for="email"
                  invalid={this.state.errors.email !== ''}
                  invalidMessage={this.state.errors.email}
                  className="mb-0"
                  helpText="This is what you will use to login."
                >
                  <label htmlFor="email" className="h6 pt-10">
                    {intl.formatMessage(messages['authn.register.page.email.label'])}
                  </label>
                  <Input
                    name="email"
                    id="email"
                    type="email"
                    placeholder="username@domain.com"
                    value={this.state.email}
                    onChange={e => this.handleOnChange(e)}
                    onBlur={e => this.handleOnBlur(e)}
                    onClick={e => this.handleOnClick(e)}
                    required
                  />
                </ValidationFormGroup>
                {!currentProvider && (
                  <ValidationFormGroup
                    for="password"
                    invalid={this.state.errors.password !== ''}
                    invalidMessage={this.state.errors.password}
                    className="mb-0"
                    helpText="Your password must contain at least 8 characters, including 1 letter & 1 number."
                  >
                    <label htmlFor="password" className="h6 pt-10">
                      {intl.formatMessage(messages['authn.password.label'])}
                    </label>
                    <Input
                      name="password"
                      id="password"
                      type="password"
                      placeholder=""
                      value={this.state.password}
                      onChange={e => this.handleOnChange(e)}
                      onBlur={e => this.handleOnBlur(e)}
                      onClick={e => this.handleOnClick(e)}
                      required
                    />
                  </ValidationFormGroup>
                )}
                { this.addExtraRequiredFields() }
                <ValidationFormGroup
                  for="optional"
                  className="custom-control pt-10 mb-0"
                >
                  <Input
                    name="optional"
                    id="optional"
                    type="checkbox"
                    value={this.state.enableOptionalField}
                    checked={this.state.enableOptionalField}
                    onChange={e => this.handleOnOptional(e)}
                    required
                  />
                  <p role="presentation" id="additionalFields" className="mb-0" onClick={e => this.handleOnOptional(e)}>
                    {intl.formatMessage(messages['authn.support.education.research'])}
                  </p>
                </ValidationFormGroup>
                { this.state.enableOptionalField ? this.addExtraOptionalFields() : null}
                <StatefulButton
                  type="button"
                  className="btn-primary mt-10"
                  state={submitState}
                  labels={{
                    default: intl.formatMessage(messages['authn.create.account.button']),
                  }}
                  onClick={this.handleSubmit}
                />
              </Form>
            </div>
          </div>
        </div>
      </>
    );
  }
}

RegistrationPage.defaultProps = {
  registrationResult: null,
  registerNewUser: null,
  registrationError: null,
  submitState: DEFAULT_STATE,
  thirdPartyAuthApiStatus: 'pending',
  thirdPartyAuthContext: {
    currentProvider: null,
    finishAuthUrl: null,
    providers: [],
    secondaryProviders: [],
    pipelineUserDetails: null,
  },
  formData: null,
  validations: null,
  statusCode: null,
};

RegistrationPage.propTypes = {
  intl: intlShape.isRequired,
  getThirdPartyAuthContext: PropTypes.func.isRequired,
  registerNewUser: PropTypes.func,
  registrationResult: PropTypes.shape({
    redirectUrl: PropTypes.string,
    success: PropTypes.bool,
  }),
  registrationError: PropTypes.shape({
    email: PropTypes.array,
    username: PropTypes.array,
  }),
  submitState: PropTypes.string,
  thirdPartyAuthApiStatus: PropTypes.string,
  thirdPartyAuthContext: PropTypes.shape({
    currentProvider: PropTypes.string,
    platformName: PropTypes.string,
    providers: PropTypes.array,
    secondaryProviders: PropTypes.array,
    finishAuthUrl: PropTypes.string,
    pipelineUserDetails: PropTypes.shape({
      email: PropTypes.string,
      fullname: PropTypes.string,
      firstName: PropTypes.string,
      lastName: PropTypes.string,
      username: PropTypes.string,
    }),
  }),

  fetchRegistrationForm: PropTypes.func.isRequired,
  formData: PropTypes.shape({
    fields: PropTypes.array,
  }),
  fetchRealtimeValidations: PropTypes.func.isRequired,
  validations: PropTypes.shape({
    validation_decisions: PropTypes.shape({
      country: PropTypes.string,
      email: PropTypes.string,
      name: PropTypes.string,
      password: PropTypes.string,
      username: PropTypes.string,
    }),
  }),
  statusCode: PropTypes.number,
};

const mapStateToProps = state => {
  const registrationResult = registrationRequestSelector(state);
  const thirdPartyAuthContext = thirdPartyAuthContextSelector(state);
  return {
    registrationError: state.authn.registrationError,
    submitState: state.authn.submitState,
    thirdPartyAuthApiStatus: state.authn.thirdPartyAuthApiStatus,
    registrationResult,
    thirdPartyAuthContext,
    formData: state.authn.formData,
    validations: state.authn.validations,
    statusCode: state.authn.statusCode,
  };
};

export default connect(
  mapStateToProps,
  {
    getThirdPartyAuthContext,
    fetchRegistrationForm,
    fetchRealtimeValidations,
    registerNewUser,
  },
)(injectIntl(RegistrationPage));
