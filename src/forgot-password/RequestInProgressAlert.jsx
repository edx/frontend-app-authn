import React from 'react';
import { FormattedMessage } from '@edx/frontend-platform/i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { Alert } from '@edx/paragon';

const RequestInProgressAlert = () => (
  <Alert variant="warning">
    <FontAwesomeIcon className="mr-2" icon={faExclamationTriangle} />
    <FormattedMessage
      id="authn.forgot.password.request.inprogress.message"
      defaultMessage="Your previous request is still in progress, please try again in a few moments."
      description="A message displayed when a previous password reset request is still in progress."
    />
  </Alert>
);

export default RequestInProgressAlert;
