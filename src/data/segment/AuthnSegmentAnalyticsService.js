import { SegmentAnalyticsService } from '@edx/frontend-platform/analytics';

export const ANONYMOUS_IDENTIFY_TIMEOUT = 2000;
// Extra wait for analytics.js, only when a previous user's id must be reset first.
export const STALE_USER_ID_TIMEOUT = 5000;

const SEGMENT_USER_ID_KEY = 'ajs_user_id';
// Legacy analytics.js cookie ({"id": ..., "traits": ...}). In analytics-next 1.84.3 the User
// constructor restores its id, User.id() falls back to it, and User.reset() does not clear it
// (core/user/index.ts).
const SEGMENT_LEGACY_USER_KEY = 'ajs_user';

const readCookie = (name) => {
  const cookie = document.cookie.split('; ').find(c => c.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
};

/**
 * Removes a cookie for this host and every parent domain, since analytics.js sets its cookies on
 * the top-level domain it can write to (e.g. .edx.org).
 */
const removeCookie = (name) => {
  const labels = global.location.hostname.split('.');
  const domains = labels.map((_, i) => labels.slice(i).join('.')).filter(domain => domain.includes('.'));
  [null, ...domains].forEach((domain) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ''}`;
  });
};

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
 * Parses the legacy ajs_user cookie as User.id() reads it back: the object's id, or the value
 * itself when it is not an object. Returns null when there is no id.
 */
const parseLegacyUserId = (raw) => {
  if (raw === null || raw === '') {
    return null;
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch (e) {
    value = raw;
  }
  const userId = value && typeof value === 'object' ? value.id : value;
  return userId ? String(userId) : null;
};

/**
 * Returns the Segment user id persisted by analytics.js, even before analytics.js has loaded
 * (the snippet stub has no user() method). analytics.js stores it JSON-encoded in localStorage
 * and as a cookie, and restores it from the legacy ajs_user cookie. Storage access can throw
 * (e.g. Safari private mode, blocked site data).
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
    return parseStoredUserId(readCookie(SEGMENT_USER_ID_KEY))
      || parseLegacyUserId(readCookie(SEGMENT_LEGACY_USER_KEY));
  } catch (e) {
    // Cookies unavailable.
  }

  return null;
};

/**
 * Clears a previous user's identity once analytics.js is ready. reset() in analytics-next 1.84.3
 * leaves the legacy ajs_user cookie, which User.id() falls back to, so that cookie is removed too.
 * Returns whether the user id is now empty.
 */
const resetSegmentIdentity = () => {
  global.analytics.reset();
  if (global.analytics.user().id()) {
    try {
      removeCookie(SEGMENT_LEGACY_USER_KEY);
    } catch (e) {
      // Cookies unavailable; checked below.
    }
  }
  return !global.analytics.user().id();
};

/**
 * Returns the user id that analytics.js will identify from ?ajs_uid= (Segment's querystring API)
 * before replaying calls queued on the snippet stub, or null when it will identify none.
 *
 * Parses the URL exactly as analytics-next 1.84.3 does (browser/index.ts getQueryString,
 * core/query-string/index.ts queryString), because any difference lets a URL identity through
 * unreset. URLSearchParams differs: it returns the first of repeated keys and decodes keys.
 *  - the query string, or the hash's when there is none, normalised through an <a> element;
 *  - keys are compared raw (ajs%5Fuid is not ajs_uid);
 *  - for a repeated key, the last value wins;
 *  - the value is the text between the first and second '=';
 *  - values are decoded with '+' as a space, and kept as-is when malformed;
 *  - an empty value identifies no one (frontend-platform loads Segment without a uid pattern).
 */
export const getQueryStringSegmentUserId = () => {
  try {
    const { search, hash } = global.location;
    const queryString = search.length ? search : hash.replace(/(?=#).*(?=\?)/, '');
    if (!queryString.includes('ajs_')) {
      return null;
    }
    const link = document.createElement('a');
    link.href = queryString;
    const rawUserId = link.search.slice(1).split('&').reduce((userId, parameter) => {
      const [key, value] = parameter.split('=');
      return key === 'ajs_uid' ? value : userId;
    }, undefined);
    if (rawUserId === undefined) {
      return null;
    }
    let userId;
    try {
      userId = decodeURIComponent(rawUserId.replace(/\+/g, ' '));
    } catch (e) {
      userId = rawUserId;
    }
    return userId || null;
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
 * previous identity exists (a stored user id, the legacy ajs_user cookie, or ?ajs_uid= which
 * analytics.js applies before replaying queued calls), we keep waiting for ready() (which resets),
 * as the parent class does, for at most STALE_USER_ID_TIMEOUT before disabling this service. After
 * the reset the user id is checked again; if it can't be cleared, this service stays disabled.
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
        if (!areEventsReleased && global.analytics.user().id() && !resetSegmentIdentity()) {
          // Never send this service's events under a previous user's id.
          this.segmentInitialized = false;
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
