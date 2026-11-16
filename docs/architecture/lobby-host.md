![Managed room lifecycle](generated/lobby-lifecycle.svg)

![Receipt, transfer, and publication](generated/lobby-receipt.svg)

![ZSL session phases](generated/lobby-zsl.svg)

`zsl-submissions` uses its own room and unique config `key`. It can run beside
`zsl-practice`, `zsl`, or their combined room, including for the same `roundId`.
Only enabled `zsl-practice` and `zsl` profiles with the same `roundId` share one
physical room. That pair uses the practice config `key`; submissions stays separate.
