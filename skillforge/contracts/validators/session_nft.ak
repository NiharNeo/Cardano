use aiken/collection/dict
use aiken/collection/list
use cardano/assets.{PolicyId}
use cardano/transaction.{Transaction}

pub type NFTRedeemer {
  Mint { session: ByteArray }
}

validator session_nft {
  mint(redeemer: NFTRedeemer, policy_id: PolicyId, tx: Transaction) {
    expect Mint { session: _ } = redeemer

    // Get all minted assets for this policy
    let minted_with_policy =
      tx.mint
        |> assets.tokens(policy_id)
        |> dict.to_pairs()

    // Ensure exactly one asset is minted with quantity 1
    list.length(minted_with_policy) == 1 && {
      expect [Pair(_, quantity)] = minted_with_policy
      quantity == 1
    }
  }

  else(_) {
    fail
  }
}
