import { SegmentAnalyticsService } from '@edx/frontend-platform/analytics';

export const ANONYMOUS_IDENTIFY_TIMEOUT = 2000;
// Extra wait for analytics.js, only when a previous user's id must be reset first.
export const STALE_USER_ID_TIMEOUT = 5000;

const SEGMENT_USER_ID_KEY = 'ajs_user_id';

/**
 * Parses a value persisted by analytics.js the same way analytics.js reads it back:
 * JSON.parse, falling back to the raw string. Returns null for missing, empty or "null" values.
 */
const parseStoredUserId = (raw) => {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch (e) {
    value = raw;
  }
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return String(value);
};

/**
 * Returns the Segment user id persisted by analytics.js, even before analytics.js has loaded
 * (the snippet stub has no user() method). analytics.js stores it JSON-encoded in localStorage
 * and as a cookie. Storage access can throw (e.g. Safari private mode, blocked site data).
 */
export const getStoredSegmentUserId = () => {
  if (typeof global.analytics?.user === 'function') {
    try {
      return global.analytics.user().id() || null;
    } catch (e) {
      return null;
    }
  }

  try {
    const userId = parseStoredUserId(global.localStorage.getItem(SEGMENT_USER_ID_KEY));
    if (userId) {
      return userId;
    }
  } catch (e) {
    // localStorage unavailable; fall back to the cookie.
  }

  try {
    const cookie = document.cookie.split('; ').find(c => c.startsWith(`${SEGMENT_USER_ID_KEY}=`));
    if (cookie) {
      return parseStoredUserId(decodeURIComponent(cookie.slice(SEGMENT_USER_ID_KEY.length + 1)));
    }
  } catch (e) {
    // Cookies unavailable.
  }

  return null;
};

/**
 * Returns the user id passed as ?ajs_uid=, which analytics.js identifies (Segment's querystring
 * API) before replaying calls queued on the snippet stub. Like analytics.js, reads the hash's
 * query string when the URL has no search part.
 */
export const getQueryStringSegmentUserId = () => {
  try {
    const { search, hash } = global.location;
    const queryString = search || hash.replace(/(?=#).*(?=\?)/, '');
    return new URLSearchParams(queryString).get('ajs_uid') || null;
  } catch (e) {
    return null;
  }
};

const hasPreviousSegmentIdentity = () => !!(getStoredSegmentUserId() || getQueryStringSegmentUserId());

/**
 * Replaces SegmentAnalyticsService.identifyAnonymousUser from @edx/frontend-platform, which
 * disables Segment (segmentInitialized = false) if Google Analytics / GTM globals are not present
 * 2 seconds after it is called. Every page/track event sent after that point is silently dropped,
 * so slow page loads and users blocking GA (but not Segment) never send the /register page event
 * (AUT-345).
 *
 * History of that timer in openedx/frontend-platform:
 *  - #209: added a 2s timer that disabled Segment, to fix a blank page when Segment is blocked.
 *  - #222: removed the timer ("events not firing for anonymous users", the same bug as AUT-345)
 *          and used a 'segmentFailed' event instead.
 *  - #234: re-added the timer with a Google Analytics check, to fix a blank page when GA is blocked.
 *  - #264: added the GTM check, to fix a blank page when GTM is blocked.
 *
 * This service keeps the 2s fallback, but leaves Segment enabled. Events sent before analytics.js
 * has loaded are queued by the snippet stub and replayed once it loads. If analytics.js itself
 * fails to load, the parent class's 'segmentFailed' handler still disables Segment.
 *
 * A previous user's id must be reset before any event is sent. reset() is never queued on the
 * stub: analytics.js replays queued calls grouped by method, so a track() queued earlier by
 * another script (e.g. a GTM tag) would put all track() calls ahead of the reset. Instead, when a
 * previous identity exists (a stored user id, or ?ajs_uid= which analytics.js applies before
 * replaying queued calls), we keep waiting for ready() (which resets), as the parent class does,
 * for at most STALE_USER_ID_TIMEOUT before disabling this service.
 *
 * Delete this class once the timer is fixed upstream. Until then, re-check
 * SegmentAnalyticsService.identifyAnonymousUser on every @edx/frontend-platform upgrade, since
 * this override relies on its internals (segmentInitialized, hasIdentifyBeenCalled).
 */
class AuthnSegmentAnalyticsService extends SegmentAnalyticsService {
  identifyAnonymousUser() {
    if (!this.segmentInitialized) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let isReady = false;
      // Set when the timeout lets the app send events with Segment enabled. After that, a user
      // id can only come from the visitor authenticating, which must not be reset, and a reset
      // would also change anonymous_id mid-visit.
      let areEventsReleased = false;

      global.analytics.ready(() => {
        isReady = true;
        // Reset any user id left over from a previous authenticated session. This also runs
        // after the stale-identity fallback below has disabled this service, because other
        // scripts can still send events through window.analytics.
        if (!areEventsReleased && global.analytics.user().id()) {
          global.analytics.reset();
        }
        this.hasIdentifyBeenCalled = true;
        resolve();
      });

      document.addEventListener('segmentFailed', resolve);

      setTimeout(() => {
        if (isReady) {
          return;
        }
        if (hasPreviousSegmentIdentity()) {
          setTimeout(() => {
            if (isReady) {
              return;
            }
            // Drop events rather than attribute them to the previous user.
            this.segmentInitialized = false;
            resolve();
          }, STALE_USER_ID_TIMEOUT);
          return;
        }
        areEventsReleased = true;
        // Segment assigns an anonymousId on load, so queued page/track calls are valid
        // without an explicit identify.
        this.hasIdentifyBeenCalled = true;
        resolve();
      }, ANONYMOUS_IDENTIFY_TIMEOUT);
    });
  }
}

export default AuthnSegmentAnalyticsService;
