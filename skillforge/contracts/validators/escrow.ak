use aiken/collection/list
use cardano/address.{Address, Script, VerificationKey}
use cardano/transaction.{OutputReference, Transaction}

pub type EscrowDatum {
  learner: ByteArray,
  mentor: ByteArray,
  price: Int,
  session: ByteArray,
  learner_attested: Bool,
  mentor_attested: Bool,
  receiver: ByteArray,  // Fixed receiver payment key hash
}

pub type EscrowRedeemer {
  AttestByLearner
  AttestByMentor
  ClaimFunds
  Refund
}

validator escrow {
  spend(
    datum_opt: Option<EscrowDatum>,
    redeemer: EscrowRedeemer,
    _own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(datum) = datum_opt

    when redeemer is {
      // Learner attests - just check they haven't attested yet
      AttestByLearner -> !datum.learner_attested
      
      // Mentor attests - just check they haven't attested yet
      AttestByMentor -> !datum.mentor_attested
      
      // Claim funds - requires both attestations AND funds go to fixed receiver
      ClaimFunds -> {
        // Check both parties have attested
        let both_attested = datum.learner_attested && datum.mentor_attested
        
        // Check that funds go to the receiver address
        let funds_to_receiver = list.any(
          tx.outputs,
          fn(output) {
            // Check if output goes to receiver address (payment key hash)
            when output.address.payment_credential is {
              VerificationKey(hash) -> hash == datum.receiver
              _ -> False
            }
          },
        )
        
        both_attested && funds_to_receiver
      }
      
      // Refund - allow learner to get funds back
      Refund -> True
    }
  }

  else(_) {
    fail
  }
}
