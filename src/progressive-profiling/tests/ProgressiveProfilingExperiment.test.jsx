import { getConfig } from '@edx/frontend-platform';
import { render, screen, waitFor } from '@testing-library/react';
import { useDecision } from '@optimizely/react-sdk';

import ProgressiveProfilingExperiment from '../ProgressiveProfilingExperiment';

jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn(),
}));

jest.mock('@optimizely/react-sdk', () => ({
  useDecision: jest.fn(),
}));

jest.mock('../ProgressiveProfiling', () => function ProgressiveProfilingMock() {
  return <div data-testid="progressive-profiling-control">progressive-profiling-control</div>;
});

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
  });

  afterAll(() => {
    window.location = originalLocation;
  });

  it('renders control component when decision is control and client is ready', () => {
    useDecision.mockReturnValue([{ variationKey: 'control' }, true]);

    render(<ProgressiveProfilingExperiment />);

    expect(screen.getByTestId('progressive-profiling-control')).toBeTruthy();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('redirects to HOME_URL/welcome and does not render control for experiment variation', async () => {
    useDecision.mockReturnValue([{ variationKey: 'experiment' }, true]);

    const { container } = render(<ProgressiveProfilingExperiment />);

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith('http://localhost:18000/welcome');
    });
    expect(screen.queryByTestId('progressive-profiling-control')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('does not render or redirect while Optimizely client is not ready (SDK timeout path)', () => {
    useDecision.mockReturnValue([{ variationKey: 'control' }, false]);

    const { container } = render(<ProgressiveProfilingExperiment />);

    expect(screen.queryByTestId('progressive-profiling-control')).toBeNull();
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
  });

  it('does not redirect when HOME_URL is empty-ish even in experiment variation', () => {
    getConfig.mockReturnValue({ HOME_URL: 'null' });
    useDecision.mockReturnValue([{ variationKey: 'experiment' }, true]);

    const { container } = render(<ProgressiveProfilingExperiment />);

    expect(window.location.assign).not.toHaveBeenCalled();
    expect(screen.queryByTestId('progressive-profiling-control')).toBeNull();
    expect(container.firstChild).toBeNull();
  });
});
