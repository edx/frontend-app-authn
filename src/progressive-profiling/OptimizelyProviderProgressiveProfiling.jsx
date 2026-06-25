import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { OptimizelyProvider } from '@optimizely/react-sdk';
import { useLocation } from 'react-router-dom';

import ProgressiveProfiling from './ProgressiveProfiling';
import ProgressiveProfilingExperiment from './ProgressiveProfilingExperiment';
import optimizelyClient from '../data/optimizely';

const OptimizelyProviderProgressiveProfiling = () => {
  const location = useLocation();
  const authenticatedUser = getAuthenticatedUser() || location.state?.authenticatedUser;
  const userId = authenticatedUser?.userId;

  // If Optimizely isn't configured (or we can't identify the user), fall back to control behavior.
  if (!optimizelyClient || !userId) {
    return <ProgressiveProfiling />;
  }

  return (
    <OptimizelyProvider
      optimizely={optimizelyClient}
      user={{
        id: userId.toString(),
      }}
    >
      <ProgressiveProfilingExperiment />
    </OptimizelyProvider>
  );
};
export default OptimizelyProviderProgressiveProfiling;
