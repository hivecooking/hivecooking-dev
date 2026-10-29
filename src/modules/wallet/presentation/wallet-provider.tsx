'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { setQueryApiContext } from '@/modules/query-api';

import { getWalletFacade } from '../infrastructure/wallet-facade';
import { subscribeToKeychainAvailability } from '../infrastructure/keychain-provider';
import type { HiveOperation } from '../hive-broadcast';
import type { BroadcastTransactionResult } from '../domain/types';

export type WalletContextValue = {
  username: string | null;
  keychainAvailable: boolean;
  connect: (username: string) => Promise<void>;
  disconnect: () => void;
  broadcast: (operations: readonly HiveOperation[]) => Promise<BroadcastTransactionResult>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [keychainAvailable, setKeychainAvailable] = useState(false);

  useEffect(() => {
    const facade = getWalletFacade();
    facade.hydrateFromStorage();
    const timer = setTimeout(() => {
      setUsername(facade.getUsername());
    }, 0);
    const unsubscribe = subscribeToKeychainAvailability(setKeychainAvailable);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setQueryApiContext({ viewer: username });
  }, [username]);

  const connect = useCallback(async (name: string) => {
    const facade = getWalletFacade();
    await facade.connect(name);
    setUsername(facade.getUsername());
  }, []);

  const disconnect = useCallback(() => {
    const facade = getWalletFacade();
    facade.disconnect();
    setUsername(null);
  }, []);

  const broadcast = useCallback(async (operations: readonly HiveOperation[]) => {
    return getWalletFacade().broadcast(operations);
  }, []);

  const value = useMemo(
    () => ({
      username,
      keychainAvailable,
      connect,
      disconnect,
      broadcast,
    }),
    [username, keychainAvailable, connect, disconnect, broadcast],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return ctx;
}
