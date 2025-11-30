# Design Document

## Overview

The Escrow Smart Contract System implements a trustless payment mechanism for SkillForge mentoring sessions using Cardano's eUTXO model and Plutus smart contracts. The system consists of three main components: an on-chain Plutus validator written in Aiken, a backend transaction builder service using the Cardano Serialization Library, and REST API endpoints for escrow operations. The design ensures that funds are locked securely, both parties must attest to session completion, and payments are automatically routed to a designated receiver address upon successful settlement.

## Architecture

### System Components

1. **Plutus Validator (escrow.ak)**
   - On-chain validation logic written in Aiken
   - Enforces state transition rules for attestations and fund release
   - Validates that funds go to the correct receiver address

2. **Transaction Builder Service (transactionBuilder.ts)**
   - Constructs unsigned Cardano transactions
   - Handles datum and redeemer encoding in Aiken's format
   - Manages UTXO selection and fee calculation

3. **Escrow API Routes (escrow.ts)**
   - REST endpoints for escrow operations
   - Database state management
   - Integration with wallet and blockchain services

4. **Database Layer**
   - PostgreSQL tables: sessions, escrow_state
   - Tracks off-chain state and transaction history

### Data Flow

```
Learner Wallet (CIP-30)
    ↓ (1) Initialize Escrow
Backend API (/escrow/init)
    ↓ (2) Build unsigned tx
Transaction Builder
    ↓ (3) Return tx hex
Learner Wallet
    ↓ (4) Sign & submit
Cardano Blockchain
    ↓ (5) Funds locked at script address
    
[Session Completion]
    
Learner/Mentor Wallet
    ↓ (6) Attest completion
Backend API (/escrow/attest-*)
    ↓ (7) Build attest tx
Transaction Builder
    ↓ (8) Update datum
Cardano Blockchain
    
[Both Attested]
    
Mentor Wallet
    ↓ (9) Claim funds
Backend API (/escrow/claim)
    ↓ (10) Build claim tx
Transaction Builder
    ↓ (11) Validate & send to receiver
Cardano Blockchain
```

## Components and Interfaces

### Plutus Validator Interface

**Datum Structure (EscrowDatum)**
```aiken
pub type EscrowDatum {
  learner: ByteArray,           // Learner public key hash
  mentor: ByteArray,            // Mentor public key hash
  price: Int,                   // Amount in Lovelace
  session: ByteArray,           // Session UUID as bytes
  learner_attested: Bool,       // Learner attestation flag
  mentor_attested: Bool,        // Mentor attestation flag
  receiver: ByteArray,          // Fixed receiver public key hash
}
```

**Redeemer Structure (EscrowRedeemer)**
```aiken
pub type EscrowRedeemer {
  AttestByLearner  // Constructor index 0
  AttestByMentor   // Constructor index 1
  ClaimFunds       // Constructor index 2
  Refund           // Constructor index 3
}
```

**Validator Logic**
- `AttestByLearner`: Checks `!datum.learner_attested`
- `AttestByMentor`: Checks `!datum.mentor_attested`
- `ClaimFunds`: Checks both attestations AND funds go to receiver
- `Refund`: Always allows (learner can recover funds)

### Transaction Builder Interface

**buildEscrowInitTx**
```typescript
Input: {
  learnerAddress: string,
  mentorAddress: string,
  learnerPubKeyHash: string,
  mentorPubKeyHash: string,
  priceLovelace: number,
  sessionId: string,
  learnerUTXOs: UTXO[]
}
Output: {
  txHex: string,
  scriptAddress: string,
  datum: EscrowDatum
}
```

**buildEscrowAttestTx**
```typescript
Input: {
  scriptUTXO: string,           // Format: "txHash#index"
  redeemerType: 'AttestByLearner' | 'AttestByMentor',
  signerAddress: string,
  signerUTXOs: UTXO[]
}
Output: {
  txHex: string
}
```

