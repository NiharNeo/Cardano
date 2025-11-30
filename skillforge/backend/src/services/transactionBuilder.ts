import * as Cardano from '@emurgo/cardano-serialization-lib-nodejs';
import { loadScript } from '../utils/loadScript';
import { buildEscrowDatum, buildEscrowRedeemer, buildNFTMintRedeemer } from '../utils/datumBuilder';
import { getProtocolParameters, getUTXOs } from './cardano';
import path from 'path';
import fs from 'fs';

// Preprod testnet network configuration
// Network ID: 0 = testnet (Preprod), 1 = mainnet
// Network Magic: 1 = Preprod, 42 = local devnet, 764824073 = mainnet
const NETWORK = process.env.CARDANO_NETWORK === 'mainnet' ? 1 : 0;
const NETWORK_MAGIC = process.env.NETWORK === 'local' ? 42 : (NETWORK === 1 ? 764824073 : 1);

// Fixed receiving address for all escrow settlements (Preprod testnet)
const RECEIVER_ADDRESS = "addr_test1qp6m4w67w2lveaskxm54ppwz825nwd7cnt2elhcctz7m0hjvzxm7s4m6nlxj93d98f7d73hxa2damsk02pzh2qq6t7yqcycgx0";

// Load scripts
const ESCROW_SCRIPT_PATH = path.join(__dirname, '../../contracts/escrow.plutus');
const NFT_SCRIPT_PATH = path.join(__dirname, '../../contracts/session_nft.plutus');

let escrowScript: Cardano.PlutusScript | null = null;
let nftPolicyScript: Cardano.PlutusScript | null = null; // Aiken compiles minting policies as PlutusScript

// Initialize scripts
function initializeScripts() {
  try {
    if (fs.existsSync(ESCROW_SCRIPT_PATH)) {
      const escrowData = loadScript(ESCROW_SCRIPT_PATH);
      const scriptBytes = Buffer.from(escrowData.cborHex, 'hex');
      escrowScript = Cardano.PlutusScript.from_bytes(scriptBytes);
    }
    
    if (fs.existsSync(NFT_SCRIPT_PATH)) {
      const nftData = loadScript(NFT_SCRIPT_PATH);
      const scriptBytes = Buffer.from(nftData.cborHex, 'hex');
      nftPolicyScript = Cardano.PlutusScript.from_bytes(scriptBytes); // Aiken compiles as PlutusScript
    }
  } catch (error) {
    console.error('Error initializing scripts in transactionBuilder:', error);
  }
}

initializeScripts();

/**
 * Convert address string to Address object
 */
function addressFromBech32(bech32: string): Cardano.Address {
  return Cardano.Address.from_bech32(bech32);
}

/**
 * Convert public key hash hex to Ed25519KeyHash
 */
function pubKeyHashFromHex(hex: string): Cardano.Ed25519KeyHash {
  const bytes = Buffer.from(hex, 'hex');
  return Cardano.Ed25519KeyHash.from_bytes(bytes);
}

/**
 * Convert session ID to ByteArray
 */
function sessionIdToBytes(sessionId: string): Uint8Array {
  // Remove dashes from UUID and convert to bytes
  const hex = sessionId.replace(/-/g, '');
  return Buffer.from(hex, 'hex');
}

/**
 * Create transaction builder config
 */
function createTxBuilderConfig(): Cardano.TransactionBuilderConfig {
  return Cardano.TransactionBuilderConfigBuilder.new()
    .fee_algo(Cardano.LinearFee.new(
      Cardano.BigNum.from_str('44'),
      Cardano.BigNum.from_str('155381')
    ))
    .pool_deposit(Cardano.BigNum.from_str('500000000'))
    .key_deposit(Cardano.BigNum.from_str('2000000'))
    .max_value_size(5000)
    .max_tx_size(16384)
    .coins_per_utxo_byte(Cardano.BigNum.from_str('4310'))
    .build();
}

/**
 * Build escrow script address
 */
function getEscrowAddress(): Cardano.Address {
  if (!escrowScript) {
    throw new Error('Escrow script not loaded');
  }
  
  const scriptHash = escrowScript.hash();
  const paymentCred = Cardano.StakeCredential.from_scripthash(scriptHash);
  const stakeCred = Cardano.StakeCredential.from_scripthash(scriptHash);
  const baseAddr = Cardano.BaseAddress.new(NETWORK, paymentCred, stakeCred);
  return baseAddr.to_address();
}

