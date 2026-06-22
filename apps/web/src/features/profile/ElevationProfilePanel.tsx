import { useEffect, useMemo, useState } from 'react';

import { useAppStore } from '../../app/app-store';
import { ProfileChart } from './ProfileChart';
import { ProfileLegend } from './ProfileLegend';
import { ProfileTable } from './ProfileTable';
import {
  DEFAULT_PROFILE_CURSOR_CHAINAGE_M,
  ProfileLoadError,
  findNearestProfileSample,
  fitProfileRangeToView,
  formatChainageKm,
  formatElevation,
  isChainageWithinProfile,
  loadSyntheticProfileForSelection,
  stepProfileCursor,
  type SyntheticElevationProfile,
} from './profile-controller';

type ProfileLoadState =
  | { status: 'idle'; profile: null; error: null }
  | { status: 'loading'; profile: null; error: null }
  | { status: 'ready'; profile: SyntheticElevationProfile; error: null }
  | { status: 'error'; profile: null; error: string };

function initialProfileState(): ProfileLoadState {
  return { status: 'idle', profile: null, error: null };
}

export function ElevationProfilePanel() {
  const { state, dispatch } = useAppStore();
  const [loadState, setLoadState] = useState<ProfileLoadState>(initialProfileState);
  const [brushStatus, setBrushStatus] = useState('No profile range selected');

  useEffect(() => {
    let active = true;
    setLoadState({ status: 'loading', profile: null, error: null });

    loadSyntheticProfileForSelection(state.selection)
      .then((profile) => {
        if (!active) {
          return;
        }
        setLoadState({ status: 'ready', profile, error: null });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        const message =
          error instanceof ProfileLoadError ? error.message : 'Synthetic profile failed to load.';
        setLoadState({ status: 'error', profile: null, error: message });
        dispatch({ type: 'set-profile-cursor', chainageM: null });
      });

    return () => {
      active = false;
    };
  }, [dispatch, state.selection]);

  useEffect(() => {
    if (loadState.status !== 'ready') {
      return;
    }

    if (!isChainageWithinProfile(loadState.profile, state.profileCursorChainageM)) {
      dispatch({
        type: 'set-profile-cursor',
        chainageM: DEFAULT_PROFILE_CURSOR_CHAINAGE_M,
      });
    }
  }, [dispatch, loadState, state.profileCursorChainageM]);

  const profile = loadState.status === 'ready' ? loadState.profile : null;
  const cursorSample = useMemo(() => {
    if (profile === null) {
      return null;
    }

    return findNearestProfileSample(
      profile,
      state.profileCursorChainageM ?? DEFAULT_PROFILE_CURSOR_CHAINAGE_M,
    );
  }, [profile, state.profileCursorChainageM]);

  const setCursor = (chainageM: number) => {
    dispatch({ type: 'set-profile-cursor', chainageM });
  };

  const handleBrushRange = (range: readonly [number, number]) => {
    if (profile === null) {
      return;
    }

    dispatch({ type: 'set-view', view: fitProfileRangeToView(profile, range) });
    setBrushStatus(
      `Map fit ${formatChainageKm(Math.min(range[0], range[1]))} to ${formatChainageKm(
        Math.max(range[0], range[1]),
      )}`,
    );
  };

  const stepCursor = (direction: -1 | 1) => {
    if (profile === null) {
      return;
    }

    setCursor(stepProfileCursor(profile, state.profileCursorChainageM, direction));
  };

  const cursorStatus =
    cursorSample === null
      ? 'Cursor unavailable'
      : `${formatChainageKm(cursorSample.chainageM)} · rail ${formatElevation(
          cursorSample.railElevationM,
        )} · ground ${formatElevation(cursorSample.groundElevationM)}`;

  return (
    <section
      className="profile-panel"
      aria-labelledby="profile-panel-title"
      data-testid="profile-panel"
    >
      <div className="profile-header">
        <div>
          <p className="eyebrow">Profile</p>
          <h2 id="profile-panel-title">Elevation profile</h2>
        </div>
        <div className="profile-actions" aria-label="Profile cursor controls">
          <button
            type="button"
            className="map-action"
            data-testid="profile-prev-sample"
            disabled={profile === null}
            onClick={() => stepCursor(-1)}
          >
            Prev
          </button>
          <button
            type="button"
            className="map-action"
            data-testid="profile-next-sample"
            disabled={profile === null}
            onClick={() => stepCursor(1)}
          >
            Next
          </button>
        </div>
      </div>
      <p className="inspector-subtitle" data-testid="profile-status" role="status">
        {loadState.status === 'ready'
          ? `${loadState.profile.title} loaded lazily`
          : loadState.status === 'error'
            ? loadState.error
            : 'Loading synthetic profile asset'}
      </p>
      <p className="inspector-note" data-testid="profile-cursor-status">
        {cursorStatus}
      </p>
      {profile !== null ? (
        <>
          <ProfileLegend />
          <ProfileChart
            profile={profile}
            cursorChainageM={state.profileCursorChainageM}
            onCursorChange={setCursor}
            onBrushRange={handleBrushRange}
          />
          <p className="inspector-note" data-testid="profile-brush-status">
            {brushStatus}
          </p>
          <ProfileTable profile={profile} />
        </>
      ) : null}
    </section>
  );
}
