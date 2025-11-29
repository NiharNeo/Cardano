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

    when redeemer is {
      AttestByLearner -> !datum.learner_attested
      AttestByMentor -> !datum.mentor_attested
      ClaimFunds ->
        datum.learner_attested &&
        datum.mentor_attested &&
        info.signatories.contains(datum.mentor)
      Refund ->
        info.validity_interval.to < 10000000000
    }
  }
}

