;; Oracle Contract

(define-map oracle-data
  { market-id: uint }
  {
    data-source: (string-utf8 256),
    result: (optional uint)
  }
)

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))

(define-public (set-data-source (market-id uint) (data-source (string-utf8 256)))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (map-set oracle-data
      { market-id: market-id }
      {
        data-source: data-source,
        result: none
      }
    ))
  )
)

(define-public (submit-result (market-id uint) (result uint))
  (let
    (
      (oracle (unwrap! (map-get? oracle-data { market-id: market-id }) err-not-found))
    )
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (map-set oracle-data
      { market-id: market-id }
      (merge oracle {
        result: (some result)
      })
    ))
  )
)

(define-read-only (get-oracle-data (market-id uint))
  (ok (unwrap! (map-get? oracle-data { market-id: market-id }) err-not-found))
)

