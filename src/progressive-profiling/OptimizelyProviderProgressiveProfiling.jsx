import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { OptimizelyProvider } from '@optimizely/react-sdk';

import ProgressiveProfilingExperiment from './ProgressiveProfilingExperiment';
import optimizelyClient from '../data/optimizely';

const OptimizelyProviderProgressiveProfiling = () => {
  const { userId } = getAuthenticatedUser() ?? {};

  return (
    <OptimizelyProvider
      optimizely={optimizelyClient}
      user={{
        id: userId?.toString(),
      }}
    >
      <ProgressiveProfilingExperiment />
    </OptimizelyProvider>
  );
};
export default OptimizelyProviderProgressiveProfiling;
