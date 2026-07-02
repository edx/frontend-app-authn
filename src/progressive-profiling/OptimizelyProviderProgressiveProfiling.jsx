import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { useLocation } from 'react-router-dom';

import ProgressiveProfiling from './ProgressiveProfiling';
import ProgressiveProfilingExperiment from './ProgressiveProfilingExperiment';
import OptimizelyProviderWrapper from '../optimizely/OptimizelyProviderWrapper';

const OptimizelyProviderProgressiveProfiling = () => {
  const location = useLocation();
  const authenticatedUser = getAuthenticatedUser() || location.state?.authenticatedUser;
  const fallbackUserId = authenticatedUser?.userId;

  return (
    <OptimizelyProviderWrapper
      defaultComponent={ProgressiveProfiling}
      experimentalComponent={ProgressiveProfilingExperiment}
      userId={fallbackUserId}
    />
  );
};
export default OptimizelyProviderProgressiveProfiling;
