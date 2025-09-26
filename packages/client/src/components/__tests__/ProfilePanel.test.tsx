import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ProfilePanel, { type ProfilePanelState } from '../ProfilePanel';

const baseProfileState: ProfilePanelState = {
  status: 'loaded',
  profile: {
    id: 'user-1',
    username: 'Alice',
    roles: ['user'],
    createdAt: new Date('2024-01-01T12:00:00Z').toISOString(),
    inventoryCount: 2,
    position: { x: 5, y: 4 },
    room: { id: 'room-1', name: 'Atrium' },
  },
};

describe('ProfilePanel', () => {
  it('shows a loading state', () => {
    render(<ProfilePanel state={{ status: 'loading', occupantId: 'user-1', occupantName: 'Alice' }} onRetry={() => undefined} onClose={() => undefined} />);

    expect(screen.getByText('Loading profile…')).toBeInTheDocument();
    expect(screen.getByText('Fetching the latest data for Alice.')).toBeInTheDocument();
  });

  it('renders error content with retry controls', () => {
    render(
      <ProfilePanel
        state={{ status: 'error', occupantId: 'user-1', occupantName: 'Alice', message: 'Not found' }}
        onRetry={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText('Profile unavailable')).toBeInTheDocument();
    expect(screen.getByText('Not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('displays profile details when loaded', () => {
    render(<ProfilePanel state={baseProfileState} onRetry={() => undefined} onClose={() => undefined} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('PLAYER')).toBeInTheDocument();
    expect(screen.getByText('Atrium')).toBeInTheDocument();
  });
});
