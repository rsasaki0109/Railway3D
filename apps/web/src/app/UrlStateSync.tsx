import { useEffect, useRef } from 'react';

import { createAppState, selectionKey } from './app-state';
import { useAppStore } from './app-store';
import { parseUrlState, serializeUrlState } from './url-state';

function currentHash(): string {
  return window.location.hash || '';
}

function replaceHash(hash: string): void {
  if (window.location.hash === hash) {
    return;
  }

  window.history.replaceState(null, '', hash);
}

function pushHash(hash: string): void {
  if (window.location.hash === hash) {
    return;
  }

  window.history.pushState(null, '', hash);
}

export function readInitialAppState() {
  return parseUrlState(currentHash(), createAppState());
}

export function UrlStateSync() {
  const { state, dispatch } = useAppStore();
  const isFirstSyncRef = useRef(true);
  const skipNextSyncRef = useRef(false);
  const previousSelectionRef = useRef(selectionKey(state.selection));

  useEffect(() => {
    const handlePopState = () => {
      skipNextSyncRef.current = true;
      dispatch({ type: 'hydrate', state: parseUrlState(currentHash(), createAppState()) });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [dispatch]);

  useEffect(() => {
    const nextHash = serializeUrlState(state);
    const selectionChanged = previousSelectionRef.current !== selectionKey(state.selection);

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      previousSelectionRef.current = selectionKey(state.selection);
      return;
    }

    if (isFirstSyncRef.current) {
      isFirstSyncRef.current = false;
      replaceHash(nextHash);
      previousSelectionRef.current = selectionKey(state.selection);
      return;
    }

    if (selectionChanged) {
      pushHash(nextHash);
    } else {
      replaceHash(nextHash);
    }

    previousSelectionRef.current = selectionKey(state.selection);
  }, [state]);

  return null;
}
