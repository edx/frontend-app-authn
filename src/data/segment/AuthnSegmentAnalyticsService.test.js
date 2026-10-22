import { SegmentAnalyticsService } from '@edx/frontend-platform/analytics';

import AuthnSegmentAnalyticsService, {
  ANONYMOUS_IDENTIFY_TIMEOUT,
  getQueryStringSegmentUserId,
  getStoredSegmentUserId,
  STALE_USER_ID_TIMEOUT,
} from './AuthnSegmentAnalyticsService';

const createService = (ServiceClass, segmentKey = 'test-key') => new ServiceClass({
  httpClient: { post: jest.fn() },
  loggingService: { logError: jest.fn() },
  config: { LMS_BASE_URL: 'http://localhost:18000', SEGMENT_KEY: segmentKey },
});

// setupTest.js replaces window.location with a URL object.
const setUrl = (path) => { window.location.href = new URL(path, 'https://authn.edx.org').href; };

const queuedMethods = () => global.analytics.map(([method]) => method);

const clearUserIdCookie = () => {
  document.cookie = 'ajs_user_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  document.cookie = 'ajs_user=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
};

const setLegacyUserCookie = (value) => {
  document.cookie = `ajs_user=${encodeURIComponent(JSON.stringify(value))}; path=/`;
};

const readLegacyUserId = () => {
  const cookie = document.cookie.split('; ').find(c => c.startsWith('ajs_user='));
  if (!cookie) {
    return null;
  }
  const value = JSON.parse(decodeURIComponent(cookie.slice('ajs_user='.length)));
  return value && typeof value === 'object' ? value.id : value;
};

/**
 * Loaded analytics.js, mirroring analytics-next 1.84.3's User (core/user/index.ts): the
 * constructor restores the legacy ajs_user cookie's id, id() falls back to that cookie, and
 * reset() does not clear it. Records the user id each page() call is sent under.
 */
const loadAnalytics = ({ userId = null } = {}) => {
  let storedUserId = readLegacyUserId() || userId;
  const id = () => storedUserId || readLegacyUserId() || null;
  const sentPageUserIds = [];
  Object.assign(global.analytics, {
    user: () => ({ id }),
    reset: jest.fn(() => { storedUserId = null; }),
    page: () => { sentPageUserIds.push(id()); },
  });
  return sentPageUserIds;
};

