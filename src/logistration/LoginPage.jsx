import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {
  Button, Input, ValidationFormGroup, ProgressBar,
} from '@edx/paragon';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebookF, faGoogle, faMicrosoft } from '@fortawesome/free-brands-svg-icons';
import { getQueryParameters } from '@edx/frontend-platform';

import { loginRequest, tpaProvidersRequest } from './data/actions';
import { loginRequestSelector, tpaProvidersSelector } from './data/selectors';
import { forgotPasswordResultSelector } from '../forgot-password';
import ConfirmationAlert from './ConfirmationAlert';
import LoginHelpLinks from './LoginHelpLinks';
import InstitutionLogin from './InstitutionLogin';


const LoginRedirect = (props) => {
  const { success, redirectUrl } = props;
  if (success) {
    window.location.href = redirectUrl;
  }
  return <></>;
};

LoginRedirect.defaultProps = {
  redirectUrl: '',
  success: false,
};

LoginRedirect.propTypes = {
  redirectUrl: PropTypes.string,
  success: PropTypes.bool,
};

class LoginPage extends React.Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      password: '',
      email: '',
      errors: {
        email: '',
        password: '',
      },
      emailValid: false,
      passwordValid: false,
      formValid: false,
      institutionLogin: false,
      secondaryProviders: [1, 2, 3],
    };
  }

  componentDidMount() { // use hooks
    this.props.tpaProvidersRequest();
  }

  handleSubmit = (e) => {
    e.preventDefault();
    const params = getQueryParameters();
    const payload = {
      email: this.state.email,
      password: this.state.password,
      next: params.next,
      course_id: params.course_id,
    };
    if (!this.state.formValid) {
      this.validateInput('email', payload.email);
      this.validateInput('password', payload.password);
      return;
    }

    this.props.loginRequest(payload);
  }

  handleInstitutionLogin = () => {
    this.setState({
      institutionLogin: !this.state.institutionLogin,
    });
  }

  validateInput(inputName, value) {
    let { emailValid, passwordValid } = this.state;
    const { errors } = this.state;

    switch (inputName) {
      case 'email':
        emailValid = value.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i);
        errors.email = emailValid ? '' : null;
        break;
      case 'password':
        passwordValid = value.length > 0;
        errors.password = passwordValid ? '' : null;
        break;
      default:
        break;
    }

    this.setState({
      errors,
      emailValid,
      passwordValid,
    }, this.validateForm);
  }

  handleOnChange(e) {
    this.setState({
      [e.target.name]: e.target.value,
    });
    this.validateInput(e.target.name, e.target.value);
  }

  validateForm() {
    const { emailValid, passwordValid } = this.state;
    this.setState({
      formValid: emailValid && passwordValid,
    });
  }

  render() {
    console.log(this.props.providers);
    if (this.state.institutionLogin) {
      return <InstitutionLogin onSubmitHandler={this.handleInstitutionLogin} secondaryProviders={this.props.providers.secondaryProviders} />;
    }
    return (
      <>
        <LoginRedirect success={this.props.loginResult.success} redirectUrl={this.props.loginResult.redirectUrl} />
        <div className="d-flex justify-content-center logistration-container">
          <div className="d-flex flex-column" style={{ width: '400px' }}>
            {this.props.forgotPassword.status === 'complete' ? <ConfirmationAlert email={this.props.forgotPassword.email} /> : null}
            <div className="d-flex flex-row">
              <p>
                First time here?<a className="ml-1" href="/register">Create an Account.</a>
              </p>
            </div>
            <h3 className="text-left mt-3">Sign In</h3>
            <Button
              className="btn-outline-primary submit"
              onClick={this.handleInstitutionLogin}
            >
              Use my university info
            </Button>
            <div className="section-heading-line mb-4">
              <h4>or sign in with</h4>
            </div>
            <form className="m-0">
              <div className="form-group">
                <div className="d-flex flex-column align-items-start">
                  <ValidationFormGroup
                    for="email"
                    invalid={this.state.errors.email !== ''}
                    invalidMessage="The email address you've provided isn't formatted correctly."
                  >
                    <label htmlFor="loginEmail" className="h6 mr-1">Email</label>
                    <Input
                      name="email"
                      id="loginEmail"
                      type="email"
                      placeholder="username@domain.com"
                      value={this.state.email}
                      onChange={e => this.handleOnChange(e)}
                      style={{ width: '400px' }}
                    />
                  </ValidationFormGroup>
                </div>
                <p className="mb-4">The email address you used to register with edX.</p>
                <div className="d-flex flex-column align-items-start">
                  <ValidationFormGroup
                    for="password"
                    invalid={this.state.errors.password !== ''}
                    invalidMessage="Please enter your password."
                    className="mb-0"
                  >
                    <label htmlFor="loginPassword" className="h6 mr-1">Password</label>
                    <Input
                      name="password"
                      id="loginPassword"
                      type="password"
                      value={this.state.password}
                      onChange={e => this.handleOnChange(e)}
                      style={{ width: '400px' }}
                    />
                  </ValidationFormGroup>
                </div>
                <LoginHelpLinks page="login" />
              </div>
              <Button
                className="btn-primary submit"
                onClick={this.handleSubmit}
              >
                Sign in
              </Button>
            </form>
            <div className="section-heading-line mb-4">
              <h4>or sign in with</h4>
            </div>
            <div className="row text-center d-block mb-4">
              <button type="button" className="btn-social facebook"><FontAwesomeIcon className="mr-2" icon={faFacebookF} />Facebook</button>
              <button type="button" className="btn-social google"><FontAwesomeIcon className="mr-2" icon={faGoogle} />Google</button>
              <button type="button" className="btn-social microsoft"><FontAwesomeIcon className="mr-2" icon={faMicrosoft} />Microsoft</button>
            </div>
          </div>
        </div>
      </>
    );
  }
}

LoginPage.defaultProps = {
  loginResult: null,
  forgotPassword: null,
  providers: null
};

LoginPage.propTypes = {
  loginRequest: PropTypes.func.isRequired,
  tpaProvidersRequest: PropTypes.func.isRequired,
  loginResult: PropTypes.shape({
    redirectUrl: PropTypes.string,
    success: PropTypes.bool,
  }),
  providers: PropTypes.shape({
    secondaryProviders: PropTypes.array,
  }),
  forgotPassword: PropTypes.shape({
    email: PropTypes.string,
    status: PropTypes.string,
  }),
};

const mapStateToProps = state => {
  const forgotPassword = forgotPasswordResultSelector(state);
  const loginResult = loginRequestSelector(state);
  const providers = tpaProvidersSelector(state);
  return { forgotPassword, loginResult, providers };
};

export default connect(
  mapStateToProps,
  {
    loginRequest,
    tpaProvidersRequest,
  },
)(LoginPage);
