;; Prediction Market Contract

(define-data-var market-nonce uint u0)

(define-map markets
  { market-id: uint }
  {
    creator: principal,
    description: (string-utf8 256),
    options: (list 5 (string-utf8 64)),
    resolution-time: uint,
    resolved: bool,
    winning-option: (optional uint),
    total-liquidity: uint
  }
)

(define-map market-positions
  { market-id: uint, user: principal }
  {
    positions: (list 5 uint)
  }
)

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-exists (err u102))
(define-constant err-invalid-option (err u103))
(define-constant err-market-closed (err u104))
(define-constant err-market-not-resolved (err u105))

(define-public (create-market (description (string-utf8 256)) (options (list 5 (string-utf8 64))) (resolution-time uint))
  (let
    (
      (market-id (var-get market-nonce))
    )
    (asserts! (> (len options) u0) err-invalid-option)
    (asserts! (< (len options) u6) err-invalid-option)
    (asserts! (> resolution-time block-height) err-invalid-option)
    (map-set markets
      { market-id: market-id }
      {
        creator: tx-sender,
        description: description,
        options: options,
        resolution-time: resolution-time,
        resolved: false,
        winning-option: none,
        total-liquidity: u0
      }
    )
    (var-set market-nonce (+ market-id u1))
    (ok market-id)
  )
)

(define-public (place-bet (market-id uint) (option uint) (amount uint))
  (let
    (
      (market (unwrap! (map-get? markets { market-id: market-id }) err-not-found))
      (current-positions (default-to { positions: (list u0 u0 u0 u0 u0) } (map-get? market-positions { market-id: market-id, user: tx-sender })))
    )
    (asserts! (not (get resolved market)) err-market-closed)
    (asserts! (< option (len (get options market))) err-invalid-option)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set market-positions
      { market-id: market-id, user: tx-sender }
      {
        positions: (unwrap! (replace-at? (get positions current-positions) option (+ (unwrap! (element-at (get positions current-positions) option) err-invalid-option) amount)) err-invalid-option)
      }
    )
    (map-set markets
      { market-id: market-id }
      (merge market { total-liquidity: (+ (get total-liquidity market) amount) })
    )
    (ok true)
  )
)

(define-public (resolve-market (market-id uint) (winning-option uint))
  (let
    (
      (market (unwrap! (map-get? markets { market-id: market-id }) err-not-found))
    )
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (>= block-height (get resolution-time market)) err-market-not-resolved)
    (asserts! (not (get resolved market)) err-market-closed)
    (asserts! (< winning-option (len (get options market))) err-invalid-option)
    (ok (map-set markets
      { market-id: market-id }
      (merge market {
        resolved: true,
        winning-option: (some winning-option)
      })
    ))
  )
)

(define-public (claim-winnings (market-id uint))
  (let
    (
      (market (unwrap! (map-get? markets { market-id: market-id }) err-not-found))
      (positions (unwrap! (map-get? market-positions { market-id: market-id, user: tx-sender }) err-not-found))
      (winning-option (unwrap! (get winning-option market) err-market-not-resolved))
      (winning-amount (unwrap! (element-at (get positions positions) winning-option) err-invalid-option))
      (total-liquidity (get total-liquidity market))
      (payout (/ (* winning-amount total-liquidity) (unwrap! (element-at (get positions positions) winning-option) err-invalid-option)))
    )
    (asserts! (get resolved market) err-market-not-resolved)
    (map-delete market-positions { market-id: market-id, user: tx-sender })
    (as-contract (stx-transfer? payout tx-sender tx-sender))
  )
)

(define-read-only (get-market (market-id uint))
  (ok (unwrap! (map-get? markets { market-id: market-id }) err-not-found))
)

(define-read-only (get-user-positions (market-id uint) (user principal))
  (ok (unwrap! (map-get? market-positions { market-id: market-id, user: user }) err-not-found))
)

