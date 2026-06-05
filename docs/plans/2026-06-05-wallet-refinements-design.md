# Design Document: Wallet Refinements (feat/wallet-v2)
**Date:** 2026-06-05

## Goal
Enhance the wallet UI for mobile responsiveness, refine the global splitting mechanism with payment methods and amount input inputs, support cash balance adjustments during debt settlement, and display expense breakdowns.

## 1. Layout & Styling
- Move the **Cash Balance Tracker** card (`.cash-tracker-card`) to the very top of the `#wallet-section`, before the main `.wallet-grid`.
- Optimize `.wallet-grid`, `.form-row`, `.form-row-three`, and split rows using flex-wrap and responsive CSS media queries so they don't exceed the phone viewport width (i.e. ensure no horizontal overflow on mobile screens).

## 2. Global Split Refinements
- Allow **Global (Shared Split)** expenses to also select a **Payment Method** (Cash / ePayment / Transit Card), identical to local expenses.
- Auto-redistribute split ratios when checking/unchecking members to keep the sum at exactly 100% (e.g. 3 members -> 33/33/34; if one unchecked -> 50/50).
- Beside each range slider, display a text box showing the exact calculated split amount and allowing the user to type in an exact split amount. Typing in the input will update the percentages of all checked members using Approach A (redistribute the difference equally among the other checked members).

## 3. Debt Settlement Cash Impact
- When settling up a debt with Cash:
  - Deduct the settled amount from the debtor's cash balance.
  - Add the settled amount to the creditor's cash balance.
- Keep a persistent ledger of these adjustments in state.

## 4. Personal Expenses by Payment Method Summary
- Show a summary widget listing:
  - Total Cash spent
  - Total ePayment spent
  - Total Transit Card spent
  - Total theoretical expenses (including outstanding debts)
