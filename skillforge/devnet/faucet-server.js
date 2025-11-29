#!/usr/bin/env node

/**
 * Local Faucet Server for SkillForge Devnet
 * Provides infinite ADA funding via HTTP API
 */

const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8090;
const FAUCET_AMOUNT = parseInt(process.env.FAUCET_AMOUNT || '5000000000'); // 5000 ADA
const NODE_SOCKET = process.env.NODE_SOCKET || '/data/node.socket';
const CONFIG_PATH = process.env.CONFIG_PATH || '/config/node-config.json';
const PAYMENT_SKEY = process.env.PAYMENT_SKEY || '/keys/payment.skey';
const PAYMENT_ADDR = process.env.PAYMENT_ADDR || '/keys/payment.addr';

app.use(express.json());

// Get faucet address
let faucetAddress;
try {
    faucetAddress = fs.readFileSync(PAYMENT_ADDR, 'utf8').trim();
} catch (error) {
    console.error('Error reading faucet address:', error);
    process.exit(1);
}

console.log(`🚰 Faucet server starting on port ${PORT}`);
console.log(`💰 Faucet address: ${faucetAddress}`);
console.log(`💵 Amount per request: ${FAUCET_AMOUNT / 1000000} ADA`);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', faucetAddress, amount: FAUCET_AMOUNT });
});

// Fund address endpoint
app.post('/fund', async (req, res) => {
    try {
        const { address } = req.body;

        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        console.log(`💰 Funding address: ${address}`);

        // Get faucet UTXOs
        const utxosOutput = execSync(
            `cardano-cli query utxo --address ${faucetAddress} --testnet-magic 42 --socket-path ${NODE_SOCKET}`,
            { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        );

        // Parse UTXO
        const lines = utxosOutput.split('\n').filter(l => l.trim() && !l.includes('TxHash'));
        if (lines.length === 0) {
            return res.status(500).json({ error: 'No UTXOs available in faucet' });
        }

        const firstUtxo = lines[0].split(/\s+/);
        const txHash = firstUtxo[0];
        const txIx = firstUtxo[1];
        const utxo = `${txHash}#${txIx}`;

        // Build transaction
        const tmpDir = '/tmp/faucet-tx';
        fs.mkdirSync(tmpDir, { recursive: true });

        try {
            execSync(
                `cardano-cli transaction build \
                    --testnet-magic 42 \
                    --socket-path ${NODE_SOCKET} \
                    --tx-in ${utxo} \
                    --tx-out ${address}+${FAUCET_AMOUNT} \
                    --change-address ${faucetAddress} \
                    --out-file ${tmpDir}/tx.unsigned`,
                { stdio: 'inherit' }
            );

            // Sign transaction
            execSync(
                `cardano-cli transaction sign \
                    --testnet-magic 42 \
                    --socket-path ${NODE_SOCKET} \
                    --tx-body-file ${tmpDir}/tx.unsigned \
                    --signing-key-file ${PAYMENT_SKEY} \
                    --out-file ${tmpDir}/tx.signed`,
                { stdio: 'inherit' }
            );

            // Submit transaction
            execSync(
                `cardano-cli transaction submit \
                    --testnet-magic 42 \
                    --socket-path ${NODE_SOCKET} \
                    --tx-file ${tmpDir}/tx.signed`,
                { stdio: 'inherit' }
            );

            // Get transaction hash
            const txHashOutput = execSync(
                `cardano-cli transaction txid --tx-file ${tmpDir}/tx.signed`,
                { encoding: 'utf8' }
            );

            const txHash = txHashOutput.trim();

            console.log(`✅ Transaction submitted: ${txHash}`);

            res.json({
                success: true,
                txHash,
                address,
                amount: FAUCET_AMOUNT,
                amountAda: FAUCET_AMOUNT / 1000000
            });
        } finally {
            // Cleanup
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    } catch (error) {
        console.error('Error funding address:', error);
        res.status(500).json({
            error: 'Failed to fund address',
            message: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Faucet server running on http://0.0.0.0:${PORT}`);
    console.log(`📡 Endpoints:`);
    console.log(`   POST /fund - Fund an address`);
    console.log(`   GET /health - Health check`);
});



