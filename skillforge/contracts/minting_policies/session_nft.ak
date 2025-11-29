policy SessionNFT {
  purpose mint

  redeemer MintRedeemer {
    Mint { session : ByteArray }
  }

  fn mint(redeemer: MintRedeemer, ctx: ScriptContext) -> Bool {
    let info = ctx.tx
    let minted = info.minted

    minted.keys().len == 1 &&
    minted.values()[0] == 1
  }
}

