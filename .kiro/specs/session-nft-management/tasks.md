# Implementation Plan

- [ ] 1. Set up testing infrastructure and IPFS integration
  - Install fast-check library for property-based testing
  - Install IPFS client library (ipfs-http-client or similar)
  - Create test utilities for generating session metadata
  - Create test utilities for generating mock IPFS CIDs
  - Create test utilities for generating valid UUIDs
  - Set up test database with nft_metadata table
  - Configure IPFS gateway URLs
  - _Requirements: All (testing foundation)_

- [ ] 2. Implement session ID to ByteArray conversion
  - Create sessionIdToBytes function that removes UUID dashes
  - Convert hex string to Buffer/Uint8Array
  - Validate output is exactly 16 bytes
  - Add error handling for invalid UUID formats
  - _Requirements: 4.2_

- [ ]* 2.1 Write property test for session ID conversion
  - **Property 15: Session ID converts correctly**
  - **Validates: Requirements 4.2**

- [ ] 3. Implement asset name generation
  - Create function to generate asset name with format 'SkillForge-Session-{sessionId}'
  - Encode asset name as UTF-8 bytes
  - Create Cardano.AssetName from bytes
  - Validate asset name length is within Cardano limits
  - _Requirements: 4.1, 4.3_

- [ ]* 3.1 Write property test for asset name generation
  - **Property 14: Asset name follows format**
  - **Property 16: Asset name encoded as UTF-8**
  - **Validates: Requirements 4.1, 4.3**

- [ ] 4. Implement policy ID derivation
  - Load minting policy Plutus script from contracts directory
  - Calculate script hash using Cardano.PlutusScript.hash()
  - Convert hash to hex string for policy ID
  - Add error handling for script loading failures
  - _Requirements: 4.4, 5.1_

- [ ]* 4.1 Write property test for policy ID derivation
  - **Property 17: Policy ID derived from script hash**
  - **Property 19: Minting script loaded successfully**
  - **Validates: Requirements 4.4, 5.1**

- [ ] 5. Implement NFT redeemer construction
  - Create buildNFTMintRedeemer function
  - Build Mint redeemer with constructor index 0
  - Add session ByteArray as field in redeemer
  - Use Aiken format with PlutusData.new_constr_plutus_data
  - _Requirements: 1.3, 5.2_

- [ ]* 5.1 Write property test for redeemer construction
  - **Property 3: Redeemer contains session ID**
  - **Validates: Requirements 1.3, 5.2**

- [ ] 6. Implement multi-asset value creation
  - Create function to build Value with ADA + NFT
  - Set base value to minimum UTXO (2 ADA = 2,000,000 Lovelace)
  - Create MultiAsset with policy ID and asset name
  - Set NFT quantity to 1
  - Add multi-asset to value
  - _Requirements: 5.4_

- [ ]* 6.1 Write property test for multi-asset value
  - **Property 21: Output includes NFT with minimum ADA**
  - **Validates: Requirements 5.4**

- [ ] 7. Implement buildNFTMintTx function
  - Load minting policy script
  - Calculate policy ID and generate asset name
  - Build Mint redeemer with session ID
  - Create transaction builder with protocol parameters
  - Add learner UTXOs as inputs
  - Create mint operation with policy ID, asset name, quantity 1
  - Add output to learner address with NFT in multi-asset value
  - Calculate fees and add change output
  - Return txHex, policyId, and assetName
  - _Requirements: 1.2, 1.4, 5.3, 5.5_

- [ ]* 7.1 Write property test for mint transaction building
  - **Property 2: Mint creates exactly one token**
  - **Property 4: NFT sent to learner**
  - **Property 20: Mint operation specifies correct parameters**
  - **Property 22: Transaction builder returns complete response**
  - **Validates: Requirements 1.2, 1.4, 5.3, 5.5**