**buildEscrowClaimTx**
```typescript
Input: {
  scriptUTXO: string,
  mentorAddress: string,
  mentorUTXOs: UTXO[],
  escrowAmount: number
}
Output: {
  txHex: string,
  settledTo: string
}
```

**buildEscrowRefundTx**
```typescript
Input: {
  scriptUTXO: string,
  learnerAddress: string,
  learnerUTXOs: UTXO[]
}
Output: {
  txHex: string
}
```

### REST API Interface

**POST /escrow/init**
- Request: `{ learnerAddress, mentorAddress, price, sessionId }`
- Response: `{ txHex, scriptAddress, escrowId, datum }`
- Creates escrow state in database with status 'pending'

**POST /escrow/attest-learner**
- Request: `{ sessionId, scriptUTXO, learnerAddress }`
- Response: `{ txHex }`
- Builds attestation transaction for learner

**POST /escrow/attest-mentor**
- Request: `{ sessionId, scriptUTXO, mentorAddress }`
- Response: `{ txHex }`
- Builds attestation transaction for mentor

**POST /escrow/claim**
- Request: `{ sessionId, scriptUTXO, mentorAddress, escrowAmount }`
- Response: `{ txHex, settledTo }`
- Sends 100% of funds to fixed receiver address
- Updates session status to 'paid' and escrow status to 'settled'

**POST /escrow/refund**
- Request: `{ sessionId, scriptUTXO, learnerAddress }`
- Response: `{ txHex }`
- Allows learner to recover funds

**POST /escrow/status**
- Request: `{ sessionId }`
- Response: `{ status, txId, lockedAt, completedAt }`
- Returns current escrow state

**POST /escrow/update**
- Request: `{ sessionId, txId, utxo }`
- Response: `{ success, message }`
- Updates escrow state after transaction submission

## Data Models

### Database Schema

**sessions table**
```sql
id: uuid PRIMARY KEY
learner_id: uuid REFERENCES users(id)
provider_id: uuid REFERENCES providers(id)
skill: text
budget: numeric
duration: integer
status: text CHECK (status IN ('initiated','active','completed','paid'))
created_at: timestamp
```

**escrow_state table**
```sql
session_id: uuid PRIMARY KEY REFERENCES sessions(id)
utxo: text
status: text
updated_at: timestamp
```

### TypeScript Types

```typescript
interface EscrowInitRequest {
  learnerAddress: string;
  providerAddress: string;
  price: number;
  sessionId: string;
}

interface EscrowInitResponse {
  txBody: string;
  escrowAddress: string;
  escrowId: string;
}

interface EscrowStatusResponse {
  status: 'locked' | 'in_session' | 'completed' | 'paid_out';
  txId?: string;
  lockedAt?: string;
  completedAt?: string;
}
```

### Cardano Serialization Library Types

**Address Handling**
```typescript
// Parse bech32 address
const address = Cardano.Address.from_bech32(bech32String);

// Extract payment credential
const paymentCred = address.payment_cred();
const pubKeyHash = paymentCred.to_keyhash();

// Convert to bytes
const hashBytes = pubKeyHash.to_bytes();
```

**Datum Construction (Aiken Format)**
```typescript
// EscrowDatum is a record (constructor 0)
const fields = Cardano.PlutusList.new();
fields.add(Cardano.PlutusData.new_bytes(learnerHash));
fields.add(Cardano.PlutusData.new_bytes(mentorHash));
fields.add(Cardano.PlutusData.new_integer(price));
fields.add(Cardano.PlutusData.new_bytes(sessionBytes));
fields.add(boolToPlutusData(false)); // learner_attested
fields.add(boolToPlutusData(false)); // mentor_attested
fields.add(Cardano.PlutusData.new_bytes(receiverHash));

const datum = Cardano.PlutusData.new_constr_plutus_data(
  Cardano.ConstrPlutusData.new(
    Cardano.BigNum.from_str('0'),
    fields
  )
);
```

