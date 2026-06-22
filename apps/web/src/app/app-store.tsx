import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useMemo,
  useReducer,
} from 'react';

import { appReducer, createAppState, type AppAction, type AppState } from './app-state';

interface AppStoreValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({
  children,
  initialState = createAppState(),
}: {
  children: ReactNode;
  initialState?: AppState;
}) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const value = useContext(AppStoreContext);
  if (value === null) {
    throw new Error('useAppStore must be used inside AppStoreProvider.');
  }

  return value;
}
