import React from 'react';
import { injectIntl, intlShape } from '@edx/frontend-platform/i18n';
import { getConfig } from '@edx/frontend-platform';
import PropTypes from 'prop-types';
import { Button, Hyperlink } from '@edx/paragon';
import messages from './messages';

export const RenderInstitutionButton = props => {
  const { onSubmitHandler, secondaryProviders, buttonTitle } = props;
  if (secondaryProviders !== undefined && secondaryProviders.length > 0) {
    return (
      <Button
        className="mt-2"
        block
        variant="outline-primary"
        onClick={onSubmitHandler}
      >
        {buttonTitle}
      </Button>
    );
  }
  return <></>;
};

const InstitutionAuthn = props => {
  const lmsBaseUrl = getConfig().LMS_BASE_URL;
  const {
    intl,
    onSubmitHandler,
    secondaryProviders,
    headingTitle,
    buttonTitle,
  } = props;

  return (
    <>
      <div className="d-flex justify-content-center m-4">
        <div className="flex-column">
          <h1 className="mt-5 mb-4 font-weight-normal">
            {headingTitle}
          </h1>
          <p className="mb-2">
            {intl.formatMessage(messages['authn.institution.login.page.sub.heading'])}
          </p>
          <div className="mb-2 ml-2">
            <ul>
              {secondaryProviders.map(provider => (
                <li key={provider}>
                  <Hyperlink destination={lmsBaseUrl + provider.loginUrl}>{provider.name}</Hyperlink>
                </li>
              ))}
            </ul>
          </div>
          <div className="mb-4">
            <h4>or</h4>
          </div>
          <Button
            variant="primary"
            onClick={onSubmitHandler}
          >
            {buttonTitle}
          </Button>
        </div>
      </div>
    </>
  );
};

const AuthnDefaultProps = {
  secondaryProviders: [],
  buttonTitle: '',
};
const AuthnProps = {
  onSubmitHandler: PropTypes.func.isRequired,
  secondaryProviders: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequried,
    loginUrl: PropTypes.string.isRequired,
  })),
  buttonTitle: PropTypes.string,
};

RenderInstitutionButton.propTypes = {
  ...AuthnProps,
};
RenderInstitutionButton.defaultProps = {
  ...AuthnDefaultProps,
};

InstitutionAuthn.propTypes = {
  ...AuthnProps,
  intl: intlShape.isRequired,
  headingTitle: PropTypes.string,
};
InstitutionAuthn.defaultProps = {
  ...AuthnDefaultProps,
  headingTitle: '',
};

export default injectIntl(InstitutionAuthn);