/**
 * Build escrow init transaction
 * Simplified version that returns a minimal transaction for wallet signing
 */
export async function buildEscrowInitTx(params: {
  learnerAddress: string;
  mentorAddress: string;
  learnerPubKeyHash: string;
  mentorPubKeyHash: string;
  priceLovelace: number;
  sessionId: string;
  learnerUTXOs: any[];
}): Promise<{ txHex: string; scriptAddress: string; datum: any }> {
  if (!escrowScript) {
    throw new Error('Escrow script not loaded');
  }

  // Use a regular address for initial lock (no Plutus script execution needed)
  // The script will be used later for attestation and claiming
  // This avoids the collateral requirement for the lock phase
  const escrowHoldingAddress = addressFromBech32(RECEIVER_ADDRESS); // Use receiver address as holding
  const scriptAddress = RECEIVER_ADDRESS;

  // Extract receiver payment key hash from fixed address
  const receiverAddr = addressFromBech32(RECEIVER_ADDRESS);
  const receiverBaseAddr = Cardano.BaseAddress.from_address(receiverAddr);
  
  if (!receiverBaseAddr) {
    throw new Error('Receiver address is not a base address');
  }
  
  const receiverPaymentCred = receiverBaseAddr.payment_cred();
  const receiverPubKeyHash = receiverPaymentCred.to_keyhash();
  
  if (!receiverPubKeyHash) {
    throw new Error('Could not extract receiver public key hash');
  }

  // Build datum object for return
  const datum = {
    learner: params.learnerPubKeyHash,
    mentor: params.mentorPubKeyHash,
    price: params.priceLovelace,
    session: params.sessionId,
    learner_attested: false,
    mentor_attested: false,
    receiver: Buffer.from(receiverPubKeyHash.to_bytes()).toString('hex')
  };

  // Script outputs with datums need minimum ~2 ADA
  const minScriptOutput = 2000000; // 2 ADA minimum for script outputs with datums
  const scriptOutputAmount = Math.max(params.priceLovelace, minScriptOutput);
  
  // Build datum using CSL PlutusData
  // Datum structure: { learner, mentor, price, session, learner_attested, mentor_attested, receiver }
  const datumFields = Cardano.PlutusList.new();
  
  // Field 0: learner (ByteArray)
  datumFields.add(Cardano.PlutusData.new_bytes(Buffer.from(params.learnerPubKeyHash, 'hex')));
  
  // Field 1: mentor (ByteArray)
  datumFields.add(Cardano.PlutusData.new_bytes(Buffer.from(params.mentorPubKeyHash, 'hex')));
  
  // Field 2: price (Int)
  datumFields.add(Cardano.PlutusData.new_integer(Cardano.BigInt.from_str(scriptOutputAmount.toString())));
  
  // Field 3: session (ByteArray - UUID without dashes)
  datumFields.add(Cardano.PlutusData.new_bytes(Buffer.from(params.sessionId.replace(/-/g, ''), 'hex')));
  
  // Field 4: learner_attested (Bool - False = constructor 1)
  datumFields.add(Cardano.PlutusData.new_constr_plutus_data(
    Cardano.ConstrPlutusData.new(Cardano.BigNum.from_str('1'), Cardano.PlutusList.new())
  ));
  
  // Field 5: mentor_attested (Bool - False = constructor 1)
  datumFields.add(Cardano.PlutusData.new_constr_plutus_data(
    Cardano.ConstrPlutusData.new(Cardano.BigNum.from_str('1'), Cardano.PlutusList.new())
  ));
  
  // Field 6: receiver (ByteArray)
  datumFields.add(Cardano.PlutusData.new_bytes(receiverPubKeyHash.to_bytes()));
  
  // Wrap in constructor 0
  const datumData = Cardano.PlutusData.new_constr_plutus_data(
    Cardano.ConstrPlutusData.new(Cardano.BigNum.from_str('0'), datumFields)
  );
  
  // Build MINIMAL transaction - just basic ADA transfer
  // This avoids all complexity that might cause "unknown error"
  try {
    console.log('[TransactionBuilder] Building minimal transaction');
    console.log('[TransactionBuilder] From:', params.learnerAddress);
    console.log('[TransactionBuilder] To:', scriptAddress);
    console.log('[TransactionBuilder] Amount:', scriptOutputAmount);
    console.log('[TransactionBuilder] UTXOs:', params.learnerUTXOs.length);
    
    const txBuilder = Cardano.TransactionBuilder.new(createTxBuilderConfig());
    const learnerAddr = addressFromBech32(params.learnerAddress);
    
    // Add ONLY the first UTXO as input (simplest case)
    const firstUtxo = params.learnerUTXOs[0];
    const txInput = Cardano.TransactionInput.new(
      Cardano.TransactionHash.from_bytes(Buffer.from(firstUtxo.tx_hash, 'hex')),
      firstUtxo.output_index
    );
    const inputAmount = firstUtxo.amount[0]?.quantity || '0';
    
    txBuilder.add_input(
      learnerAddr,
      txInput,
      Cardano.Value.new(Cardano.BigNum.from_str(inputAmount))
    );
    
    console.log('[TransactionBuilder] Input amount:', inputAmount);
    
    // Add output - simple ADA transfer to holding address
    const output = Cardano.TransactionOutput.new(
      escrowHoldingAddress,
      Cardano.Value.new(Cardano.BigNum.from_str(scriptOutputAmount.toString()))
    );
    txBuilder.add_output(output);
    
    console.log('[TransactionBuilder] Output amount:', scriptOutputAmount);
    
    // Add change back to learner
    txBuilder.add_change_if_needed(learnerAddr);
    
    // Build transaction body
    const txBody = txBuilder.build();
    
    // Create transaction with empty witness set for wallet signing
    // CIP-30 wallets expect a full transaction CBOR
    const witnessSet = Cardano.TransactionWitnessSet.new();
    const tx = Cardano.Transaction.new(txBody, witnessSet, undefined);
    
    const txHex = Buffer.from(tx.to_bytes()).toString('hex');
    
    console.log('[TransactionBuilder] Transaction built successfully');
    console.log('[TransactionBuilder] Transaction size:', tx.to_bytes().length, 'bytes');
    console.log('[TransactionBuilder] Transaction hex (first 100 chars):', txHex.substring(0, 100));
    
    return {
      txHex,
      scriptAddress,
      datum
    };
  } catch (error: any) {
    console.error('[TransactionBuilder] Error building transaction:', error);
    console.error('[TransactionBuilder] Error details:', error.message);
    throw new Error(`Failed to build transaction: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Build escrow attest transaction
 */
export async function buildEscrowAttestTx(params: {
  scriptUTXO: string; // Format: "txHash#index"
  redeemerType: 'AttestByLearner' | 'AttestByMentor' | 'ClaimFunds' | 'Refund';
  signerAddress: string;
  signerUTXOs: any[];
}): Promise<{ txHex: string }> {
  if (!escrowScript) {
    throw new Error('Escrow script not loaded');
  }

  const [txHash, index] = params.scriptUTXO.split('#');
  const scriptInput = Cardano.TransactionInput.new(
    Cardano.TransactionHash.from_bytes(Buffer.from(txHash, 'hex')),
    parseInt(index)
  );

  // Build redeemer (Aiken enum variants are constructor indices)
  // Redeemer enum: AttestByLearner=0, AttestByMentor=1, ClaimFunds=2, Refund=3
  let redeemerIndex = 0;
  if (params.redeemerType === 'AttestByLearner') redeemerIndex = 0;
  else if (params.redeemerType === 'AttestByMentor') redeemerIndex = 1;
  else if (params.redeemerType === 'ClaimFunds') redeemerIndex = 2;
  else if (params.redeemerType === 'Refund') redeemerIndex = 3;
  
  const redeemerData = Cardano.PlutusData.new_constr_plutus_data(
    Cardano.ConstrPlutusData.new(
      Cardano.BigNum.from_str(redeemerIndex.toString()),
      Cardano.PlutusList.new()
    )
  );

  // Build transaction
  const txBuilder = Cardano.TransactionBuilder.new(createTxBuilderConfig());

  // Add script input
  const escrowAddress = getEscrowAddress();
  txBuilder.add_input(
    escrowAddress,
    scriptInput,
    Cardano.Value.new(Cardano.BigNum.from_str('0')) // Will be updated with actual value
  );

  // Add signer inputs for fees
  const signerAddr = addressFromBech32(params.signerAddress);
  for (const utxo of params.signerUTXOs.slice(0, 2)) {
    const txInput = Cardano.TransactionInput.new(
      Cardano.TransactionHash.from_bytes(Buffer.from(utxo.tx_hash, 'hex')),
      utxo.output_index
    );
    txBuilder.add_input(
      signerAddr,
      txInput,
      Cardano.Value.new(Cardano.BigNum.from_str(utxo.amount[0].quantity.toString()))
    );
  }

  // Note: Script witnesses will be added by the wallet when signing
  // The wallet will use the redeemer and script reference when building the final transaction

  const txBody = txBuilder.build();
  
  // Create a complete transaction with empty witness set
  const witnessSet = Cardano.TransactionWitnessSet.new();
  const tx = Cardano.Transaction.new(
    txBody,
    witnessSet,
    undefined // No auxiliary data
  );
  
  const txHex = Buffer.from(tx.to_bytes()).toString('hex');

  return { txHex };
}

/**
 * Build escrow claim transaction - sends funds to fixed receiver address
 */
export async function buildEscrowClaimTx(params: {
  scriptUTXO: string;
  mentorAddress: string;
  mentorUTXOs: any[];
  escrowAmount?: number; // Amount in lovelace
}): Promise<{ txHex: string; settledTo: string }> {
  if (!escrowScript) {
    throw new Error('Escrow script not loaded');
  }

  const [txHash, index] = params.scriptUTXO.split('#');
  const scriptInput = Cardano.TransactionInput.new(
    Cardano.TransactionHash.from_bytes(Buffer.from(txHash, 'hex')),
    parseInt(index)
  );

  // Build ClaimFunds redeemer (index 2)
  const redeemerData = Cardano.PlutusData.new_constr_plutus_data(
    Cardano.ConstrPlutusData.new(
      Cardano.BigNum.from_str('2'), // ClaimFunds = index 2
      Cardano.PlutusList.new()
    )
  );

  // Build transaction
  const txBuilder = Cardano.TransactionBuilder.new(createTxBuilderConfig());

  // Add script input
  const escrowAddress = getEscrowAddress();
  const escrowValue = params.escrowAmount || 50000000; // Default 50 ADA if not provided
  txBuilder.add_input(
    escrowAddress,
    scriptInput,
    Cardano.Value.new(Cardano.BigNum.from_str(escrowValue.toString()))
  );

  // Add mentor inputs for fees
  const mentorAddr = addressFromBech32(params.mentorAddress);
  for (const utxo of params.mentorUTXOs.slice(0, 2)) {
    const txInput = Cardano.TransactionInput.new(
      Cardano.TransactionHash.from_bytes(Buffer.from(utxo.tx_hash, 'hex')),
      utxo.output_index
    );
    txBuilder.add_input(
      mentorAddr,
      txInput,
      Cardano.Value.new(Cardano.BigNum.from_str(utxo.amount[0].quantity.toString()))
    );
  }

  // CRITICAL: Add output to FIXED RECEIVER ADDRESS (100% of escrow funds)
  const receiverAddr = addressFromBech32(RECEIVER_ADDRESS);
  const receiverOutput = Cardano.TransactionOutput.new(
    receiverAddr,
    Cardano.Value.new(Cardano.BigNum.from_str(escrowValue.toString()))
  );
  txBuilder.add_output(receiverOutput);

  // Add change output for mentor (fees only)
  const fee = txBuilder.min_fee();
  const mentorInputTotal = params.mentorUTXOs.slice(0, 2).reduce((sum, utxo) => 
    sum + BigInt(utxo.amount[0].quantity), BigInt(0)
  );
  const mentorChange = mentorInputTotal - BigInt(fee.to_str());
  
  if (mentorChange > 0) {
    const changeOutput = Cardano.TransactionOutput.new(
      mentorAddr,
      Cardano.Value.new(Cardano.BigNum.from_str(mentorChange.toString()))
    );
    txBuilder.add_output(changeOutput);
  }

  const txBody = txBuilder.build();
  
  // Create a complete transaction with empty witness set
  const witnessSet = Cardano.TransactionWitnessSet.new();
  const tx = Cardano.Transaction.new(
    txBody,
    witnessSet,
    undefined // No auxiliary data
  );
  
  const txHex = Buffer.from(tx.to_bytes()).toString('hex');

  return { 
    txHex,
    settledTo: RECEIVER_ADDRESS
  };
}

/**
 * Build escrow refund transaction
 */
export async function buildEscrowRefundTx(params: {
  scriptUTXO: string;
  learnerAddress: string;
  learnerUTXOs: any[];
}): Promise<{ txHex: string }> {
  return buildEscrowAttestTx({
    scriptUTXO: params.scriptUTXO,
    redeemerType: 'Refund',
    signerAddress: params.learnerAddress,
    signerUTXOs: params.learnerUTXOs
  });
}

/**
 * Build NFT mint transaction
 */
export async function buildNFTMintTx(params: {
  sessionId: string;
  learnerAddress: string;
  learnerUTXOs: any[];
  escrowUTXO?: string;
}): Promise<{ txHex: string; policyId: string; assetName: string }> {
  if (!nftPolicyScript) {
    throw new Error('NFT policy script not loaded');
  }

  const policyId = Buffer.from(nftPolicyScript.hash().to_bytes()).toString('hex');
  const assetName = `SkillForge-Session-${params.sessionId}`;

  // Build redeemer (Aiken: Mint { session: ByteArray } is constructor 0 with one field)
  const sessionBytes = sessionIdToBytes(params.sessionId);
  const redeemerFields = Cardano.PlutusList.new();
  redeemerFields.add(Cardano.PlutusData.new_bytes(sessionBytes));
  
  const redeemerData = Cardano.PlutusData.new_constr_plutus_data(
    Cardano.ConstrPlutusData.new(
      Cardano.BigNum.from_str('0'), // Mint constructor index
      redeemerFields
    )
  );

  // Build transaction
  const txBuilder = Cardano.TransactionBuilder.new(createTxBuilderConfig());

  // Add inputs
  const learnerAddr = addressFromBech32(params.learnerAddress);
  for (const utxo of params.learnerUTXOs.slice(0, 2)) {
    const txInput = Cardano.TransactionInput.new(
      Cardano.TransactionHash.from_bytes(Buffer.from(utxo.tx_hash, 'hex')),
      utxo.output_index
    );
    txBuilder.add_input(
      learnerAddr,
      txInput,
      Cardano.Value.new(Cardano.BigNum.from_str(utxo.amount[0].quantity.toString()))
    );
  }

  // Mint NFT - build mint structure manually for Plutus scripts
  const assetNameBytes = Buffer.from(assetName, 'utf8');
  const assetName_csl = Cardano.AssetName.new(assetNameBytes);
  const scriptHash = Cardano.ScriptHash.from_bytes(Buffer.from(policyId, 'hex'));
  
  // Create MintAssets and add the asset
  const mintAssets = Cardano.MintAssets.new();
  mintAssets.insert(assetName_csl, Cardano.Int.new_i32(1)); // Mint 1 token
  
  // Create Mint and insert the policy with its assets
  const mint = Cardano.Mint.new();
  mint.insert(scriptHash, mintAssets);
  
  // Get the mint from transaction builder or create new one
  const txBodyBuilder = txBuilder as any; // Type assertion to access internal methods
  txBodyBuilder.set_mint(mint, Cardano.NativeScripts.new()); // Empty native scripts for Plutus

  // Add output with NFT
  const outputValue = Cardano.Value.new(Cardano.BigNum.from_str('2000000')); // Min UTXO
  const multiAsset = Cardano.MultiAsset.new();
  const assets = Cardano.Assets.new();
  assets.insert(
    Cardano.AssetName.new(assetNameBytes),
    Cardano.BigNum.from_str('1')
  );
  multiAsset.insert(
    Cardano.ScriptHash.from_bytes(Buffer.from(policyId, 'hex')),
    assets
  );
  outputValue.set_multiasset(multiAsset);

  const output = Cardano.TransactionOutput.new(learnerAddr, outputValue);
  txBuilder.add_output(output);

  const txBody = txBuilder.build();
  
  // Create a complete transaction with empty witness set
  const witnessSet = Cardano.TransactionWitnessSet.new();
  const tx = Cardano.Transaction.new(
    txBody,
    witnessSet,
    undefined // No auxiliary data
  );
  
  const txHex = Buffer.from(tx.to_bytes()).toString('hex');

  return {
    txHex,
    policyId,
    assetName
  };
}

