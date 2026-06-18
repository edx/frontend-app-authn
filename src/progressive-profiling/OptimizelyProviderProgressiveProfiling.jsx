import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { OptimizelyProvider } from '@optimizely/react-sdk';

import ProgressiveProfilingExperiment from './ProgressiveProfilingExperiment';
import optimizelyClient from '../data/optimizely';

const OptimizelyProviderProgressiveProfiling = () => {
  const user = getAuthenticatedUser();

  return (
    <OptimizelyProvider
      optimizely={optimizelyClient}
      user={{ id: user?.id ? String(user.id) : undefined }}
    >
      <ProgressiveProfilingExperiment />
    </OptimizelyProvider>
  );
};
export default OptimizelyProviderProgressiveProfiling;