describe('AuthnSegmentAnalyticsService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Segment snippet stub injects a script before the first script element.
    document.body.innerHTML = '<script></script>';
    delete global.analytics;
    delete global.ga;
    delete global.google_tag_manager;
    window.localStorage.clear();
    clearUserIdCookie();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('drops page events in the base service when GA is not loaded within the timeout', async () => {
    const service = createService(SegmentAnalyticsService);
    const identifyPromise = service.identifyAnonymousUser();
    jest.advanceTimersByTime(ANONYMOUS_IDENTIFY_TIMEOUT);
    await identifyPromise;

    const pageSpy = jest.spyOn(global.analytics, 'page');
    service.sendPageEvent('login_and_registration', 'register', { app_name: 'authn_mfe' });

    expect(pageSpy).not.toHaveBeenCalled();
  });

  it('still sends page events when GA is not loaded within the timeout', async () => {
    const service = createService(AuthnSegmentAnalyticsService);
    const identifyPromise = service.identifyAnonymousUser();
    jest.advanceTimersByTime(ANONYMOUS_IDENTIFY_TIMEOUT);
    await identifyPromise;

    const pageSpy = jest.spyOn(global.analytics, 'page');
    service.sendPageEvent('login_and_registration', 'register', { app_name: 'authn_mfe' });

    expect(service.segmentInitialized).toBe(true);
    expect(pageSpy).toHaveBeenCalledWith('login_and_registration', 'register', { app_name: 'authn_mfe' });
  });

  it('resolves immediately when Segment is not configured', async () => {
    const service = createService(AuthnSegmentAnalyticsService, '');

    expect(service.segmentInitialized).toBe(false);
    await expect(service.identifyAnonymousUser()).resolves.toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('resolves when analytics.js is ready and resets a stale user id', async () => {
    const service = createService(AuthnSegmentAnalyticsService);
    loadAnalytics({ userId: 'stale-user' });
    global.analytics.ready = (callback) => callback();

    await service.identifyAnonymousUser();

    expect(global.analytics.reset).toHaveBeenCalled();
    expect(global.analytics.user().id()).toBeNull();
    expect(service.segmentInitialized).toBe(true);
    expect(service.hasIdentifyBeenCalled).toBe(true);
  });

  describe('when a stale user id exists and analytics.js is slow', () => {
    let readyCallback;
    let service;
    let resolved;

    beforeEach(() => {
      window.localStorage.setItem('ajs_user_id', '"12345"');
      service = createService(AuthnSegmentAnalyticsService);
      // Another script (e.g. a GTM tag) queued a track() before our timeout.
      global.analytics.track('Experiment Viewed');
      global.analytics.ready = (callback) => { readyCallback = callback; };
      resolved = false;
      service.identifyAnonymousUser().then(() => { resolved = true; });
      jest.advanceTimersByTime(ANONYMOUS_IDENTIFY_TIMEOUT);
    });

    it('never queues reset() on the stub', async () => {
      await Promise.resolve();
      expect(resolved).toBe(false);
      expect(queuedMethods()).not.toContain('reset');
    });

    it('resets and resolves when analytics.js becomes ready', async () => {
      loadAnalytics({ userId: '12345' });
      readyCallback();
      await Promise.resolve();

      expect(global.analytics.reset).toHaveBeenCalled();
      expect(global.analytics.user().id()).toBeNull();
      expect(resolved).toBe(true);
      expect(service.segmentInitialized).toBe(true);
    });

    it('disables Segment if analytics.js is still not ready after the extra wait', async () => {
      jest.advanceTimersByTime(STALE_USER_ID_TIMEOUT);
      await Promise.resolve();

      expect(resolved).toBe(true);
      expect(service.segmentInitialized).toBe(false);
      expect(queuedMethods()).not.toContain('reset');
    });

    it('still resets the stale user id when analytics.js becomes ready after the extra wait', async () => {
      jest.advanceTimersByTime(STALE_USER_ID_TIMEOUT);
      await Promise.resolve();
      expect(service.segmentInitialized).toBe(false);

      // Other scripts (e.g. the Xpert chatbot) still send through window.analytics.
      loadAnalytics({ userId: '12345' });
      readyCallback();

      expect(global.analytics.reset).toHaveBeenCalled();
      expect(global.analytics.user().id()).toBeNull();
      expect(service.segmentInitialized).toBe(false);
    });
  });

  describe('when only the legacy ajs_user cookie holds a previous user and analytics.js is slow', () => {
    let readyCallback;
    let service;
    let resolved;

    beforeEach(() => {
      setLegacyUserCookie({ id: 'old-user' });
      service = createService(AuthnSegmentAnalyticsService);
      global.analytics.ready = (callback) => { readyCallback = callback; };
      resolved = false;
      service.identifyAnonymousUser().then(() => { resolved = true; });
      jest.advanceTimersByTime(ANONYMOUS_IDENTIFY_TIMEOUT);
    });

    it('does not release events at the timeout', async () => {
      await Promise.resolve();
      expect(resolved).toBe(false);
    });

    it('clears the restored identity that reset() leaves behind, then sends events anonymously', async () => {
      // analytics.js restores old-user from the legacy cookie when it loads.
      const sentPageUserIds = loadAnalytics();
      expect(global.analytics.user().id()).toBe('old-user');

      readyCallback();
      await Promise.resolve();

      expect(global.analytics.reset).toHaveBeenCalled();
      expect(readLegacyUserId()).toBeNull();
      expect(global.analytics.user().id()).toBeNull();
      expect(resolved).toBe(true);
      expect(service.segmentInitialized).toBe(true);

      service.sendPageEvent('login_and_registration', 'register', { app_name: 'authn_mfe' });
      expect(sentPageUserIds).toEqual([null]);
    });

    it('keeps this service disabled when the identity cannot be cleared', async () => {
      const sentPageUserIds = loadAnalytics();
      // e.g. a cookie this page cannot remove.
      global.analytics.user = () => ({ id: () => 'old-user' });

      readyCallback();
      await Promise.resolve();

      expect(resolved).toBe(true);
      expect(service.segmentInitialized).toBe(false);
      service.sendPageEvent('login_and_registration', 'register', { app_name: 'authn_mfe' });
      expect(sentPageUserIds).toEqual([]);
    });
  });

  describe('when the URL has ?ajs_uid= and analytics.js is slow', () => {
    afterEach(() => {
      setUrl('/');
    });

    // Each URL makes analytics-next 1.84.3 identify old-user.
    it.each([
      '/register?ajs_uid=old-user',
      '/register?ajs_uid=&ajs_uid=old-user',
      '/register?ajs_uid=someone&ajs_uid=old-user',
      '/register?ajs%5Fuid=&ajs_uid=old-user',
      '/register?ajs_uid=old-user&ajs%5Fuid=',
      '/register?ajs_uid=old%2Duser',
      '/register#section?ajs_uid=&ajs_uid=old-user',
    ])('does not send the page event under the URL user id (%s)', async (url) => {
      setUrl(url);
      let readyCallback;
      let currentUserId = null;
      const sentPageUserIds = [];
      const service = createService(AuthnSegmentAnalyticsService);
      global.analytics.ready = (callback) => { readyCallback = callback; };
      let resolved = false;
      service.identifyAnonymousUser().then(() => { resolved = true; });

      jest.advanceTimersByTime(ANONYMOUS_IDENTIFY_TIMEOUT);
      await Promise.resolve();
      // Storage is empty, but events must not be released yet.
      expect(resolved).toBe(false);

      // analytics-next load order: flushQueryString identifies ajs_uid, then queued calls
      // (including our ready callback) are replayed.
      currentUserId = 'old-user';
      global.analytics = {
        user: () => ({ id: () => currentUserId }),
        reset: () => { currentUserId = null; },
        page: () => { sentPageUserIds.push(currentUserId); },
      };
      readyCallback();
      await Promise.resolve();
      expect(resolved).toBe(true);

      service.sendPageEvent('login_and_registration', 'register', { app_name: 'authn_mfe' });
      expect(sentPageUserIds).toEqual([null]);
    });

    it('disables Segment if analytics.js is still not ready after the extra wait', async () => {
      setUrl('/register?ajs_uid=old-user');
      const service = createService(AuthnSegmentAnalyticsService);
      global.analytics.ready = () => {};
      const identifyPromise = service.identifyAnonymousUser();
      jest.advanceTimersByTime(ANONYMOUS_IDENTIFY_TIMEOUT + STALE_USER_ID_TIMEOUT);
      await identifyPromise;

      expect(service.segmentInitialized).toBe(false);
    });

    // analytics-next 1.84.3 identifies no one for these URLs, so there is nothing to wait for.
    it.each([
      '/register?ajs_uid=old-user&ajs_uid=',
      '/register?ajs_uid=old-user&ajs_uid',
      '/register?ajs%5Fuid=old-user',
    ])('releases events at the timeout when analytics.js will not identify anyone (%s)', async (url) => {
      setUrl(url);
      const service = createService(AuthnSegmentAnalyticsService);
      global.analytics.ready = () => {};
      const identifyPromise = service.identifyAnonymousUser();
      jest.advanceTimersByTime(ANONYMOUS_IDENTIFY_TIMEOUT);
      await identifyPromise;

      expect(service.segmentInitialized).toBe(true);
    });
  });

  it('does not reset the anonymous id when there is no stale user id', async () => {
    const service = createService(AuthnSegmentAnalyticsService);
    const identifyPromise = service.identifyAnonymousUser();
    jest.advanceTimersByTime(ANONYMOUS_IDENTIFY_TIMEOUT);
    await identifyPromise;

    expect(queuedMethods()).not.toContain('reset');
  });

  it('does not reset when analytics.js becomes ready after the timeout already resolved', async () => {
    let readyCallback;
    const service = createService(AuthnSegmentAnalyticsService);
    global.analytics.ready = (callback) => { readyCallback = callback; };
    const identifyPromise = service.identifyAnonymousUser();
    jest.advanceTimersByTime(ANONYMOUS_IDENTIFY_TIMEOUT);
    await identifyPromise;
    service.sendPageEvent('login_and_registration', 'register', { app_name: 'authn_mfe' });

    // analytics.js loads late and now reports a user id (e.g. one set by another script).
    const reset = jest.fn();
    global.analytics.user = () => ({ id: () => 'late-user' });
    global.analytics.reset = reset;
    readyCallback();

    expect(reset).not.toHaveBeenCalled();
  });

  it('disables segment when analytics.js fails to load', async () => {
    const service = createService(AuthnSegmentAnalyticsService);
    const identifyPromise = service.identifyAnonymousUser();
    document.querySelector('script[src*="cdn.segment.com"]').onerror();
    await identifyPromise;

    expect(service.segmentInitialized).toBe(false);
  });
});

describe('getStoredSegmentUserId', () => {
  beforeEach(() => {
    global.analytics = [];
    window.localStorage.clear();
    clearUserIdCookie();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads a JSON-encoded id from localStorage', () => {
    window.localStorage.setItem('ajs_user_id', '"12345"');
    expect(getStoredSegmentUserId()).toBe('12345');
  });

  it.each(['null', '""', ''])('returns null for a stored value of %p', (value) => {
    window.localStorage.setItem('ajs_user_id', value);
    document.cookie = `ajs_user_id=${encodeURIComponent(value)}; path=/`;
    expect(getStoredSegmentUserId()).toBeNull();
  });

  it('treats a stored "null" as no user id (resolves at the timeout, no extra wait)', async () => {
    jest.useFakeTimers();
    document.body.innerHTML = '<script></script>';
    delete global.analytics;
    window.localStorage.setItem('ajs_user_id', 'null');
    const service = createService(AuthnSegmentAnalyticsService);
    const identifyPromise = service.identifyAnonymousUser();
    jest.advanceTimersByTime(ANONYMOUS_IDENTIFY_TIMEOUT);
    await identifyPromise;
    jest.useRealTimers();

    expect(service.segmentInitialized).toBe(true);
    expect(queuedMethods()).not.toContain('reset');
  });

  it('falls back to the cookie, raw or JSON-encoded', () => {
    document.cookie = 'ajs_user_id=12345; path=/';
    expect(getStoredSegmentUserId()).toBe('12345');
    document.cookie = `ajs_user_id=${encodeURIComponent('"67890"')}; path=/`;
    expect(getStoredSegmentUserId()).toBe('67890');
  });

  // setupTest.js replaces window.localStorage with a plain object, so spy on it directly
  // (Storage.prototype is never reached).
  it('falls back to the cookie when localStorage throws', () => {
    const getItem = jest.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    document.cookie = 'ajs_user_id=12345; path=/';
    expect(getStoredSegmentUserId()).toBe('12345');
    expect(getItem).toHaveBeenCalledWith('ajs_user_id');
  });

  it('returns null when localStorage and cookies both throw', () => {
    const getItem = jest.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const cookie = jest.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(getStoredSegmentUserId()).toBeNull();
    expect(getItem).toHaveBeenCalledWith('ajs_user_id');
    expect(cookie).toHaveBeenCalled();
  });

  it('uses analytics.user() once analytics.js has loaded', () => {
    global.analytics = { user: () => ({ id: () => 'loaded-user' }) };
    expect(getStoredSegmentUserId()).toBe('loaded-user');
  });

  // analytics-next 1.84.3 User.id() falls back to the legacy cookie: the object's id, else the value.
  it.each([
    ['an object with an id', { id: 'old-user', traits: { name: 'Old' } }, 'old-user'],
    ['a numeric id', { id: 42 }, '42'],
    ['a bare string', 'old-user', 'old-user'],
    ['an object without an id', { traits: {} }, null],
    ['an object with a null id', { id: null }, null],
  ])('reads the legacy ajs_user cookie holding %s', (_, value, expected) => {
    setLegacyUserCookie(value);
    expect(getStoredSegmentUserId()).toBe(expected);
  });

  it('falls back to the legacy cookie when ajs_user_id is "null"', () => {
    document.cookie = 'ajs_user_id=null; path=/';
    setLegacyUserCookie({ id: 'old-user' });
    expect(getStoredSegmentUserId()).toBe('old-user');
  });
});

describe('getQueryStringSegmentUserId', () => {
  afterEach(() => {
    setUrl('/');
  });

  it('reads ajs_uid from the query string', () => {
    setUrl('/register?next=%2Fdashboard&ajs_uid=old-user');
    expect(getQueryStringSegmentUserId()).toBe('old-user');
  });

  it('reads ajs_uid from the hash when there is no query string', () => {
    setUrl('/register#section?ajs_uid=old-user');
    expect(getQueryStringSegmentUserId()).toBe('old-user');
  });

  it('returns null when ajs_uid is missing or empty', () => {
    setUrl('/register?ajs_aid=anon');
    expect(getQueryStringSegmentUserId()).toBeNull();
    setUrl('/register?ajs_uid=');
    expect(getQueryStringSegmentUserId()).toBeNull();
  });

  // Expected values follow analytics-next 1.84.3 core/query-string/index.ts.
  it.each([
    ['last value wins over an earlier empty one', '/register?ajs_uid=&ajs_uid=old-user', 'old-user'],
    ['last value wins over an earlier id', '/register?ajs_uid=someone&ajs_uid=old-user', 'old-user'],
    ['a later empty value wins', '/register?ajs_uid=old-user&ajs_uid=', null],
    ['a later key with no value wins', '/register?ajs_uid=old-user&ajs_uid', null],
    ['a percent-encoded key is not ajs_uid', '/register?ajs%5Fuid=old-user', null],
    ['a percent-encoded key does not hide ajs_uid', '/register?ajs%5Fuid=&ajs_uid=old-user', 'old-user'],
    ['a percent-encoded key after ajs_uid is ignored', '/register?ajs_uid=old-user&ajs%5Fuid=', 'old-user'],
    ['the value is percent-decoded', '/register?ajs_uid=old%2Duser', 'old-user'],
    ['+ in the value decodes to a space', '/register?ajs_uid=old+user', 'old user'],
    ['a malformed value is kept as-is', '/register?ajs_uid=old%ZZuser', 'old%ZZuser'],
    ['the value stops at a second =', '/register?ajs_uid=old-user=x', 'old-user'],
    ['repeated keys in the hash', '/register#section?ajs_uid=&ajs_uid=old-user', 'old-user'],
  ])('%s', (_, url, expected) => {
    setUrl(url);
    expect(getQueryStringSegmentUserId()).toBe(expected);
  });
});
