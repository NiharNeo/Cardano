use cardano/transaction.{Transaction}
use aiken/collection/dict
use aiken/option

validator session_nft {
  mint(redeemer: MintRedeemer, policy_id: ByteArray, self: Transaction) {
    let minted = self.mint
    
    // Check that we are minting exactly 1 token of this policy
    let quantity = 
      minted
        |> dict.get(policy_id)
        |> option.or_else(dict.new())
        |> dict.size()
        
    quantity == 1
  }
}

pub type MintRedeemer {
  Mint { session: ByteArray }
}