**Redeemer Construction (Aiken Format)**
```typescript
// Enum variants are constructor indices
const redeemerIndex = {
  'AttestByLearner': 0,
  'AttestByMentor': 1,
  'ClaimFunds': 2,
  'Refund': 3
}[redeemerType];

const redeemer = Cardano.PlutusData.new_constr_plutus_data(
  Cardano.ConstrPlutusData.new(
    Cardano.BigNum.from_str(redeemerIndex.toString()),
    Cardano.PlutusList.new()
  )
);
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Escrow initialization creates valid script output

*For any* valid learner address, mentor address, and price amount, when an escrow is initialized, the resulting transaction SHALL contain an output to the script address with the exact specified amount in Lovelace.

**Validates: Requirements 1.1**

### Property 2: Datum contains all required fields

*For any* escrow initialization with learner hash, mentor hash, price, session ID, and receiver hash, the constructed datum SHALL include all seven fields (learner, mentor, price, session, learner_attested=false, mentor_attested=false, receiver) with correct values.

**Validates: Requirements 1.2**

### Property 3: Transaction builder returns complete response

*For any* valid escrow initialization parameters, the buildEscrowInitTx function SHALL return a response containing non-empty txHex, scriptAddress, and datum fields.

**Validates: Requirements 1.3**

### Property 4: Database state reflects initialization

*For any* escrow initialization, after the transaction is built and recorded, querying the database SHALL return escrow status 'pending' and session status 'active'.

**Validates: Requirements 1.5**

### Property 5: Learner attestation updates datum correctly

*For any* escrow with learner_attested=false, when the learner attests, the resulting datum SHALL have learner_attested=true while all other fields remain unchanged.

**Validates: Requirements 2.1**

### Property 6: Mentor attestation updates datum correctly

*For any* escrow with mentor_attested=false, when the mentor attests, the resulting datum SHALL have mentor_attested=true while all other fields remain unchanged.

**Validates: Requirements 2.2**

### Property 7: Double attestation is rejected

*For any* escrow where a party has already attested (flag=true), attempting to attest again with the same party SHALL result in validator rejection.

**Validates: Requirements 2.3**

### Property 8: Attestation transactions include correct inputs

*For any* attestation transaction, the transaction SHALL include the script UTXO as an input and at least one UTXO from the attesting party's address for fees.

**Validates: Requirements 2.4**

### Property 9: Claim requires both attestations

*For any* escrow claim attempt, the validator SHALL reject the transaction if either learner_attested or mentor_attested is false.

**Validates: Requirements 3.1**

### Property 10: Claim sends full amount to receiver

*For any* escrow with amount X and receiver address R, when funds are claimed, the transaction SHALL contain an output to address R with exactly amount X.

**Validates: Requirements 3.2**

### Property 11: Claim uses correct redeemer

*For any* claim transaction, the redeemer SHALL be a PlutusData constructor with index 2 (ClaimFunds).

**Validates: Requirements 3.3**

### Property 12: Claim validates receiver address

*For any* claim transaction where the output address does not match the receiver public key hash in the datum, the validator SHALL reject the transaction.

**Validates: Requirements 3.4**

### Property 13: Claim updates database status

*For any* successful claim, querying the database SHALL return session status 'paid' and escrow status 'settled'.

**Validates: Requirements 3.5**

### Property 14: Refund uses correct redeemer

*For any* refund transaction, the redeemer SHALL be a PlutusData constructor with index 3 (Refund).

**Validates: Requirements 4.1**

### Property 15: Refund is always allowed

*For any* escrow state, a refund transaction with the Refund redeemer SHALL pass validator validation regardless of attestation flags.

**Validates: Requirements 4.2**

### Property 16: Status query returns valid status

*For any* escrow status query, the returned status SHALL be one of: 'pending', 'locked', 'in_session', 'completed', 'paid_out', 'settled'.

**Validates: Requirements 5.1**

### Property 17: Status response includes required fields

*For any* escrow status query for an existing session, the response SHALL include status, and optionally txId, lockedAt, and completedAt fields.

**Validates: Requirements 5.2**

### Property 18: AttestByLearner validates learner flag

*For any* escrow datum, the validator SHALL reject an AttestByLearner redeemer if learner_attested is true.

**Validates: Requirements 6.1**

### Property 19: AttestByMentor validates mentor flag

*For any* escrow datum, the validator SHALL reject an AttestByMentor redeemer if mentor_attested is true.

**Validates: Requirements 6.2**

### Property 20: ClaimFunds validates all conditions

*For any* escrow datum, the validator SHALL reject a ClaimFunds redeemer unless both attestation flags are true AND the transaction output goes to the receiver address.

**Validates: Requirements 6.3**

### Property 21: Invalid redeemers are rejected

*For any* redeemer with a constructor index other than 0, 1, 2, or 3, the validator SHALL reject the transaction.

**Validates: Requirements 6.5**

### Property 22: Network configuration is correct

*For any* transaction built by the system, the network ID SHALL match the configured environment (0 for testnet, 1 for mainnet).

**Validates: Requirements 7.1**

### Property 23: Script is loaded successfully

*For any* transaction building operation, the escrow script SHALL be loaded and non-null before constructing the transaction.

**Validates: Requirements 7.2**

### Property 24: Datum uses Aiken format

*For any* constructed datum, the PlutusData SHALL be a constructor with index 0 containing exactly 7 fields in the correct order.

**Validates: Requirements 7.3**

### Property 25: Bech32 addresses parse correctly

*For any* valid bech32 address string, the Cardano.Address.from_bech32 function SHALL successfully parse it without throwing an error.

**Validates: Requirements 8.1**

### Property 26: Payment credentials extract correctly

*For any* parsed address with a verification key payment credential, extracting the Ed25519KeyHash SHALL return a non-null hash value.

**Validates: Requirements 8.2**

### Property 27: Receiver hash is included in datum

*For any* escrow initialization with a receiver address, the constructed datum SHALL contain the receiver's public key hash as the 7th field.

**Validates: Requirements 8.3**

## Error Handling

### Transaction Building Errors

1. **Script Not Loaded**
   - Error: "Escrow script not loaded"
   - Cause: Plutus script file missing or invalid
   - Recovery: Check contracts directory and rebuild Aiken contracts

2. **Invalid Address Format**
   - Error: "Invalid address format"
   - HTTP Status: 400
   - Cause: Malformed bech32 address
   - Recovery: Validate address format before submission

3. **Public Key Hash Extraction Failed**
   - Error: "Could not extract public key hashes from addresses"
   - HTTP Status: 400
   - Cause: Address uses script credential instead of verification key
   - Recovery: Ensure addresses are standard payment addresses

4. **Insufficient UTXOs**
   - Behavior: Create mock UTXOs for transaction building
   - Note: Wallet will use real UTXOs during signing
   - Recovery: User must have sufficient funds in wallet

### Database Errors

1. **Session Not Found**
   - Error: "Session not found"
   - HTTP Status: 404
   - Cause: Invalid session ID
   - Recovery: Verify session exists before escrow operations

2. **Database Query Failed**
   - HTTP Status: 500
   - Cause: Database connection or query error
   - Recovery: Check database connectivity and logs

### Validation Errors

1. **Missing Required Fields**
   - Error: "Invalid escrow parameters: {field} is required"
   - HTTP Status: 400
   - Cause: Missing learnerAddress, mentorAddress, price, or sessionId
   - Recovery: Include all required fields in request

2. **Invalid Price**
   - Error: "Invalid escrow parameters: price must be greater than 0"
   - HTTP Status: 400
   - Cause: Price is zero or negative
   - Recovery: Provide positive price value

3. **Session Not Ready for Settlement**
   - Error: "Session not ready for settlement"
   - HTTP Status: 400
   - Cause: Attempting to claim before both parties attest
   - Recovery: Wait for both attestations

### On-Chain Validation Errors

1. **Double Attestation**
   - Cause: Attempting to attest when flag is already true
   - Result: Transaction rejected by validator
   - Recovery: Check current datum state before attesting

2. **Claim Without Attestations**
   - Cause: Attempting to claim when attestation flags are false
   - Result: Transaction rejected by validator
   - Recovery: Ensure both parties have attested

3. **Wrong Receiver Address**
   - Cause: Claim transaction output doesn't match receiver in datum
   - Result: Transaction rejected by validator
   - Recovery: Verify receiver address matches datum

## Testing Strategy

### Unit Testing

**Transaction Builder Tests**
- Test datum construction with various input combinations
- Test redeemer encoding for all four types
- Test address parsing and public key hash extraction
- Test UTXO selection and fee calculation
- Test mock UTXO generation for empty UTXO arrays

**API Endpoint Tests**
- Test /escrow/init with valid and invalid parameters
- Test /escrow/attest-* with various session states
- Test /escrow/claim with different attestation combinations
- Test /escrow/refund functionality
- Test /escrow/status query responses
- Test error handling for missing sessions and invalid data

**Database Integration Tests**
- Test escrow state creation and updates
- Test session status transitions
- Test concurrent access and race conditions
- Test transaction rollback on errors

### Property-Based Testing

The system will use **fast-check** (JavaScript/TypeScript property-based testing library) to verify correctness properties. Each property test will run a minimum of 100 iterations with randomly generated inputs.

**Property Test Structure**
```typescript
import fc from 'fast-check';

