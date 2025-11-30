import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as CardanoWasm from '@emurgo/cardano-serialization-lib-browser';
import { Buffer } from 'buffer';

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
    paymentAddress: string | null; // Primary payment address
    stakeAddress: string | null; // Stake/reward address
    addresses: WalletAddresses | null;
    stakeKey: string | null;
    balance: string | null;
    utxoCount: number | null;
    collateralUtxo: string | null; // Selected collateral UTXO (CBOR or ID)
    collateralAmount: number | null; // Amount in ADA
    networkId: number | null; // 0 = testnet (Preprod), 1 = mainnet
    walletNetworkId: number | null; // Network ID from wallet API
    isPreprodNetwork: boolean; // True if wallet is on Preprod testnet
    utxos: any[] | null;
    isConnected: boolean;
    isConnecting: boolean;
    availableWallets: { eternl?: any; lace?: any; nami?: any };
    connect: (walletName: WalletName) => Promise<void>;
    disconnect: () => Promise<void>;
    getBalance: () => Promise<string | null>;
    getUTXOs: () => Promise<any[]>;
    signTx: (txCborHex: string) => Promise<string>;
    submitTx: (signedTxCborHex: string) => Promise<string>;
    refreshBalance: () => Promise<void>;
    // Escrow functions
    lockFunds: (params: EscrowLockParams) => Promise<LockFundsResult>;
    escrowState: EscrowState | null;
    lockState: { status: 'idle' | 'building_tx' | 'awaiting_signature' | 'submitting' | 'confirmed' | 'error'; error: string | null; txHash: string | null };
    resetEscrow: () => void;
    attestLearner: (params: EscrowAttestParams) => Promise<string>;
    attestMentor: (params: EscrowAttestParams) => Promise<string>;
    claimFunds: (params: EscrowClaimParams) => Promise<string>;
    refund: (params: EscrowRefundParams) => Promise<string>;
    // NFT functions
    mintSessionNFT: (params: NFTMintParams) => Promise<string>;
}

export interface EscrowLockParams {
    sessionId: string;
    mentorAddress: string;
    price: number; // Price in ADA
    parsedIntent?: any; // Optional parsed intent data
}

export interface EscrowState {
    status: 'idle' | 'building' | 'waiting_for_signature' | 'submitting' | 'confirmed' | 'error';
    txHash?: string;
    error?: string;
    scriptAddress?: string;
    datum?: any;
}

export interface LockFundsResult {
    success: boolean;
    txHash?: string;
    error?: string;
}

export interface EscrowAttestParams {
    sessionId: string;
    scriptUTXO: string;
}

export interface EscrowClaimParams {
    sessionId: string;
    scriptUTXO: string;
}

export interface EscrowRefundParams {
    sessionId: string;
    scriptUTXO: string;
}