- [ ] 8. Implement CIP-25 metadata generation
  - Create generateNFTMetadata function
  - Build JSON structure with "721" top-level key
  - Nest policy ID and asset name objects
  - Include name, description, and image fields
  - Add attributes object with session details (ID, skill, duration, budget, learner, mentor, completed)
  - Validate all required fields are present
  - _Requirements: 3.1, 3.2_

- [ ]* 8.1 Write property test for metadata generation
  - **Property 9: Metadata contains all required fields**
  - **Property 10: Metadata conforms to CIP-25**
  - **Validates: Requirements 3.1, 3.2**

- [ ] 9. Implement IPFS upload service
  - Create uploadMetadataToIPFS function that uploads JSON
  - Create uploadImageToIPFS function that uploads image buffer
  - Return CID for uploaded content
  - Add error handling for IPFS service failures
  - Add retry logic for transient failures
  - Construct IPFS gateway URLs from CIDs
  - _Requirements: 3.3, 3.4, 7.3_

- [ ]* 9.1 Write property test for IPFS integration
  - **Property 11: IPFS upload returns CID**
  - **Property 27: IPFS URLs constructed correctly**
  - **Validates: Requirements 3.3, 7.3**

- [ ] 10. Implement metadata storage in database
  - Create function to insert/update nft_metadata record
  - Store ipfs_hash, image_cid, and metadata_json
  - Set minted flag to false initially
  - Update minted flag and minted_at timestamp after successful mint
  - _Requirements: 3.5, 8.3_

- [ ]* 10.1 Write property test for metadata storage
  - **Property 13: Metadata stored in database**
  - **Property 31: Minted flag updated atomically**
  - **Validates: Requirements 3.5, 8.3**

- [ ] 11. Implement session eligibility validation
  - Create function to check if session can be minted
  - Query sessions table for session status
  - Verify status is 'completed' or 'paid'
  - Return error if status is 'initiated' or 'active'
  - Return error if session not found
  - _Requirements: 1.1, 9.1, 9.2_

- [ ]* 11.1 Write property test for eligibility validation
  - **Property 1: Mint requires completed session**
  - **Property 33: Completed sessions can mint**
  - **Validates: Requirements 1.1, 9.1, 9.3**

- [ ] 12. Implement duplicate mint prevention
  - Create function to check if NFT already minted
  - Query nft_metadata table for session_id
  - Check if minted flag is true
  - Return error if already minted
  - Use database transaction for atomic check-and-set
  - _Requirements: 8.1, 8.2_

- [ ]* 12.1 Write property test for duplicate prevention
  - **Property 30: Duplicate check queries database**
  - **Validates: Requirements 8.1**

- [ ] 13. Implement POST /nft/mint endpoint
  - Validate required fields: sessionId, learnerAddress
  - Check session eligibility (completed or paid status)
  - Check NFT not already minted
  - Query session details from database
  - Generate NFT metadata with session information
  - Upload metadata to IPFS (and image if available)
  - Store metadata in database
  - Fetch learner UTXOs
  - Call buildNFTMintTx with parameters
  - Return txHex, policyId, assetName, ipfsCid, imageCid, metadataUrl, imageUrl
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 13.1 Write property test for mint endpoint
  - **Property 12: Image included when available**
  - **Property 18: Response includes policy ID and asset name**
  - **Property 34: Minting proceeds when conditions met**
  - **Validates: Requirements 3.4, 4.5, 9.4**

- [ ] 14. Implement POST /nft/update endpoint (after mint submission)
  - Validate required fields: sessionId, txId
  - Update nft_metadata with minted=true and minted_at timestamp
  - Verify session and escrow status remain unchanged
  - Return success message
  - _Requirements: 1.5, 9.5_

- [ ]* 14.1 Write property test for update endpoint
  - **Property 5: Database updated after mint**
  - **Property 35: Minting preserves session status**
  - **Validates: Requirements 1.5, 9.5**

