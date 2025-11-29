#!/bin/bash

# Setup SkillForge Local Cardano Devnet
set -e

echo "🚀 Setting up SkillForge Local Devnet..."

# Check prerequisites
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

if ! command -v cardano-cli &> /dev/null; then
    echo "❌ cardano-cli not found. Please install Cardano CLI."
    echo "   Visit: https://github.com/IntersectMBO/cardano-node/releases"
    exit 1
fi

# Create directories
mkdir -p configs keys genesis data/node-1 data/node-2 data/node-3 data/kupo

# Generate keys
echo "🔑 Generating payment and stake keys..."
cardano-cli address key-gen \
    --verification-key-file keys/payment.vkey \
    --signing-key-file keys/payment.skey

cardano-cli stake-address key-gen \
    --verification-key-file keys/stake.vkey \
    --signing-key-file keys/stake.skey

# Build payment address
cardano-cli address build \
    --payment-verification-key-file keys/payment.vkey \
    --stake-verification-key-file keys/stake.vkey \
    --testnet-magic 42 \
    --out-file keys/payment.addr

PAYMENT_ADDR=$(cat keys/payment.addr)
echo "✓ Payment address: $PAYMENT_ADDR"

# Create simplified genesis (using cardano-cli genesis create)
echo "📜 Creating genesis configuration..."

# Note: cardano-cli genesis create requires specific format
# For now, we'll create a minimal working configuration
cat > configs/genesis.spec.json <<EOF
{
  "activeSlotsCoeff": 0.05,
  "securityParam": 2160,
  "epochLength": 432000,
  "systemStart": "2024-01-01T00:00:00Z",
  "slotsPerKESPeriod": 129600,
  "maxKESEvolutions": 62,
  "slotLength": 0.001,
  "updateQuorum": 3,
  "protocolParams": {
    "protocolVersion": {
      "major": 8,
      "minor": 0
    },
    "decentralizationParam": 0,
    "maxBlockBodySize": 65536,
    "maxBlockHeaderSize": 1100,
    "maxTxSize": 16384,
    "txFeeFixed": 155381,
    "txFeePerByte": 44,
    "minUTxOValue": 1000000,
    "stakeAddressDeposit": 2000000,
    "stakePoolDeposit": 500000000,
    "minPoolCost": 340000000,
    "poolRetireMaxEpoch": 18,
    "stakePoolTargetNum": 150,
    "poolPledgeInfluence": 0.3,
    "monetaryExpansion": 0.003,
    "treasuryCut": 0.2,
    "collateralPercentage": 150,
    "maxCollateralInputs": 3,
    "maxBlockExecutionUnits": {
      "memory": 50000000,
      "steps": 40000000000
    },
    "maxTxExecutionUnits": {
      "memory": 14000000,
      "steps": 10000000000
    },
    "maxValueSize": 5000,
    "priceExecutionSteps": 721,
    "priceExecutionMemory": 577
  }
}
EOF

# Create genesis with initial funds
echo "💰 Creating genesis with 1,000,000,000 ADA..."

cardano-cli genesis create \
    --testnet-magic 42 \
    --genesis-dir genesis \
    --gen-genesis-keys 1 \
    --gen-utxo-keys 1 \
    --start-time $(date -u +%s) \
    --supply 1000000000000000

# Fund the payment address with 500,000 ADA in genesis
GENESIS_UTXO_ADDR=$(cat genesis/utxo-keys/utxo1.vkey | cardano-cli address key-hash --payment-verification-key-file -)
GENESIS_UTXO_AMOUNT=500000000000000

# Create initial UTxO for payment address
cat > genesis/utxo-keys/utxo2.vkey <<EOF
{
  "type": "PaymentVerificationKeyShelley_ed25519",
  "description": "Payment Verification Key",
  "cborHex": "$(cardano-cli address key-hash --payment-verification-key-file keys/payment.vkey)"
}
EOF

# Create node configuration
echo "⚙️ Creating node configuration..."

