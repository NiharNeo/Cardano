{-# LANGUAGE DataKinds     #-}
{-# LANGUAGE TypeOperators #-}

module Compile where

import           Cardano.Api
import           Cardano.Api.Shelley     (PlutusScript (..), PlutusScriptV2)
import           Codec.Serialise
import qualified Data.ByteString.Lazy   as LBS
import qualified Data.ByteString.Short   as SBS
import           Plutus.V2.Ledger.Api    as Plutus
import qualified PlutusTx

import           Escrow
import           NFTPolicy

-- | Serialize and write Plutus script to file
writePlutusScript :: FilePath -> PlutusScript PlutusScriptV2 -> IO (Either (FileError ()) ())
writePlutusScript = writeFileTextEnvelope @(PlutusScript PlutusScriptV2) Nothing

-- | Convert Plutus script to Cardano API format
plutusScriptToCardanoApi :: PlutusScript -> PlutusScript PlutusScriptV2
plutusScriptToCardanoApi (PlutusScriptSerialised script) = PlutusScriptSerialised script

-- | Compile Escrow Contract
compileEscrow :: IO ()
compileEscrow = do
    -- Example parameters (replace with actual values)
    let params = EscrowParams
            { learnerPubKeyHash = "example_learner_pkh"
            , providerPubKeyHash = "example_provider_pkh"
            , price = 80000000  -- 80 ADA in Lovelace
            , sessionId = "session_123"
            }
    
    let validatorScript = validator params
    let script = PlutusScriptSerialised $ SBS.toShort $ LBS.toStrict $ serialise validatorScript
    
    result <- writePlutusScript "escrow.plutus" (plutusScriptToCardanoApi script)
    case result of
        Left err -> print $ "Error writing escrow.plutus: " ++ show err
        Right () -> putStrLn "Successfully compiled escrow.plutus"

-- | Compile NFT Minting Policy
compileNFT :: IO ()
compileNFT = do
    -- Example parameters (replace with actual values)
    let params = NFTPolicyParams
            { escrowValidatorHash = "example_escrow_hash"
            , sessionId = "session_123"
            , metadataHash = "QmExampleIPFSCID"
            }
    
    let policyScript = policy params
    let script = PlutusScriptSerialised $ SBS.toShort $ LBS.toStrict $ serialise policyScript
    
    result <- writePlutusScript "nft-policy.plutus" (plutusScriptToCardanoApi script)
    case result of
        Left err -> print $ "Error writing nft-policy.plutus: " ++ show err
        Right () -> putStrLn "Successfully compiled nft-policy.plutus"

main :: IO ()
main = do
    compileEscrow
    compileNFT

