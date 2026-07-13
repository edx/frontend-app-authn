import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { useDecision } from '@optimizely/react-sdk';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ProgressiveProfilingExperiment from '../ProgressiveProfilingExperiment';

jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn(),
}));

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@optimizely/react-sdk', () => ({
  useDecision: jest.fn(),
}));

jest.mock('../../data/utils', () => ({
  isHostAvailableInQueryParams: jest.fn(),
}));

jest.mock('../ProgressiveProfiling', () => function ProgressiveProfilingMock() {
  return <div data-testid="progressive-profiling-control">progressive-profiling-control</div>;
});

const { isHostAvailableInQueryParams } = jest.requireMock('../../data/utils');

const renderWithRouter = (entry = { pathname: '/welcome', state: {} }) => render(
  <MemoryRouter initialEntries={[entry]}>
    <ProgressiveProfilingExperiment />
  </MemoryRouter>,
);

describe('ProgressiveProfilingExperiment', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    jest.clearAllMocks();
    delete window.location;
    window.location = {
      ...originalLocation,
      assign: jest.fn(),
    };
    getConfig.mockReturnValue({ HOME_URL: 'http://localhost:18000' });
    getAuthenticatedUser.mockReturnValue({ userId: 42 });
    isHostAvailableInQueryParams.mockReturnValue(false);
  });

  afterAll(() => {
    window.location = originalLocation;
  });

  it('renders control component when decision is control and client is ready', () => {
    useDecision.mockReturnValue([{ variationKey: 'control' }, true]);

    renderWithRouter({
      pathname: '/welcome',
      state: { registrationResult: { success: true, redirectUrl: 'http://localhost/after' } },
    });

    expect(screen.getByTestId('progressive-profiling-control')).toBeTruthy();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('redirects to HOME_URL/welcome and does not render control for experiment variation', async () => {
    useDecision.mockReturnValue([{ variationKey: 'experiment' }, true]);

    const { container } = renderWithRouter({
      pathname: '/welcome',
      state: { registrationResult: { success: true, redirectUrl: 'http://localhost/after' } },
    });

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith('http://localhost:18000/welcome');
    });
    expect(screen.queryByTestId('progressive-profiling-control')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('does not render or redirect while Optimizely client is not ready (SDK timeout path)', () => {
    useDecision.mockReturnValue([{ variationKey: 'control' }, false]);

    const { container } = renderWithRouter({
      pathname: '/welcome',
      state: { registrationResult: { success: true, redirectUrl: 'http://localhost/after' } },
    });

    expect(screen.queryByTestId('progressive-profiling-control')).toBeNull();
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
  });

  it('does not redirect and falls back to control when HOME_URL is empty-ish in experiment variation', () => {
    getConfig.mockReturnValue({ HOME_URL: 'null' });
    useDecision.mockReturnValue([{ variationKey: 'experiment' }, true]);

    renderWithRouter({
      pathname: '/welcome',
      state: { registrationResult: { success: true, redirectUrl: 'http://localhost/after' } },
    });

    expect(window.location.assign).not.toHaveBeenCalled();
    expect(screen.getByTestId('progressive-profiling-control')).toBeTruthy();
  });

  it('does not redirect and falls back to control when experiment user lacks welcome-flow context', () => {
    useDecision.mockReturnValue([{ variationKey: 'experiment' }, true]);

    renderWithRouter({ pathname: '/welcome', state: {} });

    expect(window.location.assign).not.toHaveBeenCalled();
    expect(screen.getByTestId('progressive-profiling-control')).toBeTruthy();
  });
});
