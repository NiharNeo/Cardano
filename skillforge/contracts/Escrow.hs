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
{-# LANGUAGE TypeOperators      #-}

module Escrow where

import           Control.Monad          hiding (fmap)
import           Data.Aeson             (ToJSON, FromJSON)
import           Data.Text              (Text)
import           GHC.Generics           (Generic)
import           Ledger                 hiding (singleton)
import           Ledger.Constraints     as Constraints
import qualified Ledger.Typed.Scripts   as Scripts
import           Ledger.Value           as Value
import           Ledger.Ada             as Ada
import           Plutus.Contract
import           PlutusTx               (Data (..))
import qualified PlutusTx
import           PlutusTx.Prelude       hiding (Semigroup(..), unless)
import           Prelude                (IO, Show (..), String)
import qualified Prelude                as P

-- | Escrow Contract Parameters
data EscrowParams = EscrowParams
    { learnerPubKeyHash :: PubKeyHash
    , providerPubKeyHash :: PubKeyHash
    , price             :: Integer  -- Price in Lovelace
    , sessionId          :: BuiltinByteString
    } deriving (P.Show, Generic, ToJSON, FromJSON)

PlutusTx.unstableMakeIsData ''EscrowParams

-- | Redeemer for Escrow Contract
data EscrowRedeemer = AttestLearner | AttestProvider | Complete | Refund
    deriving (P.Show, Generic, ToJSON, FromJSON)

PlutusTx.unstableMakeIsData ''EscrowRedeemer

-- | Escrow Contract Datum
data EscrowDatum = EscrowDatum
    { learnerAttestation :: Bool
    , providerAttestation :: Bool
    , lockedAt           :: POSIXTime
    } deriving (P.Show, Generic, ToJSON, FromJSON)

PlutusTx.unstableMakeIsData ''EscrowDatum

-- | Check if both parties have attested
bothAttested :: EscrowDatum -> Bool
bothAttested datum = learnerAttestation datum && providerAttestation datum

-- | Check if 48 hours have passed (48 hours = 172800000 milliseconds)
{-# INLINABLE isExpired #-}
isExpired :: POSIXTime -> POSIXTime -> Bool
isExpired lockedAt currentTime = 
    let fortyEightHours = 172800000  -- 48 hours in milliseconds
    in currentTime >= lockedAt + fortyEightHours

-- | Get current time from transaction valid range
{-# INLINABLE getCurrentTime #-}
getCurrentTime :: TxInfo -> POSIXTime
getCurrentTime txInfo = 
    case ivTo (txInfoValidRange txInfo) of
        UpperBound (Finite time) _ -> time
        _ -> error ()

-- | Escrow Contract Validator
{-# INLINABLE escrowValidator #-}
escrowValidator :: EscrowParams -> EscrowDatum -> EscrowRedeemer -> ScriptContext -> Bool
escrowValidator params datum redeemer ctx = 
    let
        txInfo = scriptContextTxInfo ctx
        currentTime = getCurrentTime txInfo
    in case redeemer of
        AttestLearner ->
            -- Learner can update their attestation
            txSignedBy txInfo (learnerPubKeyHash params) &&
            -- Must not be expired
            not (isExpired (lockedAt datum) currentTime) &&
            -- Check output datum is updated correctly
            validateDatumUpdate datum (learnerAttestation datum) True (providerAttestation datum) txInfo
        
        AttestProvider ->
            -- Provider can update their attestation
            txSignedBy txInfo (providerPubKeyHash params) &&
            -- Must not be expired
            not (isExpired (lockedAt datum) currentTime) &&
            -- Check output datum is updated correctly
            validateDatumUpdate datum (learnerAttestation datum) (providerAttestation datum) True txInfo
        
        Complete ->
            -- Both must have attested
            bothAttested datum &&
            -- Must pay provider the full amount
            validatePaymentToProvider params txInfo &&
            -- Must not be expired
            not (isExpired (lockedAt datum) currentTime)
        
        Refund ->
            -- Only learner can refund
            txSignedBy txInfo (learnerPubKeyHash params) &&
            -- Must be expired (48 hours passed)
            isExpired (lockedAt datum) currentTime &&
            -- Must refund to learner
            validateRefundToLearner params txInfo

-- | Validate datum update (for attestation transactions)
{-# INLINABLE validateDatumUpdate #-}
validateDatumUpdate :: EscrowDatum -> Bool -> Bool -> Bool -> TxInfo -> Bool
validateDatumUpdate oldDatum oldLearner newLearner newProvider txInfo =
    let
        -- Check that there's an output with updated datum
        outputs = txInfoOutputs txInfo
        hasUpdatedDatum = any (\out ->
            case txOutDatum out of
                OutputDatum newDatum -> 
                    let newDatumData = getDatum newDatum
                    in case PlutusTx.fromBuiltinData @EscrowDatum newDatumData of
                        Just updatedDatum ->
                            learnerAttestation updatedDatum == newLearner &&
                            providerAttestation updatedDatum == newProvider &&
                            lockedAt updatedDatum == lockedAt oldDatum
                        Nothing -> False
                _ -> False
        ) outputs
    in hasUpdatedDatum

-- | Validate payment to provider
{-# INLINABLE validatePaymentToProvider #-}
validatePaymentToProvider :: EscrowParams -> TxInfo -> Bool
validatePaymentToProvider params txInfo =
    let
        outputs = txInfoOutputs txInfo
        valuePaid = foldMap (\out ->
            if txOutAddress out == pubKeyHashAddress (providerPubKeyHash params) noStakeAddress
            then txOutValue out
            else mempty
        ) outputs
        expectedValue = Ada.lovelaceValueOf (price params)
    in
        valuePaid `geq` expectedValue

-- | Validate refund to learner
{-# INLINABLE validateRefundToLearner #-}
validateRefundToLearner :: EscrowParams -> TxInfo -> Bool
validateRefundToLearner params txInfo =
    let
        outputs = txInfoOutputs txInfo
        valuePaid = foldMap (\out ->
            if txOutAddress out == pubKeyHashAddress (learnerPubKeyHash params) noStakeAddress
            then txOutValue out
            else mempty
        ) outputs
        expectedValue = Ada.lovelaceValueOf (price params)
    in
        valuePaid `geq` expectedValue

-- | Typed Validator
data Escrow
instance Scripts.ValidatorTypes Escrow where
    type instance DatumType Escrow = EscrowDatum
    type instance RedeemerType Escrow = EscrowRedeemer

escrowInstance :: EscrowParams -> Scripts.TypedValidator Escrow
escrowInstance params = Scripts.mkTypedValidator @Escrow
    ($$(PlutusTx.compile [|| escrowValidator ||])
        `PlutusTx.applyCode` PlutusTx.liftCode params)
    $$(PlutusTx.compile [|| wrap ||])
  where
    wrap = Scripts.wrapValidator @EscrowDatum @EscrowRedeemer

validator :: EscrowParams -> Validator
validator = Scripts.validatorScript . escrowInstance

valHash :: EscrowParams -> Ledger.ValidatorHash
valHash = Scripts.validatorHash . escrowInstance

scrAddress :: EscrowParams -> Ledger.Address
scrAddress = scriptAddress . validator

-- | Helper function to create initial datum
mkEscrowDatum :: POSIXTime -> EscrowDatum
mkEscrowDatum currentTime = EscrowDatum
    { learnerAttestation = False
    , providerAttestation = False
    , lockedAt = currentTime
    }
