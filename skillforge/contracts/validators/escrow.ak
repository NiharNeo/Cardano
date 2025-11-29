validator Escrow {
  purpose spend

  datum EscrowDatum {
    learner : ByteArray
    mentor  : ByteArray
    price   : Int
    session : ByteArray
    learner_attested : Bool
    mentor_attested  : Bool
  }

  redeemer Redeemer {
    AttestByLearner
    AttestByMentor
    ClaimFunds
    Refund
  }

  fn spend(datum: EscrowDatum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
    let info = ctx.tx

    if redeemer == AttestByLearner {
      !datum.learner_attested
    } else if redeemer == AttestByMentor {
      !datum.mentor_attested
    } else if redeemer == ClaimFunds {
      datum.learner_attested &&
      datum.mentor_attested &&
      info.signatories.contains(datum.mentor)
    } else if redeemer == Refund {
      info.validity_interval.to < 10000000000
    } else {
      false
    }
  }
}