export interface NFTMintParams {
    sessionId: string;
    eventCardImage?: File;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Helper function to convert hex address to bech32
const hexToBech32 = (hexAddress: string): string => {
    try {
        const addressBytes = Buffer.from(hexAddress, 'hex');
        const address = CardanoWasm.Address.from_bytes(addressBytes);
        return address.to_bech32();
    } catch (error) {
        console.error('[Wallet] Error converting hex to bech32:', error);
        throw new Error('Failed to convert address format');
    }
};

// Default receiving address (fallback when wallet doesn't provide addresses)
const DEFAULT_RECEIVING_ADDRESS = 'addr_test1qp6m4w67w2lveaskxm54ppwz825nwd7cnt2elhcctz7m0hjvzxm7s4m6nlxj93d98f7d73hxa2damsk02pzh2qq6t7yqcycgx0';

// Fixed Collateral Configuration
const FIXED_COLLATERAL = {
    txHash: "d8216e3defbdc23d45fa27a33bb869bff12616a1475178abf76c2ee24323effb",
    outputIndex: 4,
    address: "addr_test1qp6m4w67w2lveaskxm54ppwz825nwd7cnt2elhcctz7m0hjvzxm7s4m6nlxj93d98f7d73hxa2damsk02pzh2qq6t7yqcycgx0",
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [wallet, setWallet] = useState<WalletInfo | null>(null);
    const [walletName, setWalletName] = useState<WalletName>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [paymentAddress, setPaymentAddress] = useState<string | null>(null);
    const [stakeAddress, setStakeAddress] = useState<string | null>(null);
    const [addresses, setAddresses] = useState<WalletAddresses | null>(null);
    const [stakeKey, setStakeKey] = useState<string | null>(null);
    const [balance, setBalance] = useState<string | null>(null);
    const [utxoCount, setUtxoCount] = useState<number | null>(null);
    const [collateralUtxo, setCollateralUtxo] = useState<string | null>(null);
    const [collateralAmount, setCollateralAmount] = useState<number | null>(null);
    const [networkId, setNetworkId] = useState<number | null>(null);
    const [walletNetworkId, setWalletNetworkId] = useState<number | null>(null);
    const [isPreprodNetwork, setIsPreprodNetwork] = useState<boolean>(false);
    const [utxos, setUtxos] = useState<any[] | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [availableWallets, setAvailableWallets] = useState<{ eternl?: any; lace?: any; nami?: any }>({});
    const [escrowState, setEscrowState] = useState<EscrowState | null>(null);
    const [lockState, setLockState] = useState<{
        status: 'idle' | 'building_tx' | 'awaiting_signature' | 'submitting' | 'confirmed' | 'error';
        error: string | null;
        txHash: string | null;
    }>({
        status: 'idle',
        error: null,
        txHash: null
    });

    // Detect network mode
    const isLocalMode = import.meta.env.VITE_NETWORK === 'local' || import.meta.env.VITE_LOCAL_WALLET_MODE === 'true';

    // Detect available wallets on mount and periodically
    useEffect(() => {
        const detectWallets = () => {
            if (typeof window === 'undefined') return;

            const wallets = (window as any).cardano || {};
            const available = {
                eternl: wallets.eternl,
                lace: wallets.lace,
                nami: wallets.nami,
                // Local dev wallets
                laceEmulator: wallets.lace?.emulator,
                flint: wallets.flint
            };

            setAvailableWallets(available);

            if (isLocalMode) {
                console.log('[Wallet] Local devnet mode enabled');
                console.log('[Wallet] Available wallets:', Object.keys(available).filter(k => available[k as keyof typeof available]));
            }
        };

        detectWallets();

        // Re-check periodically in case wallet is installed/removed
        const interval = setInterval(detectWallets, 2000);
        return () => clearInterval(interval);
    }, []);

    const disconnect = useCallback(async () => {
        console.log('[Wallet] Disconnecting wallet...');

        // Try to disable wallet API if available
        try {
            if (wallet?.api && typeof wallet.api.disable === 'function') {
                await wallet.api.disable();
                console.log('[Wallet] Wallet API disabled');
            }
        } catch (error) {
            console.warn('[Wallet] Error disabling wallet API:', error);
        }

        // Reset all state
        setWallet(null);
        setWalletName(null);
        setAddress(null);
        setPaymentAddress(null);
        setStakeAddress(null);
        setAddresses(null);
        setStakeKey(null);
        setBalance(null);
        setUtxoCount(null);
        setCollateralUtxo(null);
        setCollateralAmount(null);
        setNetworkId(null);
        setWalletNetworkId(null);
        setIsPreprodNetwork(false);
        setUtxos(null);

        console.log('[Wallet] Disconnected successfully');
    }, [wallet]);

    const getCollateralUtxo = useCallback(async (api: any, pAddr: string) => {
        try {
            console.log('[Wallet] Verifying fixed collateral UTxO:', FIXED_COLLATERAL);

            // We strictly use the backend to verify the existence of the specific UTxO
            // because we need to parse it correctly and ensure it matches exactly.
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
            const response = await fetch(`${backendUrl}/utxos/${encodeURIComponent(FIXED_COLLATERAL.address)}`);

            if (!response.ok) {
                throw new Error('Failed to fetch UTxOs from backend');
            }

            const data = await response.json();
            const utxos = Array.isArray(data) ? data : (data.data || data.utxos || []);

            if (!Array.isArray(utxos)) {
                throw new Error('Invalid UTxO data from backend');
            }

            // Find the specific UTxO
            const match = utxos.find((u: any) => {
                const txHash = u.tx_hash || u.txHash;
                const txIndex = u.tx_index ?? u.output_index ?? u.txIndex;
                return txHash === FIXED_COLLATERAL.txHash && Number(txIndex) === FIXED_COLLATERAL.outputIndex;
            });

            if (!match) {
                console.warn('[Wallet] Fixed collateral UTxO NOT found in address UTxOs.');
                console.warn('[Wallet] Skipping collateral check - not needed for simple transactions');
                // Don't throw error - collateral not needed for regular ADA transfers
                setCollateralUtxo(null);
                setCollateralAmount(null);
                return; // Exit early, no collateral needed
            }

            // Validate Amount (>= 5 ADA) and Pure ADA
            let amount = BigInt(0);
            let isPure = true;

            if (match.amount) {
                if (Array.isArray(match.amount)) {
                    if (match.amount.length > 1) isPure = false;
                    const lovelace = match.amount.find((a: any) => a.unit === 'lovelace');
                    if (lovelace) amount = BigInt(lovelace.quantity);
                } else {
                    amount = BigInt(match.amount);
                }
            } else if (match.value) {
                if (typeof match.value === 'object') {
                    if (Object.keys(match.value).length > 1) isPure = false;
                    if (match.value.lovelace) amount = BigInt(match.value.lovelace);
                } else {
                    amount = BigInt(match.value);
                }
            }

            if (amount < 5000000n) {
                throw new Error("Collateral must contain at least 5 ADA.");
            }
            if (!isPure) {
                throw new Error("Collateral UTxO must contain ADA-only.");
            }

            console.log('✅ [Wallet] Fixed collateral verified:', match);
            console.log("Using fixed collateral UTxO:", FIXED_COLLATERAL);

            // Store identifier
            setCollateralUtxo(`${FIXED_COLLATERAL.txHash}#${FIXED_COLLATERAL.outputIndex}`);
            setCollateralAmount(Number(amount) / 1000000);

        } catch (error: any) {
            console.error('[Wallet] Collateral verification failed:', error);
            setCollateralUtxo(null);
            setCollateralAmount(null);

            // Show specific error message as requested
            const msg = `⚠️ Collateral UTxO not available. Please keep 5+ ADA in ${FIXED_COLLATERAL.txHash}#${FIXED_COLLATERAL.outputIndex} on Preprod.`;
            console.warn(msg);
            // We don't throw here to allow connection, but transactions will fail.
        }
    }, []);

    const connect = useCallback(async (name: WalletName) => {
        if (!name) return;

        setIsConnecting(true);

        try {
            // Disconnect any existing wallet first
            if (wallet) {
                console.log('[Wallet] Disconnecting existing wallet before connecting new one');
                await disconnect();
                // Small delay to ensure cleanup
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Get wallet from window.cardano
            const wallets = (window as any).cardano || {};
            const walletObj = wallets[name];

            if (!walletObj) {
                throw new Error(`${name} wallet not found. Please install the ${name} extension and refresh the page.`);
            }

            console.log(`[Wallet] Attempting to connect to ${name}...`);

            // Enable wallet API with timeout
            let api;
            try {
                api = await Promise.race([
                    walletObj.enable(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Wallet connection timeout. Please try again.')), 10000)
                    )
                ]) as any;
            } catch (enableError: any) {
                if (enableError.message?.includes('timeout')) {
                    throw enableError;
                }
                throw new Error(`Failed to enable ${name} wallet: ${enableError.message || 'User rejected or wallet error'}`);
            }

            if (!api) {
                throw new Error(`Failed to enable ${name} wallet: API is null`);
            }

            console.log(`[Wallet] ${name} wallet enabled successfully`);

            // Check wallet network - SkillForge requires Preprod testnet
            let walletNetwork: number | null = null;
            try {
                walletNetwork = await api.getNetworkId();
                setWalletNetworkId(walletNetwork);

                // Preprod testnet has network ID 0
                const isPreprod = walletNetwork === 0;
                setIsPreprodNetwork(isPreprod);

                if (!isPreprod) {
                    console.warn('⚠️ [Wallet] Wallet is NOT on Preprod testnet (Network ID: ' + walletNetwork + ')');
                    throw new Error("Wallet is not on PREPRODUCTION TESTNET (Preprod). Please switch your wallet to Preprod.");
                }

                console.log('✅ [Wallet] Connected to PREPROD Testnet (Network ID: 0)');
            } catch (error) {
                console.error('[Wallet] Network check failed:', error);
                throw error; // Re-throw to stop connection
            }

            // Get addresses from wallet
            let walletAddresses: WalletAddresses = {
                used: [],
                change: null,
                reward: []
            };

            try {
                // Get used addresses (CIP-30 returns hex format)
                const usedAddressesHex = await api.getUsedAddresses();
                if (usedAddressesHex && usedAddressesHex.length > 0) {
                    // Convert hex addresses to bech32
                    walletAddresses.used = usedAddressesHex.map((hexAddr: string) => hexToBech32(hexAddr));
                    console.log('[Wallet] Used addresses:', walletAddresses.used);
                }

                // Get change address (CIP-30 returns hex format)
                try {
                    const changeAddrHex = await api.getChangeAddress();
                    if (changeAddrHex) {
                        walletAddresses.change = hexToBech32(changeAddrHex);
                        console.log('[Wallet] Change address:', walletAddresses.change);
                    }
                } catch (e) {
                    console.warn('[Wallet] Could not get change address:', e);
                }

                // Get reward addresses (stake addresses) (CIP-30 returns hex format)
                try {
                    const rewardAddressesHex = await api.getRewardAddresses();
                    if (rewardAddressesHex && rewardAddressesHex.length > 0) {
                        // Convert hex addresses to bech32
                        walletAddresses.reward = rewardAddressesHex.map((hexAddr: string) => hexToBech32(hexAddr));
                        console.log('[Wallet] Reward addresses:', walletAddresses.reward);
                    }
                } catch (e) {
                    console.warn('[Wallet] Could not get reward addresses:', e);
                }
            } catch (error) {
                console.error('[Wallet] Error getting addresses:', error);
                throw new Error('Failed to get wallet addresses');
            }

            setAddresses(walletAddresses);

            // Set primary payment address (prefer used[0], fallback to change)
            const primaryPaymentAddress = walletAddresses.used[0] || walletAddresses.change || null;
            
            if (!primaryPaymentAddress) {
                throw new Error('No payment address available from wallet');
            }

            console.log('[Wallet] Payment address:', primaryPaymentAddress);
            setAddress(primaryPaymentAddress);
            setPaymentAddress(primaryPaymentAddress);

            // Set stake address and extract stake key
            const stakeAddr = walletAddresses.reward[0] || null;
            setStakeAddress(stakeAddr);
            
            // Extract stake key from stake address if available
            if (stakeAddr) {
                try {
                    // Stake address format: stake_test1... or stake1...
                    // We'll store the full bech32 address as the stake key
                    setStakeKey(stakeAddr);
                    console.log('[Wallet] Stake address:', stakeAddr);
                } catch (e) {
                    console.warn('[Wallet] Could not extract stake key:', e);
                    setStakeKey(null);
                }
            } else {
                setStakeKey(null);
            }

            // Detect network ID from address
            const detectedNetworkId = primaryPaymentAddress?.startsWith('addr1') ? 1 : 0;
            setNetworkId(detectedNetworkId);

            const walletInfo: WalletInfo = {
                name: name,
                icon: `/${name}-icon.png`, // Placeholder
                api: api,
                enabled: true
            };

            setWallet(walletInfo);
            setWalletName(name);

            // Fetch Collateral
            await getCollateralUtxo(api, primaryPaymentAddress);

            console.log(`✅ [Wallet] Successfully connected to ${name}`);
        } catch (error: any) {
            console.error(`❌ [Wallet] Connection error for ${name}:`, error);
            // Reset state
            setWallet(null);
            setWalletName(null);
            setAddress(null);
            setPaymentAddress(null);
            setStakeAddress(null);
            setAddresses(null);
            setStakeKey(null);
            setBalance(null);
            setUtxoCount(null);
            setCollateralUtxo(null);
            setCollateralAmount(null);
            setNetworkId(null);
            setWalletNetworkId(null);
            setIsPreprodNetwork(false);
            setUtxos(null);

            throw error;
        } finally {
            setIsConnecting(false);
        }
    }, [wallet, disconnect, getCollateralUtxo]);

    const getUTXOs = useCallback(async (): Promise<any[]> => {
        if (!wallet?.api || !paymentAddress) return [];

        try {
            // Try to get UTXOs from wallet API
            const utxos = await wallet.api.getUtxos();
            return utxos || [];
        } catch (error) {
            console.error('Error getting UTXOs:', error);
            return [];
        }
    }, [wallet, paymentAddress]);

    const getBalance = useCallback(async (): Promise<string | null> => {
        if (!paymentAddress) return null;

        try {
            console.log("[Wallet] Fetching balance for:", paymentAddress);

            // STRATEGY 1: Try wallet API first (direct from wallet, no Blockfrost needed)
            if (wallet?.api) {
                try {
                    console.log('[Wallet] Trying wallet.api.getBalance()...');
                    const balanceCbor = await wallet.api.getBalance();
                    
                    // Parse CBOR balance (CIP-30 returns CBOR hex string)
                    if (balanceCbor) {
                        // Import CardanoWasm if not already available
                        const CardanoWasm = await import('@emurgo/cardano-serialization-lib-browser');
                        const balanceBytes = Buffer.from(balanceCbor, 'hex');
                        const value = CardanoWasm.Value.from_bytes(balanceBytes);
                        const lovelace = value.coin().to_str();
                        const adaBalance = (Number(lovelace) / 1000000).toString();
                        
                        console.log('[Wallet] Balance from wallet API:', adaBalance, 'ADA');
                        
                        // Try to get UTXO count from wallet
                        try {
                            const utxos = await wallet.api.getUtxos();
                            setUtxoCount(utxos?.length || 0);
                        } catch (e) {
                            console.warn('[Wallet] Could not get UTXO count:', e);
                        }
                        
                        return adaBalance;
                    }
                } catch (walletError) {
                    console.warn('[Wallet] Wallet API balance failed:', walletError);
                    // Fall through to backend method
                }
            }

            // STRATEGY 2: Try backend/Blockfrost (will fail if IP banned)
            console.log('[Wallet] Trying backend UTXOs endpoint...');
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
            const response = await fetch(`${backendUrl}/utxos/${encodeURIComponent(paymentAddress)}`);

            if (response.ok) {
                const data = await response.json();
                const utxos = Array.isArray(data) ? data : (data.data || data.utxos || []);

                if (Array.isArray(utxos) && utxos.length > 0) {
                    let totalLovelace = BigInt(0);

                    for (const utxo of utxos) {
                        let amount = BigInt(0);

                        if (utxo.amount) {
                            if (Array.isArray(utxo.amount)) {
                                const lovelace = utxo.amount.find((a: any) => a.unit === 'lovelace');
                                if (lovelace) amount = BigInt(lovelace.quantity);
                            } else {
                                amount = BigInt(utxo.amount);
                            }
                        } else if (utxo.value) {
                            if (typeof utxo.value === 'object' && utxo.value.lovelace) {
                                amount = BigInt(utxo.value.lovelace);
                            } else {
                                amount = BigInt(utxo.value);
                            }
                        }

                        totalLovelace += amount;
                    }

                    const adaBalance = (Number(totalLovelace) / 1000000).toString();
                    console.log('[Wallet] Balance from backend UTXOs:', adaBalance, 'ADA');
                    setUtxoCount(utxos.length);
                    return adaBalance;
                }
            }

            console.warn('[Wallet] Backend returned no UTXOs or failed');
            setUtxoCount(0);
            return '0';

        } catch (error) {
            console.error('[Wallet] Error getting balance:', error);
            setUtxoCount(0);
            return '0';
        }
    }, [wallet, paymentAddress]);

    const refreshBalance = useCallback(async () => {
        if (!wallet || !paymentAddress) return;
        const newBalance = await getBalance();
        setBalance(newBalance);
        // Also refresh collateral
        if (wallet.api) {
            await getCollateralUtxo(wallet.api, paymentAddress);
        }
    }, [wallet, paymentAddress, getBalance, getCollateralUtxo]);

    // Auto-refresh balance
    useEffect(() => {
        if (wallet && paymentAddress) {
            refreshBalance();
            const interval = setInterval(refreshBalance, 10000);
            return () => clearInterval(interval);
        }
    }, [wallet, paymentAddress, refreshBalance]);

    const signTx = useCallback(async (txCborHex: string): Promise<string> => {
        if (!wallet?.api) throw new Error('Wallet not connected');
        // CIP-30: signTx returns witness set CBOR, not a signed transaction
        // Use partialSign=false for regular transactions
        return await wallet.api.signTx(txCborHex, false);
    }, [wallet]);

    const submitTx = useCallback(async (signedTxCborHex: string): Promise<string> => {
        if (!wallet?.api) throw new Error('Wallet not connected');
        
        try {
            console.log('[Wallet] Submitting transaction, hex length:', signedTxCborHex.length);
            const txHash = await wallet.api.submitTx(signedTxCborHex);
            console.log('[Wallet] Transaction submitted successfully:', txHash);
            return txHash;
        } catch (error: any) {
            console.error('[Wallet] submitTx error:', error);
            console.error('[Wallet] Error details:', {
                message: error.message,
                info: error.info,
                code: error.code,
                stack: error.stack
            });
            throw new Error(error.message || error.info || 'Transaction submission failed');
        }
    }, [wallet]);

    // Placeholders for other functions
    const lockFunds = async (params: EscrowLockParams): Promise<LockFundsResult> => {
        console.log('[Wallet] lockFunds called with:', params);
        setLockState({ status: 'building_tx', error: null, txHash: null });

        try {
            if (!paymentAddress) {
                throw new Error('Wallet not connected - no payment address');
            }

            if (!wallet?.api) {
                throw new Error('Wallet API not available');
            }

            // Get UTXOs from wallet (not from Blockfrost)
            console.log('[Wallet] Getting UTXOs from wallet...');
            const walletUtxos = await getUTXOs();
            console.log('[Wallet] Got', walletUtxos.length, 'UTXOs from wallet');

            if (walletUtxos.length === 0) {
                throw new Error('NO_UTXOS: Wallet has no UTXOs. Please ensure your wallet has funds.');
            }

            // Convert wallet UTXOs to format expected by backend
            const formattedUtxos = walletUtxos.map((utxo: any) => {
                // Parse UTXO CBOR if needed
                try {
                    const utxoObj = typeof utxo === 'string' 
                        ? CardanoWasm.TransactionUnspentOutput.from_bytes(Buffer.from(utxo, 'hex'))
                        : utxo;
                    
                    const input = utxoObj.input();
                    const output = utxoObj.output();
                    const amount = output.amount();
                    
                    return {
                        tx_hash: Buffer.from(input.transaction_id().to_bytes()).toString('hex'),
                        output_index: input.index(),
                        amount: [{
                            unit: 'lovelace',
                            quantity: amount.coin().to_str()
                        }]
                    };
                } catch (e) {
                    console.warn('[Wallet] Could not parse UTXO:', e);
                    return null;
                }
            }).filter((u: any) => u !== null);

            console.log('[Wallet] Formatted', formattedUtxos.length, 'UTXOs for backend');

            // 1. Initialize Escrow on Backend with wallet UTXOs
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

            console.log('[Wallet] Calling /escrow/init with:', {
                learnerAddress: paymentAddress,
                mentorAddress: params.mentorAddress,
                price: params.price,
                sessionId: params.sessionId,
                utxoCount: formattedUtxos.length
            });

            const initResponse = await fetch(`${backendUrl}/escrow/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    learnerAddress: paymentAddress,
                    mentorAddress: params.mentorAddress,
                    price: params.price,
                    sessionId: params.sessionId,
                    stakeKey: stakeKey || undefined,
                    parsedIntent: params.parsedIntent || undefined,
                    walletUtxos: formattedUtxos // Send wallet's UTXOs
                })
            });

            if (!initResponse.ok) {
                const errorData = await initResponse.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || errorData.message || 'Failed to initialize escrow on backend');
            }

            const initData = await initResponse.json();
            const escrowData = initData.data || initData;
            console.log('[Wallet] Escrow initialized:', escrowData);

            // Backend returns txBody (which contains the transaction hex)
            const txHex = escrowData.txBody || escrowData.txHex;
            if (!txHex) {
                throw new Error('Backend did not return transaction hex');
            }

            setLockState({ status: 'awaiting_signature', error: null, txHash: null });

            // 2. Sign the transaction with wallet
            console.log('[Wallet] Requesting signature from wallet...');
            console.log('[Wallet] Transaction hex length:', txHex.length);
            
            // CIP-30: signTx returns a witness set CBOR, not a signed transaction
            const witnessSetHex = await wallet.api.signTx(txHex, false);
            console.log('[Wallet] Received witness set from wallet');
            
            // 3. Assemble the final signed transaction
            // Parse the original transaction and witness set
            const txBytes = Buffer.from(txHex, 'hex');
            const witnessSetBytes = Buffer.from(witnessSetHex, 'hex');
            
            const transaction = CardanoWasm.Transaction.from_bytes(txBytes);
            const witnessSet = CardanoWasm.TransactionWitnessSet.from_bytes(witnessSetBytes);
            
            // Create the final signed transaction
            const signedTx = CardanoWasm.Transaction.new(
                transaction.body(),
                witnessSet,
                transaction.auxiliary_data()
            );
            
            const signedTxHex = Buffer.from(signedTx.to_bytes()).toString('hex');
            console.log('[Wallet] Assembled signed transaction, length:', signedTxHex.length);

            setLockState({ status: 'submitting', error: null, txHash: null });

            // 4. Submit the signed transaction
            console.log('[Wallet] Submitting transaction to blockchain...');
            const txHash = await submitTx(signedTxHex);
            console.log('[Wallet] Transaction submitted:', txHash);

            setLockState({ status: 'confirmed', error: null, txHash });

            return { success: true, txHash };

        } catch (error: any) {
            console.error('[Wallet] lockFunds error:', error);
            setLockState({ status: 'error', error: error.message || 'Failed to lock funds', txHash: null });
            return { success: false, error: error.message || 'Failed to lock funds' };
        }
    };
    const resetEscrow = () => { };
    const attestLearner = async (params: EscrowAttestParams) => 'txHash';
    const attestMentor = async (params: EscrowAttestParams) => 'txHash';
    const claimFunds = async (params: EscrowClaimParams) => 'txHash';
    const refund = async (params: EscrowRefundParams) => 'txHash';
    const mintSessionNFT = async (params: NFTMintParams) => 'txHash';

    const value: WalletContextType = {
        wallet,
        walletName,
        address,
        paymentAddress,
        stakeAddress,
        addresses,
        stakeKey,
        balance,
        utxoCount,
        collateralUtxo,
        collateralAmount,
        networkId,
        walletNetworkId,
        isPreprodNetwork,
        utxos,
        isConnected: !!wallet,
        isConnecting,
        availableWallets,
        connect,
        disconnect,
        getBalance,
        getUTXOs,
        signTx,
        submitTx,
        refreshBalance,
        lockFunds,
        escrowState,
        lockState,
        resetEscrow,
        attestLearner,
        attestMentor,
        claimFunds,
        refund,
        mintSessionNFT
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
