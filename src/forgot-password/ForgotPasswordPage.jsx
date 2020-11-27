import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';
import { Input, StatefulButton, ValidationFormGroup } from '@edx/paragon';
import { injectIntl, intlShape } from '@edx/frontend-platform/i18n';

import messages from './messages';
import { forgotPassword } from './data/actions';
import { forgotPasswordResultSelector } from './data/selectors';
import RequestInProgressAlert from './RequestInProgressAlert';
import { LOGIN_PAGE } from '../data/constants';
import LoginHelpLinks from '../logistration/LoginHelpLinks';

const ForgotPasswordPage = (props) => {
  const { intl, status } = props;
  const [emailInput, setEmailValue] = useState('');
  const [emailValid, setEmailValidValue] = useState(true);

  const validateEmail = (email) => {
    const isEmailValid = email.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i);
    setEmailValidValue(isEmailValid !== null);
  };

  const handleOnChange = (e) => {
    const emailValue = e.target.value;
    setEmailValue(emailValue);
    validateEmail(emailValue);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (emailInput === '') {
      setEmailValidValue(false);
    }
    if (emailValid && emailInput !== '') {
      props.forgotPassword(emailInput);
    }
  };

  return (
    <>
      {status === 'complete' ? <Redirect to={LOGIN_PAGE} /> : null}
      <div className="d-flex justify-content-center forgot-password-container">
        <div className="d-flex flex-column" style={{ width: '450px' }}>
          <form className="m-4">
            <div className="form-group">
              {status === 'forbidden' ? <RequestInProgressAlert /> : null}
              <h3 className="text-center mt-3">
                {intl.formatMessage(messages['logisration.forgot.password.page.heading'])}
              </h3>
              <p className="mb-4">
                {intl.formatMessage(messages['logisration.forgot.password.page.instructions'])}
              </p>
              <div className="d-flex flex-column align-items-start">
                <ValidationFormGroup
                  className="mb-0"
                  for="email"
                  invalid={!emailValid}
                  invalidMessage={intl.formatMessage(
                    messages['logisration.forgot.password.page.invalid.email.message'],
                  )}
                >
                  <label htmlFor="forgot-password-input" className="h6 mr-1">
                    {intl.formatMessage(messages['logisration.forgot.password.page.email.field.label'])}
                  </label>
                  <Input
                    name="email"
                    id="forgot-password-input"
                    type="email"
                    placeholder="username@domain.com"
                    value={emailInput}
                    onChange={e => handleOnChange(e)}
                    style={{ width: '400px' }}
                  />
                </ValidationFormGroup>
              </div>
              <p className="mb-2">
                {intl.formatMessage(messages['logisration.forgot.password.page.email.field.help.text'])}
              </p>
              <LoginHelpLinks page="forgot-password" />
            </div>
            <StatefulButton
              type="submit"
              className="btn-primary submit"
              state={status}
              labels={{
                default: intl.formatMessage(messages['logisration.forgot.password.page.submit.button']),
              }}
              onClick={e => handleSubmit(e)}
            />
          </form>
        </div>
      </div>
    </>
  );
};

ForgotPasswordPage.propTypes = {
  intl: intlShape.isRequired,
  forgotPassword: PropTypes.func.isRequired,
  status: PropTypes.string,
};

ForgotPasswordPage.defaultProps = {
  status: null,
};

export default connect(
  forgotPasswordResultSelector,
  {
    forgotPassword,
  },
)(injectIntl(ForgotPasswordPage));
