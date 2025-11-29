/* eslint-disable @typescript-eslint/no-explicit-any */
// This file demonstrates how you would construct an unsigned Cardano mint transaction
// using @emurgo/cardano-serialization-lib-browser from the frontend.
//
// The function below is intentionally simplified and omits:
// - full fee calculation
// - change output computation
// - collateral, reference scripts, etc.
//
// For a production dapp, you would mirror this logic in a backend service or
// in a wallet-integrated flow (e.g. CIP-30), using up-to-date protocol params.

import type {
  Address,
  AssetName,
  BigNum,
  LinearFee,
  MultiAsset,
  PolicyID,
  ScriptHash,
  Transaction,
  TransactionBuilder,
  TransactionBody,
  TransactionHash,
  TransactionOutput,
  TransactionUnspentOutput,
  TransactionUnspentOutputs,
  Value
} from '@emurgo/cardano-serialization-lib-browser';

// Dynamically import the WASM library to avoid loading cost before needed.
const loadCSL = async () => {
  const mod = await import('@emurgo/cardano-serialization-lib-browser');
  return mod;
};

export interface UtxoFromBlockfrost {
  tx_hash: string;
  output_index: number;
  amount: Array<{ unit: string; quantity: string }>;
  address: string;
}

export interface BuildMintTxArgs {
  userAddressBech32: string;
  utxos: UtxoFromBlockfrost[];
  metadataCid: string;
  policyIdHex: string;
  assetName: string;
}

/**
 * Build an unsigned transaction that mints a single NFT with metadata
 * whose content is stored on IPFS (referenced by CID).
 *
 * @returns hex-encoded CBOR of the unsigned Transaction
 */
export async function buildMintTxUnsignedCborHex(args: BuildMintTxArgs): Promise<string> {
  const CSL = await loadCSL();

  // ----- Setup protocol parameters (placeholder values) -----
  // In a real app you must fetch these from your backend /protocol-params
  // and plug them into TransactionBuilderConfig.
  const linearFee: LinearFee = CSL.LinearFee.new(
    // min_fee_a, min_fee_b
    CSL.BigNum.from_str('44'),
    CSL.BigNum.from_str('155381')
  );

  const coinsPerUtxoWord: BigNum = CSL.BigNum.from_str('34482'); // example only
  const poolDeposit: BigNum = CSL.BigNum.from_str('500000000');
  const keyDeposit: BigNum = CSL.BigNum.from_str('2000000');

  const txBuilderCfg = CSL.TransactionBuilderConfigBuilder.new()
    .fee_algo(linearFee)
    .coins_per_utxo_word(coinsPerUtxoWord)
    .pool_deposit(poolDeposit)
    .key_deposit(keyDeposit)
    .max_tx_size(16384)
    .max_value_size(5000)
    .build();

  const txBuilder: TransactionBuilder = CSL.TransactionBuilder.new(txBuilderCfg);

  // ----- Inputs from UTXOs (Blockfrost payload) -----
  const txInputs: TransactionUnspentOutputs = CSL.TransactionUnspentOutputs.new();
  args.utxos.forEach((u) => {
    const txHash: TransactionHash = CSL.TransactionHash.from_bytes(Buffer.from(u.tx_hash, 'hex'));
    const input = CSL.TransactionInput.new(txHash, u.output_index);

    let totalAda = CSL.BigNum.from_str('0');
    u.amount.forEach((a) => {
      if (a.unit === 'lovelace') {
        totalAda = totalAda.checked_add(CSL.BigNum.from_str(a.quantity));
      }
    });

    const outputVal: Value = CSL.Value.new(totalAda);
    const outputAddr: Address = CSL.Address.from_bech32(u.address);
    const txOut: TransactionOutput = CSL.TransactionOutput.new(outputAddr, outputVal);
    const utxo: TransactionUnspentOutput = CSL.TransactionUnspentOutput.new(input, txOut);

    txInputs.add(utxo);
  });

  for (let i = 0; i < txInputs.len(); i += 1) {
    txBuilder.add_input(
      txInputs.get(i).output().address(),
      txInputs.get(i).input(),
      txInputs.get(i).output().amount()
    );
  }

  const userAddress: Address = CSL.Address.from_bech32(args.userAddressBech32);

  // ----- Build mint assets -----
  const policyId: PolicyID = CSL.ScriptHash.from_bytes(Buffer.from(args.policyIdHex, 'hex'));
  const assetNameBytes = Buffer.from(args.assetName, 'utf8');
  const assetName: AssetName = CSL.AssetName.new(assetNameBytes);

  const multiAsset: MultiAsset = CSL.MultiAsset.new();
  const assets = CSL.Assets.new();
  assets.insert(assetName, CSL.BigNum.from_str('1')); // Mint exactly 1 NFT
  multiAsset.insert(policyId, assets);

  const nftValue: Value = CSL.Value.new(CSL.BigNum.from_str('2000000')); // 2 ADA min for NFT UTXO
  nftValue.set_multiasset(multiAsset);

  const nftOutput: TransactionOutput = CSL.TransactionOutput.new(userAddress, nftValue);
  txBuilder.add_output(nftOutput);

  // ----- Attach metadata with IPFS CID -----
  const metadata = CSL.GeneralTransactionMetadata.new();
  const label = CSL.BigNum.from_str('721');

  const metadatum = CSL.encode_json_str_to_metadatum(
    JSON.stringify({
      [args.policyIdHex]: {
        [args.assetName]: {
          name: args.assetName,
          image: `ipfs://${args.metadataCid}`
        }
      }
    }),
    0
  );

  metadata.insert(label, metadatum);
  const auxData = CSL.AuxiliaryData.new();
  auxData.set_metadata(metadata);
  txBuilder.set_auxiliary_data(auxData);

  // ----- Balance, fee and change output -----
  // In a real app:
  // - call txBuilder.add_change_if_needed(userAddress)
  // - then compute fee and ensure enough inputs were added.
  txBuilder.add_change_if_needed(userAddress);

  const txBody: TransactionBody = txBuilder.build();
  const unsignedTx: Transaction = CSL.Transaction.new(txBody, auxData, undefined);

  const cborHex = Buffer.from(unsignedTx.to_bytes()).toString('hex');
  return cborHex;
}


