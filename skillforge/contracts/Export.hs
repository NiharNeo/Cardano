{-# LANGUAGE DataKinds     #-}
{-# LANGUAGE TypeOperators #-}

module Export where

import           Cardano.Api
import           Cardano.Api.Shelley     (PlutusScript (..), PlutusScriptV2)
import           Codec.Serialise
import qualified Data.ByteString.Lazy     as LBS
import qualified Data.ByteString.Short    as SBS
import qualified Data.ByteString          as BS
import           Plutus.V2.Ledger.Api    as Plutus
import qualified PlutusTx
import           Data.Aeson              as Aeson
import qualified Data.Text               as T

import           Escrow
import           NFTPolicy

-- | Example parameters for compilation
exampleLearnerPKH :: PubKeyHash
exampleLearnerPKH = "example_learner_pkh"

exampleProviderPKH :: PubKeyHash
exampleProviderPKH = "example_provider_pkh"

exampleEscrowParams :: EscrowParams
exampleEscrowParams = EscrowParams
    { learnerPubKeyHash = exampleLearnerPKH
    , providerPubKeyHash = exampleProviderPKH
    , price = 80000000  -- 80 ADA in Lovelace
    , sessionId = "session_123"
    }

exampleNFTPolicyParams :: NFTPolicyParams
exampleNFTPolicyParams = NFTPolicyParams
    { escrowValidatorHash = "example_escrow_hash"
    , sessionId = "session_123"
    , metadataHash = "QmExampleIPFSCID"
    }

-- | Serialize Plutus script to JSON format
serializeScriptToJSON :: PlutusScript PlutusScriptV2 -> Aeson.Value
serializeScriptToJSON (PlutusScriptSerialised script) =
    Aeson.object
        [ "type" .= ("PlutusScriptV2" :: String)
        , "description" .= ("SkillForge Plutus V2 Script" :: String)
        , "cborHex" .= (T.pack $ show script)
        ]

-- | Export Escrow Contract
exportEscrowContract :: IO ()
exportEscrowContract = do
    putStrLn "Compiling Escrow Contract..."
    
    let validatorScript = validator exampleEscrowParams
    let script = PlutusScriptSerialised $ SBS.toShort $ LBS.toStrict $ serialise validatorScript
    
    -- Write binary .plutus file
    result <- writeFileTextEnvelope @(PlutusScript PlutusScriptV2) Nothing "escrow.plutus" script
    case result of
        Left err -> print $ "Error writing escrow.plutus: " ++ show err
        Right () -> putStrLn "✓ Successfully exported escrow.plutus"
    
    -- Write JSON version
    let jsonScript = serializeScriptToJSON script
    BS.writeFile "escrow.plutus.json" (Aeson.encode jsonScript)
    putStrLn "✓ Successfully exported escrow.plutus.json"

-- | Export NFT Minting Policy
exportNFTPolicy :: IO ()
exportNFTPolicy = do
    putStrLn "Compiling NFT Minting Policy..."
    
    let policyScript = policy exampleNFTPolicyParams
    let script = PlutusScriptSerialised $ SBS.toShort $ LBS.toStrict $ serialise policyScript
    
    -- Write binary .plutus file
    result <- writeFileTextEnvelope @(PlutusScript PlutusScriptV2) Nothing "nft-policy.plutus" script
    case result of
        Left err -> print $ "Error writing nft-policy.plutus: " ++ show err
        Right () -> putStrLn "✓ Successfully exported nft-policy.plutus"
    
    -- Write JSON version
    let jsonScript = serializeScriptToJSON script
    BS.writeFile "nft-policy.plutus.json" (Aeson.encode jsonScript)
    putStrLn "✓ Successfully exported nft-policy.plutus.json"

main :: IO ()
main = do
    exportEscrowContract
    exportNFTPolicy
    putStrLn "\n✓ All contracts exported successfully!"