- [ ] 15. Implement GET /nft/status/:sessionId endpoint
  - Validate sessionId parameter
  - Query nft_metadata table
  - Return 404 if session not found
  - Return minted flag, ipfsHash, imageCid, metadataJson, mintedAt
  - Return null values for IPFS fields if not minted
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ]* 15.1 Write property test for status endpoint
  - **Property 23: Status query returns minted flag**
  - **Property 24: Minted NFT status includes all fields**
  - **Property 25: Unminted NFT status has null IPFS fields**
  - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 16. Implement POST /nft/metadata/:sessionId endpoint
  - Validate sessionId parameter
  - Query session details from database
  - Generate metadata JSON without minting
  - Return metadataJson, ipfsUrl (if uploaded), imageUrl (if available)
  - Useful for preview before minting
  - _Requirements: 7.5_

- [ ]* 16.1 Write property test for metadata endpoint
  - **Property 29: Metadata query returns hash and JSON**
  - **Validates: Requirements 7.5**

- [ ] 17. Update Aiken minting policy validator
  - Implement validation that exactly one asset is minted
  - Check list.length(minted_with_policy) == 1
  - Implement validation that quantity equals 1
  - Extract session ByteArray from Mint redeemer
  - Accept any valid ByteArray format for session
  - _Requirements: 2.1, 2.2, 2.5_

- [ ]* 17.1 Write property tests for validator logic
  - **Property 6: Validator rejects multiple assets**
  - **Property 7: Validator rejects wrong quantity**
  - **Property 8: Validator accepts valid ByteArray**
  - **Validates: Requirements 2.3, 2.4, 2.5**

- [ ] 18. Implement metadata CID on-chain association
  - Include metadata reference in mint transaction
  - Add metadata CID to transaction metadata (auxiliary data)
  - Follow CIP-25 on-chain metadata format
  - Verify metadata is queryable from blockchain
  - _Requirements: 7.2_

- [ ]* 18.1 Write property test for on-chain metadata
  - **Property 26: Metadata CID associated on-chain**
  - **Validates: Requirements 7.2**

- [ ] 19. Implement image CID referencing in metadata
  - When image is uploaded, get image CID
  - Include "image": "ipfs://{imageCID}" in metadata JSON
  - Verify image field format is correct
  - _Requirements: 7.4_

- [ ]* 19.1 Write property test for image referencing
  - **Property 28: Image referenced by CID in metadata**
  - **Validates: Requirements 7.4**

- [ ] 20. Add comprehensive error handling
  - Add validation for invalid session ID format (return 400)
  - Add validation for session not found (return 404)
  - Add validation for session not completed (return 400)
  - Add validation for NFT already minted (return 400)
  - Add validation for missing required fields (return 400)
  - Add error handling for IPFS upload failures (return 500)
  - Add error handling for database query failures (return 500)
  - Add error handling for script loading failures
  - Add error handling for insufficient UTXOs (return 400)
  - _Requirements: 6.4, 6.5, 9.2_

- [ ]* 20.1 Write property test for error handling
  - **Property 32: Failed mint preserves status**
  - **Validates: Requirements 8.5**

- [ ] 21. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 22. Write integration tests for end-to-end flows
  - Test complete NFT minting flow: complete session → upload metadata → mint → verify on-chain
  - Test duplicate prevention: mint → attempt second mint (should fail)
  - Test error scenarios: incomplete session, invalid session ID, already minted
  - Test IPFS integration: upload → retrieve → verify content
  - Test database state transitions throughout flows
  - _Requirements: All_

- [ ]* 23. Write Aiken unit tests for minting policy
  - Test minting exactly one token (should succeed)
  - Test minting multiple tokens (should fail)
  - Test minting quantity 0 (should fail)
  - Test minting quantity 2 (should fail)
  - Test with various session ID ByteArrays (should succeed)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 24. Write IPFS integration tests
  - Test metadata upload and retrieval
  - Test image upload and retrieval
  - Test CID validation
  - Test gateway URL construction
  - Test with large files
  - Test error handling for IPFS failures
  - _Requirements: 3.3, 3.4, 7.3_

- [ ] 25. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
