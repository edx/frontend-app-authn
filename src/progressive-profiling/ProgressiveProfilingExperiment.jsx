import React, { useEffect } from 'react';

import { getConfig } from '@edx/frontend-platform';
import { useDecision } from '@optimizely/react-sdk';

import {
  PP_REDIRECT_EXPERIMENT_KEY,
  PP_REDIRECT_VARIATION_EXPERIMENT,
} from './data/constants';
import ProgressiveProfilingComponent from './ProgressiveProfiling';

const ProgressiveProfilingExperiment = () => {
  const [decision, clientReady] = useDecision(PP_REDIRECT_EXPERIMENT_KEY, {
    autoUpdate: true,
  });

  useEffect(() => {
    if (!clientReady) {
      return;
    }

    if (decision?.variationKey === PP_REDIRECT_VARIATION_EXPERIMENT) {
      const dashboardUrl = getConfig().HOME_URL;
      window.location.assign(dashboardUrl);
    }
  }, [decision, clientReady]);

  // If we have a decision and it's the redirect variant, don't render anything
  if (clientReady && decision?.variationKey === PP_REDIRECT_VARIATION_EXPERIMENT) {
    return null;
  }

  // Default: pass through to the original component (control)
  return <ProgressiveProfilingComponent />;
};
export default ProgressiveProfilingExperiment;
