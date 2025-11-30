# Network Address Fix - Preprod Testnet

## Problem
After fixing the CIP-30 transaction signing issue, we encountered a new error:
```
Some discriminated entities in the transaction are configured for another network.
discriminatedType: "address"
invalidEntities: ["addr1q8uqg3e28e3nd7ndxzjryywu4cu5lssvxmlyvnlldr832rlk7lkzl8ry4r5dknr8jeu7xwyhvecusldvw4huenhssxeswf7vdy"]
expectedNetwork: "testnet"
```

## Root Cause
The `RECEIVER_ADDRESS` constant in `transactionBuilder.ts` was set to a **mainnet address** (`addr1...`) instead of a **Preprod testnet address** (`addr_test1...`).

Cardano addresses are network-specific:
- **Mainnet addresses** start with `addr1`
- **Testnet addresses** start with `addr_test1`

Since SkillForge is configured to run on Preprod testnet, all addresses in transactions must be testnet addresses.

## The Fix

### Changed in `transactionBuilder.ts`:
```typescript
// ❌ BEFORE (mainnet address)
const RECEIVER_ADDRESS = "addr1q8uqg3e28e3nd7ndxzjryywu4cu5lssvxmlyvnlldr832rlk7lkzl8ry4r5dknr8jeu7xwyhvecusldvw4huenhssxeswf7vdy";

// ✅ AFTER (testnet address)
const RECEIVER_ADDRESS = "addr_test1qp6m4w67w2lveaskxm54ppwz825nwd7cnt2elhcctz7m0hjvzxm7s4m6nlxj93d98f7d73hxa2damsk02pzh2qq6t7yqcycgx0";
```

## Impact
- All escrow settlements will now correctly send funds to the testnet receiver address
- Transactions will no longer be rejected due to network mismatch
- The application can now successfully submit transactions to Preprod testnet

## Testing
1. Connect wallet (must be on Preprod testnet)
2. Initiate escrow lock
3. Sign transaction
4. Transaction should now submit successfully to Preprod blockchain

## Related Fixes
This fix builds on the previous CIP-30 transaction signing fix. Both were necessary:
1. **CIP-30 Fix**: Properly assemble signed transactions from witness sets
2. **Network Fix**: Use correct testnet addresses for all transaction outputs