// Example property test
fc.assert(
  fc.property(
    fc.string(), // learner address
    fc.string(), // mentor address
    fc.integer({ min: 1000000, max: 1000000000 }), // price
    fc.uuid(), // session ID
    async (learnerAddr, mentorAddr, price, sessionId) => {
      // Test property implementation
      const result = await buildEscrowInitTx({...});
      expect(result.txHex).toBeDefined();
      expect(result.scriptAddress).toBeDefined();
      expect(result.datum).toBeDefined();
    }
  ),
  { numRuns: 100 }
);
```

**Generators**
- Valid bech32 addresses (testnet and mainnet formats)
- Public key hashes (28-byte hex strings)
- Lovelace amounts (positive integers)
- Session UUIDs
- UTXO arrays with varying quantities and amounts
- Escrow datums with different attestation states
- Redeemer types (all four variants)

**Property Test Coverage**
- Properties 1-27 will each have a dedicated property-based test
- Each test will be tagged with: `**Feature: escrow-smart-contract, Property {N}: {description}**`
- Tests will validate both success cases and expected failures
- Edge cases (empty UTXOs, invalid addresses) will be handled by generators

### Integration Testing

**End-to-End Escrow Flow**
1. Initialize escrow with learner funds
2. Submit transaction to blockchain
3. Learner attests completion
4. Mentor attests completion
5. Mentor claims funds
6. Verify funds arrive at receiver address
7. Verify database states are updated correctly

**Refund Flow**
1. Initialize escrow
2. Learner requests refund
3. Verify funds return to learner
4. Verify database states are updated

**Error Scenarios**
1. Attempt double attestation (should fail)
2. Attempt claim without attestations (should fail)
3. Attempt claim with wrong receiver (should fail)
4. Test with invalid addresses (should return 400)
5. Test with missing session (should return 404)

### Smart Contract Testing

**Aiken Unit Tests**
- Test each redeemer type with valid and invalid datums
- Test attestation flag validation
- Test receiver address validation
- Test that refunds always succeed
- Test rejection of invalid redeemers

**Plutus Validator Tests**
- Deploy contract to testnet
- Submit real transactions for each operation
- Verify on-chain validation behavior
- Test with various datum and redeemer combinations
- Verify script execution costs and budgets

### Test Execution Strategy

1. **Development**: Run unit tests and property tests on every code change
2. **Pre-commit**: Run full test suite including integration tests
3. **CI/CD**: Run all tests plus smart contract tests on testnet
4. **Pre-deployment**: Run end-to-end tests on testnet with real wallets
5. **Monitoring**: Track transaction success rates and validator rejections in production
