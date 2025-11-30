
import { MeshWallet } from '@meshsdk/core';
import fs from 'fs';

async function generateWallet() {
    console.log('Generating a new Cardano wallet...');

    // 1. Generate a new mnemonic (24 words by default)
    const mnemonic = MeshWallet.brew();
    console.log('\n✅ Mnemonic generated!');
    console.log('----------------------------------------------------');
    console.log(mnemonic.join(' '));
    console.log('----------------------------------------------------');
    console.log('⚠️  SAVE THIS MNEMONIC SECURELY. IT IS THE ONLY WAY TO RECOVER THE WALLET.');

    // 2. Create a wallet instance from the mnemonic
    // We use networkId 0 for Preprod (Testnet), 1 for Mainnet
    const wallet = new MeshWallet({
        networkId: 0,
        fetcher: undefined, // No fetcher needed just for address generation
        submitter: undefined,
        key: {
            type: 'mnemonic',
            words: mnemonic,
        },
    });

    // 3. Get the enterprise address (no staking component) and base address
    const address = await wallet.getChangeAddress();

    console.log('\n📍 Wallet Address (Preprod):');
    console.log(address);

    // Optional: Save to a file
    const walletData = {
        mnemonic: mnemonic.join(' '),
        address: address,
        network: 'Preprod',
        createdAt: new Date().toISOString()
    };

    const filename = `wallet_${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(walletData, null, 2));
    console.log(`\n💾 Saved wallet details to ${filename}`);
}

generateWallet().catch(console.error);
