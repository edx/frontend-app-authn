import React, { useEffect } from 'react';

import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { useDecision } from '@optimizely/react-sdk';
import { useLocation } from 'react-router-dom';

import {
  PP_REDIRECT_EXPERIMENT_KEY,
  PP_REDIRECT_VARIATION_EXPERIMENT,
} from './data/constants';
import ProgressiveProfilingComponent from './ProgressiveProfiling';
import { isHostAvailableInQueryParams } from '../data/utils';

const ProgressiveProfilingExperiment = () => {
  const location = useLocation();
  const [decision, clientReady, didTimeout] = useDecision(PP_REDIRECT_EXPERIMENT_KEY, {
    autoUpdate: true,
  });
  const authenticatedUser = getAuthenticatedUser() || location.state?.authenticatedUser;
  const registrationEmbedded = isHostAvailableInQueryParams();
  const hasWelcomeFlowContext = !!(location.state?.registrationResult || registrationEmbedded);
  const canApplyExperimentRedirect = !!(authenticatedUser && hasWelcomeFlowContext);
  const homeUrl = getConfig().HOME_URL;
  const normalizedHomeUrl = homeUrl === 'null' ? '' : homeUrl;
  const shouldRedirectToWelcome = (
    clientReady
    && decision?.variationKey === PP_REDIRECT_VARIATION_EXPERIMENT
    && canApplyExperimentRedirect
    && !!normalizedHomeUrl
  );

  useEffect(() => {
    if (!shouldRedirectToWelcome) {
      return;
    }

    const dashboardUrl = new URL('/welcome', normalizedHomeUrl).toString();
    window.location.assign(dashboardUrl);
  }, [normalizedHomeUrl, shouldRedirectToWelcome]);

   // If there's no welcome-flow context, render ProgressiveProfiling immediately (preserving redirects).
   // Otherwise, wait for Optimizely readiness to avoid rendering it too early during the welcome flow.
  if ((!clientReady && !hasWelcomeFlowContext) || didTimeout) {
    return <ProgressiveProfilingComponent />;
  }

  if (!clientReady) {
    return null;
  }

  if (shouldRedirectToWelcome) {
    return null;
  }

  // Default: pass through to the original component (control)
  return <ProgressiveProfilingComponent />;
};
export default ProgressiveProfilingExperiment;
