# Implementation Plan

- [ ] 1. Set up project structure and core interfaces
  - Create directory structure for AI generator, encryption, NFT minting, and predicate engine
  - Define TypeScript interfaces for LearningBundle, EncryptedBundle, VaultNFTMetadata, and UnlockPredicate types
  - Set up testing framework (Jest + fast-check for property-based testing)
  - _Requirements: 1.1, 1.2, 2.1-2.5_

- [ ] 2. Implement encryption service
  - [ ] 2.1 Create encryption service with AES-256-GCM support
    - Implement encrypt() method using learner's public key
    - Implement decrypt() method using learner's private key
    - Add nonce generation and algorithm selection
    - _Requirements: 1.2, 6.1, 6.2_
  
  - [ ]* 2.2 Write property test for encryption round-trip
    - **Property 2: Encryption round-trip**
    - **Validates: Requirements 1.2, 3.2, 6.2**
  
  - [ ]* 2.3 Write unit tests for encryption edge cases
    - Test empty bundles, large bundles, invalid keys
    - _Requirements: 1.2_

- [ ] 3. Implement AI content generator
  - [ ] 3.1 Create AI content generator service
    - Implement generateBundle() method
    - Extract notes, highlights, mistakes, insights, plans, corrections from session data
    - Integrate with OpenAI or similar AI service
    - _Requirements: 1.1, 5.1-5.6_
  
  - [ ]* 3.2 Write property test for bundle completeness
    - **Property 1: Bundle generation completeness**
    - **Validates: Requirements 1.1**
  
  - [ ]* 3.3 Write property test for mistake capture
    - **Property 12: Mistake capture**
    - **Validates: Requirements 5.3**

- [ ] 4. Implement IPFS storage layer
  - [ ] 4.1 Create IPFS storage service
    - Implement upload() method for encrypted content
    - Implement retrieve() method with CID
    - Add pinning to multiple nodes for availability
    - _Requirements: 6.3_
  
  - [ ]* 4.2 Write property test for IPFS storage verification
    - **Property 14: IPFS storage verification**
    - **Validates: Requirements 6.3**

- [ ] 5. Implement NFT minting service
  - [ ] 5.1 Create NFT minter with Cardano integration
    - Implement mintVaultNFT() method
    - Build NFT metadata with encrypted content CID
    - Integrate with existing NFT minting infrastructure
    - _Requirements: 1.3, 1.4_
  
  - [ ]* 5.2 Write property test for NFT minting to correct address
    - **Property 3: NFT minting to correct address**
    - **Validates: Requirements 1.4**
  
  - [ ]* 5.3 Write property test for NFT metadata CID reference
    - **Property 15: NFT metadata CID reference**
    - **Validates: Requirements 6.4**

- [ ] 6. Implement predicate engine core
  - [ ] 6.1 Create predicate engine with evaluation logic
    - Implement evaluate() method for all predicate types
    - Support TimePredicate, SkillProofPredicate, StreakPredicate, PaymentPredicate
    - Add CustomPredicate support with external evaluators
    - _Requirements: 2.1-2.5, 3.1_
  
  - [ ]* 6.2 Write property test for time predicate evaluation
    - **Property 5: Time predicate evaluation**
    - **Validates: Requirements 2.1**
  
  - [ ]* 6.3 Write property test for predicate composition
    - **Property 6: Predicate composition**
    - **Validates: Requirements 2.5, 7.3**
  
  - [ ]* 6.4 Write property test for unlock verification completeness
    - **Property 7: Unlock verification completeness**
    - **Validates: Requirements 3.1**

- [ ] 7. Implement Aiken smart contract for unlock validation
  - [ ] 7.1 Write Aiken validator for Vault NFT unlocking
    - Define VaultDatum with learner, encrypted_cid, unlock_predicates
    - Define Predicate types (TimeLock, SkillProof, Streak, Payment, Custom, And, Or)
    - Implement unlock validation logic
    - _Requirements: 1.5, 2.1-2.5_
  
  - [ ] 7.2 Compile and deploy Aiken contract
    - Build contract with `aiken build`
    - Deploy to Preprod testnet
    - Record contract address and policy ID
    - _Requirements: 1.5_
  
  - [ ]* 7.3 Write property test for unlock conditions storage
    - **Property 4: Unlock conditions storage**
    - **Validates: Requirements 1.5**
  
  - [ ]* 7.4 Write property test for condition encoding round-trip
    - **Property 11: Condition encoding round-trip**
    - **Validates: Requirements 4.3**

