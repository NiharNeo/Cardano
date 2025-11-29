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
 * Build escrow script address
 */
function getEscrowAddress(): Cardano.Address {
  if (!escrowScript) {
    throw new Error('Escrow script not loaded');
  }
  
  const networkId = Cardano.NetworkId.new(NETWORK);
  const scriptHash = escrowScript.hash();
  const stakeCred = Cardano.StakeCredential.from_scripthash(scriptHash);
  const baseAddr = Cardano.BaseAddress.new(networkId, stakeCred, stakeCred);
  return baseAddr.to_address();
}

/**
 * Build escrow init transaction
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

  const escrowAddress = getEscrowAddress();
  const scriptAddress = escrowAddress.to_bech32();

  // Build datum
  const datum = buildEscrowDatum({
    learnerPubKeyHash: params.learnerPubKeyHash,
    mentorPubKeyHash: params.mentorPubKeyHash,
    priceLovelace: params.priceLovelace,
    sessionId: params.sessionId
  });

  // Convert datum to PlutusData (Aiken uses constructor-based structures)
  // EscrowDatum is a record, which Aiken compiles as constructor 0 with fields in order
  const fields = Cardano.PlutusList.new();
  fields.add(Cardano.PlutusData.new_bytes(Buffer.from(datum.learner, 'hex'))); // learner: ByteArray
  fields.add(Cardano.PlutusData.new_bytes(Buffer.from(datum.mentor, 'hex'))); // mentor: ByteArray
  fields.add(Cardano.PlutusData.new_integer(Cardano.BigInt.from_str(datum.price.toString()))); // price: Int
  fields.add(Cardano.PlutusData.new_bytes(sessionIdToBytes(datum.session))); // session: ByteArray
  // Bool in Aiken is compiled as constructor: false = 0, true = 1
  fields.add(Cardano.PlutusData.new_constr_plutus_data(
    Cardano.ConstrPlutusData.new(
      Cardano.BigNum.from_str(datum.learner_attested ? '1' : '0'),
      Cardano.PlutusList.new()
    )
  )); // learner_attested: Bool
  fields.add(Cardano.PlutusData.new_constr_plutus_data(
    Cardano.ConstrPlutusData.new(
      Cardano.BigNum.from_str(datum.mentor_attested ? '1' : '0'),
      Cardano.PlutusList.new()
    )
  )); // mentor_attested: Bool
  
  const datumData = Cardano.PlutusData.new_constr_plutus_data(
    Cardano.ConstrPlutusData.new(
      Cardano.BigNum.from_str('0'), // Constructor index 0 for EscrowDatum record
      fields
    )
  );

  // Build transaction
  const txBuilder = Cardano.TransactionBuilder.new(
    await getProtocolParameters(),
    Cardano.LinearFee.new(
      Cardano.BigNum.from_str('44'),
      Cardano.BigNum.from_str('155381')
    ),
    Cardano.BigNum.from_str('1000000'),
    Cardano.BigNum.from_str('34482'),
    Cardano.BigNum.from_str('34482')
  );

  // Add inputs
  const learnerAddr = addressFromBech32(params.learnerAddress);
  for (const utxo of params.learnerUTXOs.slice(0, 3)) { // Use first 3 UTXOs
    const txHash = Cardano.TransactionHash.from_bytes(Buffer.from(utxo.tx_hash, 'hex'));
    const txInput = Cardano.TransactionInput.new(txHash, utxo.output_index);
    txBuilder.add_input(
      learnerAddr,
      txInput,
      Cardano.Value.new(Cardano.BigNum.from_str(utxo.amount[0].quantity.toString()))
    );
  }

  // Add output to script address with inline datum
  const outputValue = Cardano.Value.new(Cardano.BigNum.from_str(params.priceLovelace.toString()));
  const output = Cardano.TransactionOutput.new(
    escrowAddress,
    outputValue
  );
  
  // Set inline datum
  const outputDatum = Cardano.TransactionOutputBuilder.new()
    .with_data_hash(datumData.hash());
  output.set_plutus_data(datumData);
  
  txBuilder.add_output(output);

  // Calculate fee and add change output
  const fee = txBuilder.min_fee();
  const totalInput = params.learnerUTXOs.slice(0, 3).reduce((sum, utxo) => 
    sum + BigInt(utxo.amount[0].quantity), BigInt(0)
  );
  const change = totalInput - BigInt(params.priceLovelace) - BigInt(fee.to_str());
  
  if (change > 0) {
    const changeOutput = Cardano.TransactionOutput.new(
      learnerAddr,
      Cardano.Value.new(Cardano.BigNum.from_str(change.toString()))
    );
    txBuilder.add_output(changeOutput);
  }

  // Build transaction body
  const txBody = txBuilder.build();
  const txHex = Buffer.from(txBody.to_bytes()).toString('hex');

  return {
    txHex,
    scriptAddress,
    datum
  };
}

/**
 * Build escrow attest transaction
 */
export async function buildEscrowAttestTx(params: {
  scriptUTXO: string; // Format: "txHash#index"
  redeemerType: 'AttestByLearner' | 'AttestByMentor';
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
  const txBuilder = Cardano.TransactionBuilder.new(
    await getProtocolParameters(),
    Cardano.LinearFee.new(
      Cardano.BigNum.from_str('44'),
      Cardano.BigNum.from_str('155381')
    ),
    Cardano.BigNum.from_str('1000000'),
    Cardano.BigNum.from_str('34482'),
    Cardano.BigNum.from_str('34482')
  );

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

  // Add script witness
  const scriptWitness = Cardano.ScriptWitness.new_plutus_script(
    Cardano.PlutusScriptWitness.new(
      Cardano.PlutusWitnessVersion.new_v2(),
      escrowScript,
      redeemerData,
      Cardano.PlutusData.new_map(Cardano.PlutusMap.new()) // Datum (inline)
    )
  );
  
  // Note: CSL doesn't expose add_script_witness directly on TransactionBuilder
  // This would need to be added to the transaction after building

  const txBody = txBuilder.build();
  const txHex = Buffer.from(txBody.to_bytes()).toString('hex');

  return { txHex };
}

/**
 * Build escrow claim transaction
 */
export async function buildEscrowClaimTx(params: {
  scriptUTXO: string;
  mentorAddress: string;
  mentorUTXOs: any[];
}): Promise<{ txHex: string }> {
  return buildEscrowAttestTx({
    scriptUTXO: params.scriptUTXO,
    redeemerType: 'ClaimFunds',
    signerAddress: params.mentorAddress,
    signerUTXOs: params.mentorUTXOs
  });
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
  const txBuilder = Cardano.TransactionBuilder.new(
    await getProtocolParameters(),
    Cardano.LinearFee.new(
      Cardano.BigNum.from_str('44'),
      Cardano.BigNum.from_str('155381')
    ),
    Cardano.BigNum.from_str('1000000'),
    Cardano.BigNum.from_str('34482'),
    Cardano.BigNum.from_str('34482')
  );

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

  // Mint NFT
  const assetNameBytes = Buffer.from(assetName, 'utf8');
  const mint = Cardano.Mint.new();
  mint.set(
    Cardano.ScriptHash.from_bytes(Buffer.from(policyId, 'hex')),
    Cardano.AssetName.new(assetNameBytes),
    Cardano.Int.new_i32(1) // Mint 1 token
  );
  txBuilder.set_mint(mint);

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
  const txHex = Buffer.from(txBody.to_bytes()).toString('hex');

  return {
    txHex,
    policyId,
    assetName
  };
}

