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
      const homeUrl = getConfig().HOME_URL;
      if (!homeUrl || homeUrl === 'null') {
        return;
      }
      const dashboardUrl = new URL('/welcome', homeUrl).toString();
      window.location.assign(dashboardUrl);
    }
  }, [decision, clientReady]);

  // Also wait for Optimizely client readiness before rendering the control component,
  // to avoid triggering ProgressiveProfiling's own redirect logic prematurely.
  if (!clientReady) {
    return null;
  }

  if (decision?.variationKey === PP_REDIRECT_VARIATION_EXPERIMENT) {
    return null;
  }

  // Default: pass through to the original component (control)
  return <ProgressiveProfilingComponent />;
};
export default ProgressiveProfilingExperiment;
