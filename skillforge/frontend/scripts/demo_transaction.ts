
import { MeshWallet, Transaction } from '@meshsdk/core';
import { BlockfrostProvider } from '@meshsdk/core';

// NOTE: You need a Blockfrost Project ID for this to work on a real network.
// Set it in your environment variables or replace 'YOUR_BLOCKFROST_PROJECT_ID' below.
const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID || 'YOUR_BLOCKFROST_PROJECT_ID';

async function demoTransaction() {
    console.log('🚀 Starting Transaction Demo...');

    if (BLOCKFROST_PROJECT_ID === 'YOUR_BLOCKFROST_PROJECT_ID') {
        console.warn('⚠️  WARNING: No Blockfrost Project ID found. This script will fail to query the chain.');
        console.warn('   Please set BLOCKFROST_PROJECT_ID in your environment or edit this script.');
    }

    // 1. Setup Provider (Blockfrost)
    const provider = new BlockfrostProvider(BLOCKFROST_PROJECT_ID);

    // 2. Setup Wallet
    // Replace these words with the mnemonic generated from generate_wallet.ts
    // WARNING: Never hardcode mnemonics in production code!
    const mnemonic = [
        'solution', 'solution', 'solution', 'solution', 'solution', 'solution', 'solution', 'solution',
        'solution', 'solution', 'solution', 'solution', 'solution', 'solution', 'solution', 'solution',
        'solution', 'solution', 'solution', 'solution', 'solution', 'solution', 'solution', 'solution'
    ];

    const wallet = new MeshWallet({
        networkId: 0, // 0 for Preprod, 1 for Mainnet
        fetcher: provider,
        submitter: provider,
        key: {
            type: 'mnemonic',
            words: mnemonic,
        },
    });

    const myAddress = await wallet.getChangeAddress();
    console.log(`\n📬 My Address: ${myAddress}`);

    // 3. Check Balance
    const lovelaceBalance = await wallet.getLovelace();
    console.log(`💰 Balance: ${Number(lovelaceBalance) / 1000000} ADA`);

    if (Number(lovelaceBalance) < 2000000) {
        console.error('❌ Insufficient funds. Please fund this wallet using the Cardano Testnet Faucet.');
        return;
    }

    // 4. Build a Transaction
    // We will send 1.5 ADA to ourselves as a test
    const recipientAddress = myAddress;
    const amountToSend = '1500000'; // 1.5 ADA in Lovelace

    console.log(`\nTesting transaction: Sending 1.5 ADA to ${recipientAddress}...`);

    const tx = new Transaction({ initiator: wallet });
    tx.sendLovelace(recipientAddress, amountToSend);

    // 5. Build & Sign
    const unsignedTx = await tx.build();
    const signedTx = await wallet.signTx(unsignedTx);

    // 6. Submit
    try {
        const txHash = await wallet.submitTx(signedTx);
        console.log(`\n✅ Transaction submitted successfully!`);
        console.log(`🔗 Tx Hash: ${txHash}`);
        console.log(`   View on Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`);
    } catch (error) {
        console.error('\n❌ Transaction failed:', error);
    }
}

demoTransaction().catch(console.error);
