import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { OptimizelyProvider } from '@optimizely/react-sdk';
import PropTypes from 'prop-types';

import optimizelyClient from '../data/optimizely';

const OptimizelyProviderWrapper = ({
  defaultComponent: DefaultComponent,
  experimentalComponent: ExperimentalComponent,
  userId = null,
  ...props
}) => {
  const authUserId = getAuthenticatedUser()?.userId;
  const resolvedUserId = userId ?? authUserId;

  if (!optimizelyClient || !resolvedUserId) {
    return <DefaultComponent {...props} />;
  }

  return (
    <OptimizelyProvider
      optimizely={optimizelyClient}
      user={{
        id: resolvedUserId.toString(),
      }}
    >
      <ExperimentalComponent {...props} />
    </OptimizelyProvider>
  );
};

OptimizelyProviderWrapper.propTypes = {
  defaultComponent: PropTypes.elementType.isRequired,
  experimentalComponent: PropTypes.elementType.isRequired,
  userId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

export default OptimizelyProviderWrapper;
