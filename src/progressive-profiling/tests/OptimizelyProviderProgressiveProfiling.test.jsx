import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import OptimizelyProviderProgressiveProfiling from '../OptimizelyProviderProgressiveProfiling';

let mockOptimizelyClient = {};

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('../../data/optimizely', () => ({
  __esModule: true,
  get default() {
    return mockOptimizelyClient;
  },
}));

const mockOptimizelyProvider = jest.fn(({ children }) => <div data-testid="optimizely-provider">{children}</div>);

jest.mock('@optimizely/react-sdk', () => ({
  OptimizelyProvider: (props) => mockOptimizelyProvider(props),
}));

jest.mock('../ProgressiveProfiling', () => function ProgressiveProfilingMock() {
  return <div>progressive-profiling-control</div>;
});
jest.mock('../ProgressiveProfilingExperiment', () => function ProgressiveProfilingExperimentMock() {
  return <div>progressive-profiling-experiment</div>;
});

const renderWithRouter = (entry = { pathname: '/progressive-profiling' }) => render(
  <MemoryRouter initialEntries={[entry]}>
    <OptimizelyProviderProgressiveProfiling />
  </MemoryRouter>,
);

describe('OptimizelyProviderProgressiveProfiling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOptimizelyClient = {};
  });

  it('falls back to control when Optimizely client is missing', () => {
    mockOptimizelyClient = null;
    getAuthenticatedUser.mockReturnValue({ userId: 9 });

    renderWithRouter();

    expect(screen.getByText('progressive-profiling-control')).toBeTruthy();
    expect(screen.queryByText('progressive-profiling-experiment')).toBeNull();
  });

  it('falls back to control when userId is unavailable', () => {
    getAuthenticatedUser.mockReturnValue(null);

    renderWithRouter();

    expect(screen.getByText('progressive-profiling-control')).toBeTruthy();
    expect(screen.queryByText('progressive-profiling-experiment')).toBeNull();
  });

  it('renders experiment with auth userId via OptimizelyProvider', () => {
    getAuthenticatedUser.mockReturnValue({ userId: 42 });

    renderWithRouter();

    expect(screen.getByText('progressive-profiling-experiment')).toBeTruthy();
    expect(mockOptimizelyProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: '42' }),
      }),
    );
  });

  it('uses location state authenticatedUser as fallback', () => {
    getAuthenticatedUser.mockReturnValue(null);

    renderWithRouter({
      pathname: '/progressive-profiling',
      state: { authenticatedUser: { userId: 123 } },
    });

    expect(screen.getByText('progressive-profiling-experiment')).toBeTruthy();
    expect(mockOptimizelyProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: '123' }),
      }),
    );
  });
});
