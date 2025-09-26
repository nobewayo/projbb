// @module: ui-profile
// @tags: profile, panel, realtime

import type { OccupantProfileSummary } from '../ws/useRealtimeConnection';

export type ProfilePanelState =
  | { status: 'idle' }
  | { status: 'loading'; occupantId: string; occupantName: string }
  | { status: 'error'; occupantId: string; occupantName: string; message: string }
  | { status: 'loaded'; profile: OccupantProfileSummary };

interface ProfilePanelProps {
  state: ProfilePanelState;
  onRetry: () => void;
  onClose: () => void;
}

const ProfilePanel = ({ state, onRetry, onClose }: ProfilePanelProps): JSX.Element | null => {
  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return (
        <article className="profile-card" aria-busy="true">
          <header className="profile-card__header">
            <h2>Loading profile…</h2>
            <p>Fetching the latest data for {state.occupantName}.</p>
          </header>
        </article>
      );
    case 'error':
      return (
        <article className="profile-card profile-card--error">
          <header className="profile-card__header">
            <h2>Profile unavailable</h2>
          </header>
          <p className="profile-card__body">{state.message}</p>
          <div className="profile-card__actions">
            <button type="button" onClick={onRetry}>
              Retry
            </button>
            <button type="button" className="profile-card__secondary" onClick={onClose}>
              Back to panel
            </button>
          </div>
        </article>
      );
    case 'loaded': {
      const profile = state.profile;
      const joinedAt = new Date(profile.createdAt);
      const joinedLabel = Number.isNaN(joinedAt.getTime())
        ? 'Unknown'
        : joinedAt.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
      const roleLabels = profile.roles
        .map((role: string) =>
          role.toLowerCase() === 'user' ? 'PLAYER' : role.toUpperCase(),
        )
        .filter(Boolean);
      return (
        <article className="profile-card">
          <header className="profile-card__header">
            <h2>{profile.username}</h2>
            <p>{roleLabels.length > 0 ? roleLabels.join(' · ') : 'PLAYER'}</p>
          </header>
          <dl className="profile-card__meta">
            <div>
              <dt>Member since</dt>
              <dd>{joinedLabel}</dd>
            </div>
            <div>
              <dt>Current tile</dt>
              <dd>
                ({profile.position.x}, {profile.position.y})
              </dd>
            </div>
            <div>
              <dt>Backpack items</dt>
              <dd>{profile.inventoryCount}</dd>
            </div>
            <div>
              <dt>Room</dt>
              <dd>{profile.room.name}</dd>
            </div>
          </dl>
          <div className="profile-card__actions">
            <button type="button" onClick={onClose}>
              Back to panel
            </button>
          </div>
        </article>
      );
    }
    default:
      return null;
  }
};

export default ProfilePanel;
