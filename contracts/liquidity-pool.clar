;; Liquidity Pool Contract

(define-map liquidity-providers
  { market-id: uint, provider: principal }
  {
    amount: uint
  }
)

(define-map market-pools
  { market-id: uint }
  {
    total-liquidity: uint
  }
)

(define-constant err-not-found (err u101))

(define-public (provide-liquidity (market-id uint) (amount uint))
  (let
    (
      (current-liquidity (default-to { amount: u0 } (map-get? liquidity-providers { market-id: market-id, provider: tx-sender })))
      (market-pool (default-to { total-liquidity: u0 } (map-get? market-pools { market-id: market-id })))
    )
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set liquidity-providers
      { market-id: market-id, provider: tx-sender }
      { amount: (+ (get amount current-liquidity) amount) }
    )
    (map-set market-pools
      { market-id: market-id }
      { total-liquidity: (+ (get total-liquidity market-pool) amount) }
    )
    (ok true)
  )
)

(define-public (withdraw-liquidity (market-id uint) (amount uint))
  (let
    (
      (current-liquidity (unwrap! (map-get? liquidity-providers { market-id: market-id, provider: tx-sender }) err-not-found))
      (market-pool (unwrap! (map-get? market-pools { market-id: market-id }) err-not-found))
    )
    (asserts! (<= amount (get amount current-liquidity)) err-not-found)
    (map-set liquidity-providers
      { market-id: market-id, provider: tx-sender }
      { amount: (- (get amount current-liquidity) amount) }
    )
    (map-set market-pools
      { market-id: market-id }
      { total-liquidity: (- (get total-liquidity market-pool) amount) }
    )
    (as-contract (stx-transfer? amount tx-sender tx-sender))
  )
)

(define-read-only (get-liquidity-position (market-id uint) (provider principal))
  (ok (unwrap! (map-get? liquidity-providers { market-id: market-id, provider: provider }) err-not-found))
)

(define-read-only (get-market-pool (market-id uint))
  (ok (unwrap! (map-get? market-pools { market-id: market-id }) err-not-found))
)