cat > configs/node-config.json <<EOF
{
  "AlonzoGenesisFile": "genesis/alonzo-genesis.json",
  "AlonzoGenesisHash": "$(cardano-cli genesis hash --genesis genesis/alonzo-genesis.json 2>/dev/null || echo 'local-genesis-hash')",
  "ByronGenesisFile": "genesis/byron-genesis.json",
  "ByronGenesisHash": "$(cardano-cli genesis hash --genesis genesis/byron-genesis.json 2>/dev/null || echo 'local-byron-hash')",
  "ShelleyGenesisFile": "genesis/shelley-genesis.json",
  "ShelleyGenesisHash": "$(cardano-cli genesis hash --genesis genesis/shelley-genesis.json 2>/dev/null || echo 'local-shelley-hash')",
  "ConwayGenesisFile": "genesis/conway-genesis.json",
  "ConwayGenesisHash": "$(cardano-cli genesis hash --genesis genesis/conway-genesis.json 2>/dev/null || echo 'local-conway-hash')",
  "RequiresNetworkMagic": "RequiresMagic",
  "TestShelleyHardForkAtEpoch": 0,
  "TestAllegraHardForkAtEpoch": 0,
  "TestMaryHardForkAtEpoch": 0,
  "TestAlonzoHardForkAtEpoch": 0,
  "TestBabbageHardForkAtEpoch": 0,
  "TestConwayHardForkAtEpoch": 0,
  "LastKnownBlockVersion-Major": 8,
  "LastKnownBlockVersion-Minor": 0,
  "LastKnownBlockVersion-Alt": 0,
  "Protocol": "Cardano",
  "TraceBlockFetchDecisions": false,
  "TraceBlockchainTime": false,
  "TraceChainDb": false,
  "TraceChainSync": false,
  "TraceChainSyncBlockServer": false,
  "TraceChainSyncClient": false,
  "TraceChainSyncHeaderServer": false,
  "TraceChainSyncProtocol": false,
  "TraceConnectionManager": false,
  "TraceDNSResolver": false,
  "TraceDNSSubscription": false,
  "TraceErrorPolicy": false,
  "TraceForge": false,
  "TraceHandshake": false,
  "TraceInboundGovernor": false,
  "TraceIpSubscription": false,
  "TraceLedgerPeers": false,
  "TraceLocalChainSync": false,
  "TraceLocalErrorPolicy": false,
  "TraceLocalHandshake": false,
  "TraceLocalRootPeers": false,
  "TraceLocalTxSubmission": false,
  "TraceLocalTxSubmissionServer": false,
  "TraceMux": false,
  "TracePeerSelection": false,
  "TracePeerSelectionActions": false,
  "TracePublicRootPeers": false,
  "TraceServer": false,
  "TraceSubscription": false,
  "TraceTxInbound": false,
  "TraceTxOutbound": false,
  "TraceTxSubmission": false,
  "TracingVerbosity": "NormalVerbosity",
  "TurnOnLogging": true,
  "defaultScribes": [
    [
      "StdoutSK",
      "stdout"
    ]
  ],
  "setupScribes": [
    {
      "scKind": "StdoutSK",
      "scName": "stdout",
      "scFormat": "ScText",
      "scRotation": null
    }
  ],
  "minSeverity": "Info"
}
EOF

# Create topology
cat > configs/topology.json <<EOF
{
  "Producers": [
    {
      "addr": "cardano-node-1",
      "port": 3001,
      "valency": 1
    },
    {
      "addr": "cardano-node-2",
      "port": 3002,
      "valency": 1
    },
    {
      "addr": "cardano-node-3",
      "port": 3003,
      "valency": 1
    }
  ]
}
EOF

echo "✅ Devnet configuration created"
echo ""
echo "📝 Next steps:"
echo "   1. Start nodes: docker-compose up -d"
echo "   2. Wait for nodes to sync (check: docker-compose logs cardano-node-1)"
echo "   3. Fund address: ./faucet.sh $PAYMENT_ADDR"
echo "   4. Query UTXOs: ./query-utxo.sh $PAYMENT_ADDR"
echo ""
echo "💡 Payment address: $PAYMENT_ADDR"
echo "💡 This address will be funded with 500,000 ADA in genesis"
