import React from 'react';
import PropTypes from 'prop-types';

import { injectIntl, intlShape } from '@edx/frontend-platform/i18n';
import { getConfig } from '@edx/frontend-platform';

import messages from './messages';

const SmallScreenLayout = (props) => {
  const { intl, children } = props;

  return (
    <div>
      <div className="small-screen-top-header" />
      <div className="small-screen-background">
        <img alt="edx" className="logo" src={getConfig().LOGO_WHITE_URL} />
        <div className="d-flex mt-3">
          <div className="pl-3">
            <svg className="h-70 w-4 mt-1">
              <path d="M50 -15L3 215" className="svg-path" />
            </svg>
          </div>
          <div className="pl-3">
            <h1 className="text-white font-size-36 line-height-40">
              {intl.formatMessage(messages['start.learning'])}
              <br />
              <span className="text-accent-a">
                {intl.formatMessage(messages['with.edx'])}
              </span>
            </h1>
          </div>
        </div>
      </div>
      <div>
        { children }
      </div>
    </div>
  );
};

SmallScreenLayout.propTypes = {
  intl: intlShape.isRequired,
  children: PropTypes.node.isRequired,
};

export default injectIntl(SmallScreenLayout);
