import { createContext, useContext } from 'react';
import type { User } from './types';

export const SessionContext = createContext<{
  user: User | null;
  setUser: (user: User | null) => void;
}>({ user: null, setUser: () => undefined });

export const useSession = () => useContext(SessionContext);
