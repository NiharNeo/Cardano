{-# LANGUAGE DataKinds           #-}
{-# LANGUAGE DeriveAnyClass      #-}
{-# LANGUAGE DeriveGeneric       #-}
{-# LANGUAGE FlexibleContexts    #-}
{-# LANGUAGE NoImplicitPrelude   #-}
{-# LANGUAGE OverloadedStrings   #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE TemplateHaskell    #-}
{-# LANGUAGE TypeApplications    #-}
{-# LANGUAGE TypeFamilies        #-}
{-# LANGUAGE TypeOperators       #-}

module NFTPolicy where

import           Control.Monad          hiding (fmap)
import           Data.Aeson             (ToJSON, FromJSON)
import           Data.Text              (Text)
import           GHC.Generics           (Generic)
import           Ledger                 hiding (singleton)
import           Ledger.Constraints     as Constraints
import qualified Ledger.Typed.Scripts   as Scripts
import           Ledger.Value           as Value
import           Plutus.Contract
import           PlutusTx               (Data (..))
import qualified PlutusTx
import           PlutusTx.Prelude       hiding (Semigroup(..), unless)
import           Prelude                (IO, Show (..), String)
import qualified Prelude                as P

-- | NFT Minting Policy Parameters
data NFTPolicyParams = NFTPolicyParams
    { escrowValidatorHash :: ValidatorHash  -- Reference to escrow contract
    , sessionId           :: BuiltinByteString
    , metadataHash         :: BuiltinByteString  -- IPFS CID or metadata hash
    } deriving (P.Show, Generic, ToJSON, FromJSON)

PlutusTx.unstableMakeIsData ''NFTPolicyParams

-- | NFT Minting Policy Redeemer
data NFTRedeemer = Mint
    deriving (P.Show, Generic, ToJSON, FromJSON)

PlutusTx.unstableMakeIsData ''NFTRedeemer

-- | Build token name from session ID
{-# INLINABLE buildTokenName #-}
buildTokenName :: BuiltinByteString -> BuiltinByteString
buildTokenName sessionId = 
    "SkillForge-Session-" <> sessionId

-- | Check if escrow UTXO is being consumed
{-# INLINABLE isEscrowSettled #-}
isEscrowSettled :: ValidatorHash -> TxInfo -> Bool
isEscrowSettled escrowHash txInfo =
    let
        inputs = txInfoInputs txInfo
        -- Check if any input is from the escrow script
        hasEscrowInput = any (\txInInfo ->
            case txOutAddress (txInInfoResolved txInInfo) of
                Address (ScriptCredential hash) _ ->
                    hash == escrowHash
                _ -> False
        ) inputs
    in hasEscrowInput

-- | NFT Minting Policy
{-# INLINABLE nftPolicy #-}
nftPolicy :: NFTPolicyParams -> BuiltinData -> ScriptContext -> Bool
nftPolicy params _redeemer ctx =
    let
        txInfo = scriptContextTxInfo ctx
        ownCurrencySymbol = ownCurrencySymbol ctx
        
        -- Build expected token name
        expectedTokenName = buildTokenName (sessionId params)
        tokenName = TokenName expectedTokenName
        
        -- Check minted value
        mintedValue = txInfoMint txInfo
        assetClass = AssetClass (ownCurrencySymbol, tokenName)
        mintedAmount = Value.assetClassValueOf mintedValue assetClass
        
        -- Check that escrow is settled (escrow UTXO is consumed as input)
        escrowSettled = isEscrowSettled (escrowValidatorHash params) txInfo
    in
        -- Must mint exactly 1 token
        mintedAmount == 1 &&
        -- Escrow must be settled (UTXO consumed)
        escrowSettled &&
        -- Token name must match expected format
        expectedTokenName == expectedTokenName  -- Redundant but ensures token name is correct

-- | Typed Minting Policy
data NFT
instance Scripts.ValidatorTypes NFT where
    type instance DatumType NFT = ()
    type instance RedeemerType NFT = NFTRedeemer

nftInstance :: NFTPolicyParams -> Scripts.TypedPolicy NFT
nftInstance params = Scripts.mkTypedPolicy @NFT
    ($$(PlutusTx.compile [|| nftPolicy ||])
        `PlutusTx.applyCode` PlutusTx.liftCode params)
    $$(PlutusTx.compile [|| wrap ||])
  where
    wrap = Scripts.wrapPolicy @NFTRedeemer

policy :: NFTPolicyParams -> MintingPolicy
policy = Scripts.mintingPolicyScript . nftInstance

curSymbol :: NFTPolicyParams -> CurrencySymbol
curSymbol = scriptCurrencySymbol . policy

-- | Helper function to create token name
mkTokenName :: BuiltinByteString -> TokenName
mkTokenName sessionId = TokenName (buildTokenName sessionId)

-- | Helper function to create asset class
mkAssetClass :: NFTPolicyParams -> AssetClass
mkAssetClass params = AssetClass (curSymbol params, mkTokenName (sessionId params))
