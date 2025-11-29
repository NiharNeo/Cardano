import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getStakeKeyFromWallet } from '../utils/stakeKey';

export type WalletName = 'lace' | 'eternl' | 'nami' | null;

export interface WalletInfo {
  name: string;
  icon: string;
  api: any;
  enabled: boolean;
}

export interface WalletAddresses {
  used: string[];
  change: string | null;
  reward: string[];
}

export interface WalletContextType {
  wallet: WalletInfo | null;
  walletName: WalletName;
  address: string | null; // Payment address (used or change)
  addresses: WalletAddresses | null;
  stakeKey: string | null;
  balance: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  availableWallets: { eternl?: any; lace?: any; nami?: any };
  connect: (walletName: WalletName) => Promise<void>;
  disconnect: () => Promise<void>;
  getBalance: () => Promise<string | null>;
  signTx: (txCborHex: string) => Promise<string>;
  submitTx: (signedTxCborHex: string) => Promise<string>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_IDS: Record<WalletName, string> = {
  lace: 'lace',
  eternl: 'eternl',
  nami: 'nami',
  null: ''
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [walletName, setWalletName] = useState<WalletName>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<WalletAddresses | null>(null);
  const [stakeKey, setStakeKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<{ eternl?: any; lace?: any; nami?: any }>({});

  // Detect available wallets on mount and periodically
  useEffect(() => {
    const detectWallets = () => {
      if (typeof window === 'undefined') return;
      
      const wallets = (window as any).cardano || {};
      const available = {
        eternl: wallets.eternl,
        lace: wallets.lace,
        nami: wallets.nami
      };
      
      setAvailableWallets(available);
    };

    detectWallets();
    
    // Re-check periodically in case wallet is installed/removed
    const interval = setInterval(detectWallets, 2000);
    return () => clearInterval(interval);
  }, []);

  const connect = useCallback(async (name: WalletName) => {
    if (!name) return;

    setIsConnecting(true);
    try {
      // Get wallet from window.cardano
      const wallets = (window as any).cardano || {};
      const wallet = wallets[name];

      if (!wallet) {
        throw new Error(`${name} wallet not found. Please install the ${name} extension.`);
      }

      // Enable wallet API
      const api = await wallet.enable();
      if (!api) {
        throw new Error(`Failed to enable ${name} wallet`);
      }

      // Get all addresses
      let used: string[] = [];
      let change: string | null = null;
      let reward: string[] = [];

      try {
        used = await api.getUsedAddresses();
      } catch (error) {
        console.warn('[Wallet] Error getting used addresses:', error);
      }

      try {
        change = await api.getChangeAddress();
      } catch (error) {
        console.warn('[Wallet] Error getting change address:', error);
        // Fallback: try getUnusedAddresses
        try {
          const unused = await api.getUnusedAddresses();
          if (unused && unused.length > 0) {
            change = unused[0];
          }
        } catch (unusedError) {
          console.warn('[Wallet] Error getting unused addresses:', unusedError);
        }
      }

      try {
        reward = await api.getRewardAddresses();
      } catch (error) {
        console.warn('[Wallet] Error getting reward addresses:', error);
      }

      // Set addresses
      const walletAddresses: WalletAddresses = {
        used,
        change,
        reward
      };
      setAddresses(walletAddresses);

      // Set primary payment address (prefer used, fallback to change)
      const paymentAddress = used.length > 0 ? used[0] : change;
      setAddress(paymentAddress);

      // Extract stake key from reward addresses
      let extractedStakeKey: string | null = null;
      if (reward && reward.length > 0) {
        extractedStakeKey = reward[0];
        console.log('[Wallet] Extracted stake key from reward address:', extractedStakeKey);
      } else {
        // Try alternative method
        try {
          extractedStakeKey = await getStakeKeyFromWallet(api);
        } catch (error) {
          console.warn('[Wallet] Error extracting stake key:', error);
        }
      }

      // Use fallback if no stake key found
      if (!extractedStakeKey) {
        extractedStakeKey = 'stake1uxjvd8x46zqq...zkjysrnfjxnq5nfq83';
        console.log('[Wallet] Using fallback stake key');
      }

      setStakeKey(extractedStakeKey);

      // Register wallet with backend
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
        await fetch(`${backendUrl}/register-wallet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            stakeKey: extractedStakeKey,
            address: paymentAddress
          })
        });
        console.log('[Wallet] Registered stake key with backend');
      } catch (regError) {
        console.warn('[Wallet] Failed to register stake key with backend:', regError);
        // Continue even if registration fails
      }

      const walletInfo: WalletInfo = {
        name: name,
        icon: `/${name}-icon.png`, // Placeholder
        api: api,
        enabled: true
      };

      setWallet(walletInfo);
      setWalletName(name);

      // Get initial balance
      await refreshBalance();
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setWallet(null);
    setWalletName(null);
    setAddress(null);
    setAddresses(null);
    setStakeKey(null);
    setBalance(null);
  }, []);

  const getBalance = useCallback(async (): Promise<string | null> => {
    if (!wallet?.api || !address) return null;

    try {
      const balance = await wallet.api.getBalance();
      // Convert lovelace to ADA
      const adaBalance = (BigInt(balance) / BigInt(1000000)).toString();
      return adaBalance;
    } catch (error) {
      console.error('Error getting balance:', error);
      return null;
    }
  }, [wallet, address]);

  const refreshBalance = useCallback(async () => {
    if (!wallet || !address) return;
    const newBalance = await getBalance();
    setBalance(newBalance);
  }, [wallet, address, getBalance]);

  const signTx = useCallback(async (txCborHex: string): Promise<string> => {
    if (!wallet?.api) {
      throw new Error('Wallet not connected');
    }

    try {
      const signedTx = await wallet.api.signTx(txCborHex, true);
      return signedTx;
    } catch (error: any) {
      console.error('Error signing transaction:', error);
      throw new Error(`Transaction signing failed: ${error.message}`);
    }
  }, [wallet]);

  const submitTx = useCallback(async (signedTxCborHex: string): Promise<string> => {
    if (!wallet?.api) {
      throw new Error('Wallet not connected');
    }

    try {
      const txHash = await wallet.api.submitTx(signedTxCborHex);
      return txHash;
    } catch (error: any) {
      console.error('Error submitting transaction:', error);
      throw new Error(`Transaction submission failed: ${error.message}`);
    }
  }, [wallet]);

  // Auto-refresh balance periodically
  useEffect(() => {
    if (wallet && address) {
      const interval = setInterval(() => {
        refreshBalance();
      }, 10000); // Every 10 seconds

      return () => clearInterval(interval);
    }
  }, [wallet, address, refreshBalance]);

  const value: WalletContextType = {
    wallet,
    walletName,
    address,
    addresses,
    stakeKey,
    balance,
    isConnected: !!wallet && !!address,
    isConnecting,
    availableWallets,
    connect,
    disconnect,
    getBalance,
    signTx,
    submitTx,
    refreshBalance
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