- [ ] 8. Implement unlock attempt handling
  - [ ] 8.1 Create unlock service
    - Implement attemptUnlock() method
    - Verify all predicates are satisfied
    - Decrypt content on successful unlock
    - Record unlock attempts in database
    - _Requirements: 3.1-3.5_
  
  - [ ]* 8.2 Write property test for failed unlock reporting
    - **Property 8: Failed unlock reporting**
    - **Validates: Requirements 3.4**
  
  - [ ]* 8.3 Write property test for unlock event recording
    - **Property 9: Unlock event recording**
    - **Validates: Requirements 3.5**
  
  - [ ]* 8.4 Write property test for wallet signature requirement
    - **Property 16: Wallet signature requirement**
    - **Validates: Requirements 6.5**

- [ ] 9. Implement mentor condition specification
  - [ ] 9.1 Create API endpoints for mentor condition management
    - POST /sessions/:id/unlock-conditions - Specify conditions
    - GET /sessions/:id/unlock-conditions - Retrieve conditions
    - Add validation for achievable conditions
    - _Requirements: 4.1, 4.2_
  
  - [ ]* 9.2 Write property test for condition validation
    - **Property 10: Condition validation**
    - **Validates: Requirements 4.2**

- [ ] 10. Implement database schema and migrations
  - [ ] 10.1 Create database tables
    - Create learning_bundles table
    - Create unlock_conditions table
    - Create unlock_attempts table
    - Add indexes for performance
    - _Requirements: All_
  
  - [ ] 10.2 Write database migration scripts
    - Create up/down migrations
    - Test migration rollback
    - _Requirements: All_

- [ ] 11. Implement end-to-end bundle generation flow
  - [ ] 11.1 Create session completion handler
    - Trigger AI generation on session complete
    - Encrypt generated bundle
    - Upload to IPFS
    - Mint Vault NFT
    - Store unlock conditions in contract
    - _Requirements: 1.1-1.5_
  
  - [ ] 11.2 Add error handling and retry logic
    - Handle generation failures with exponential backoff
    - Queue failed mints for retry
    - Notify learner of delays
    - _Requirements: All_

- [ ] 12. Implement frontend UI for unlock management
  - [ ] 12.1 Create Vault NFT display component
    - Show encrypted bundle metadata
    - Display unlock conditions and progress
    - Show which conditions are satisfied
    - _Requirements: 3.3, 3.4_
  
  - [ ] 12.2 Create unlock attempt UI
    - Button to attempt unlock
    - Display unlock result or failure reasons
    - Show decrypted content on success
    - _Requirements: 3.1-3.5_

- [ ] 13. Implement backward compatibility system
  - [ ] 13.1 Add versioning to predicate system
    - Version predicate definitions
    - Maintain old predicate evaluators
    - Test with existing NFTs
    - _Requirements: 7.2_
  
  - [ ]* 13.2 Write property test for backward compatibility
    - **Property 17: Backward compatibility**
    - **Validates: Requirements 7.2**

- [ ] 14. Implement analytics and monitoring
  - [ ] 14.1 Add event emission for predicate evaluation
    - Emit events on unlock attempts
    - Emit events on successful unlocks
    - Track predicate satisfaction rates
    - _Requirements: 7.5_
  
  - [ ]* 14.2 Write property test for event emission
    - **Property 19: Event emission**
    - **Validates: Requirements 7.5**
  
  - [ ] 14.3 Create analytics dashboard
    - Display bundle generation metrics
    - Show unlock success rates
    - Track predicate usage patterns
    - _Requirements: 7.5_

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Integration testing and deployment
  - [ ] 16.1 Write integration tests
    - Test full flow: session → bundle → NFT → unlock
    - Test multi-predicate scenarios
    - Test error recovery paths
    - _Requirements: All_
  
  - [ ] 16.2 Deploy to staging environment
    - Deploy all services
    - Run smoke tests
    - Monitor for errors
    - _Requirements: All_
  
  - [ ] 16.3 Production deployment
    - Deploy to production
    - Monitor metrics
    - Set up alerts
    - _Requirements: All_
