#!/usr/bin/env python3
"""
Passport marginal-cost model.

Built from the ACTUAL code path, not from assumptions:
  lib/handlers/memory-system.js:54-120  -> auto-extraction runs per exchange
                                        -> model is gpt-4o-mini (cheapest OpenAI tier)

Run:  python3 scripts/passport_cost_model.py
"""

IN_RATE  = 0.15 / 1_000_000   # gpt-4o-mini $/input token
OUT_RATE = 0.60 / 1_000_000   # gpt-4o-mini $/output token

PROMPT_INSTRUCTIONS = 500     # fixed instruction block, counted from source
EXCHANGE_TOKENS     = 750     # typical user msg + assistant response
INPUT_TOKENS        = PROMPT_INSTRUCTIONS + EXCHANGE_TOKENS
OUTPUT_TOKENS       = 150     # JSON array of a few memories

STORAGE_PER_USER = 0.02       # ~500KB text memories, generous


def per_call() -> float:
    return INPUT_TOKENS * IN_RATE + OUTPUT_TOKENS * OUT_RATE


def monthly_cost(msgs_per_day: int) -> float:
    return msgs_per_day * 30 * per_call() + STORAGE_PER_USER


def main():
    pc = per_call()
    print(f"Cost per memory-extraction call: ${pc:.6f}\n")

    print("MARGINAL COST PER USER / MONTH")
    print(f"{'usage':<24} {'msgs/mo':>9} {'cost':>10}")
    print("-" * 46)
    for label, pd in [("light (5/day)", 5), ("typical (20/day)", 20),
                      ("heavy (50/day)", 50), ("power (100/day)", 100),
                      ("extreme (300/day)", 300)]:
        print(f"{label:<24} {pd*30:>9,} {monthly_cost(pd):>9.4f}")

    print("\nGROSS MARGIN BY PRICE")
    print(f"{'price':>7} {'light':>8} {'typical':>8} {'heavy':>8} {'extreme':>8}")
    print("-" * 44)
    for price in [5, 8, 10, 12, 14, 19, 20, 29]:
        cells = []
        for _, pd in [("l", 5), ("t", 20), ("h", 50), ("x", 300)]:
            cells.append(f"{(price - monthly_cost(pd)) / price * 100:>7.1f}%")
        print(f"${price:>6} " + " ".join(cells))

    print("\nBREAK-EVEN (extractions/mo before cost exceeds price)")
    for price in [5, 10, 14, 20]:
        msgs = (price - STORAGE_PER_USER) / pc
        print(f"  ${price:>3}/mo -> {msgs:>9,.0f} extractions/mo ({msgs/30:>7,.0f} msgs/day)")

    print("""
INTERPRETATION
  Marginal cost is ~$0.19/mo at typical usage and ~$2.52/mo at an absurd
  300 msgs/day. Gross margin is 96-99% at any realistic price point.

  CONSEQUENCE: cost-plus pricing is actively wrong for this product. Price
  must be set by willingness to pay, not by cost. Break-even sits at
  ~1,679 msgs/day at $14 - no human reaches it.

  SECOND CONSEQUENCE: because cost is negligible, usage caps are a pure
  margin decision, not a cost-control necessity. Unlimited memory is
  affordable and is therefore a competitive weapon, not a liability.
""")


if __name__ == "__main__":
    main()
