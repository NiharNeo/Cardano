# Wallet & Transaction Guide for SkillForge

This guide explains how to generate new wallets for tutors and how to perform transactions using the prebuilt scripts.

## 1. Prerequisites

Ensure you are in the `frontend` directory and have dependencies installed:

```bash
cd frontend
npm install
```

You will need `ts-node` or `tsx` to run the scripts directly. If not installed globally, you can use `npx tsx`.

## 2. Generating Tutor Wallets

To generate a new wallet (mnemonic and address) for a tutor, run:

```bash
npx tsx scripts/generate_wallet.ts
```

**Output:**
- A new 24-word mnemonic phrase.
- The corresponding Preprod address.
- A JSON file (e.g., `wallet_173291823.json`) containing these details.

> [!IMPORTANT]
> **Save the mnemonic securely.** If you lose it, you lose access to the wallet and any funds in it.

## 3. Funding the Wallet

Before performing transactions, the wallet must have funds (ADA).
1. Copy the **Address** generated in the previous step.
2. Go to the [Cardano Testnet Faucet](https://docs.cardano.org/cardano-testnet/tools/faucet/).
3. Select "Preprod Testnet".
4. Paste the address and request funds.

## 4. Performing Transactions

The `scripts/demo_transaction.ts` file contains a prebuilt function to build and sign a transaction.

### Setup
1. Open `scripts/demo_transaction.ts`.
2. Replace the `mnemonic` array with the words from your generated wallet.
3. Ensure you have a **Blockfrost Project ID** for the Preprod network.
   - You can set it as an environment variable: `export BLOCKFROST_PROJECT_ID=preprod...`
   - Or paste it directly into the script (for testing only).

### Running the Transaction
To run the transaction demo (which sends 1.5 ADA to yourself):

```bash
npx tsx scripts/demo_transaction.ts
```

**What happens:**
1. The script connects to the blockchain via Blockfrost.
2. It restores your wallet from the mnemonic.
3. It checks your balance.
4. It builds a transaction sending 1.5 ADA to your own address.
5. It signs and submits the transaction.
6. It outputs the **Transaction Hash**.

## 5. Integrating into the App

To use these functions in your React components, you can use the `useWallet` hook provided by MeshSDK (already integrated in `WalletContext.tsx`).

Example of sending ADA in a component:

```typescript
import { useWallet } from '@meshsdk/react';
import { Transaction } from '@meshsdk/core';

const MyComponent = () => {
  const { wallet, connected } = useWallet();

  const sendAda = async () => {
    if (connected) {
      const tx = new Transaction({ initiator: wallet });
      tx.sendLovelace('addr_test1...', '1500000'); // Send 1.5 ADA
      
      const unsignedTx = await tx.build();
      const signedTx = await wallet.signTx(unsignedTx);
      const txHash = await wallet.submitTx(signedTx);
      console.log('Tx Hash:', txHash);
    }
  };

  return <button onClick={sendAda}>Send ADA</button>;
};
```
