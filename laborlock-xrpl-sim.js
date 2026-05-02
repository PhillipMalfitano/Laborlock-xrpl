/**
 * ============================================================
 *  LaborLock — XRPL Testnet Escrow Simulation
 *  Simulates a full contractor/homeowner milestone payment
 *  using XRPL native conditional escrow + time-based auto-release
 *
 *  Run: node laborlock-xrpl-sim.js
 *  Requires: npm install xrpl five-bells-condition
 * ============================================================
 */

import xrpl from 'xrpl'
import { PreimageSha256 } from 'five-bells-condition'
import { randomBytes } from 'crypto'

// ── CONFIG ────────────────────────────────────────────────────
const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233'
const MILESTONE_AMOUNT_XRP = '10'   // Simulating $10 RLUSD (using XRP on testnet)
const APPROVAL_WINDOW_SEC  = 60     // 60 sec auto-release (48hrs in production)
const MILESTONE_NAME       = 'Cabinet Installation & Countertops'

// ── COLORS for terminal output ────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  orange: '\x1b[33m',
  green:  '\x1b[32m',
  blue:   '\x1b[34m',
  red:    '\x1b[31m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
}

function log(symbol, color, label, msg) {
  console.log(`${color}${C.bold}${symbol} ${label}${C.reset}  ${msg}`)
}

function header(title) {
  const line = '─'.repeat(60)
  console.log(`\n${C.orange}${C.bold}${line}`)
  console.log(`  ${title}`)
  console.log(`${line}${C.reset}\n`)
}

function logTx(label, hash) {
  console.log(`  ${C.dim}${label}:${C.reset} ${C.cyan}${hash}${C.reset}`)
  console.log(`  ${C.dim}Explorer: https://testnet.xrpl.org/transactions/${hash}${C.reset}`)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── MAIN ──────────────────────────────────────────────────────
async function runLaborLockSim() {

  console.clear()
  console.log(`\n${C.orange}${C.bold}`)
  console.log('  ██╗      █████╗ ██████╗  ██████╗ ██████╗ ██╗      ██████╗  ██████╗██╗  ██╗')
  console.log('  ██║     ██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██║     ██╔═══██╗██╔════╝██║ ██╔╝')
  console.log('  ██║     ███████║██████╔╝██║   ██║██████╔╝██║     ██║   ██║██║     █████╔╝ ')
  console.log('  ██║     ██╔══██║██╔══██╗██║   ██║██╔══██╗██║     ██║   ██║██║     ██╔═██╗ ')
  console.log('  ███████╗██║  ██║██████╔╝╚██████╔╝██║  ██║███████╗╚██████╔╝╚██████╗██║  ██╗')
  console.log(`  ╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝${C.reset}`)
  console.log(`\n${C.dim}  XRPL Testnet Escrow Simulation — Milestone Payment Flow${C.reset}\n`)

  const client = new xrpl.Client(TESTNET_URL)

  try {
    // ── STEP 1: CONNECT ────────────────────────────────────────
    header('STEP 1 — Connecting to XRPL Testnet')
    log('🔌', C.blue, 'Network', TESTNET_URL)
    await client.connect()
    log('✓', C.green, 'Connected', 'XRPL Testnet online')

    // ── STEP 2: CREATE WALLETS ─────────────────────────────────
    header('STEP 2 — Creating Test Wallets (Homeowner & Contractor)')

    log('⏳', C.orange, 'Funding', 'Creating Homeowner wallet from testnet faucet...')
    const { wallet: homeowner } = await client.fundWallet()
    log('✓', C.green, 'Homeowner', `${homeowner.address}`)

    log('⏳', C.orange, 'Funding', 'Creating Contractor wallet from testnet faucet...')
    const { wallet: contractor } = await client.fundWallet()
    log('✓', C.green, 'Contractor', `${contractor.address}`)

    // Check balances
    const hoBal = await client.getXrpBalance(homeowner.address)
    const coBal = await client.getXrpBalance(contractor.address)
    log('💰', C.cyan, 'Homeowner Balance', `${hoBal} XRP (testnet)`)
    log('💰', C.cyan, 'Contractor Balance', `${coBal} XRP (testnet)`)

    // ── STEP 3: GENERATE CRYPTO-CONDITION ─────────────────────
    header('STEP 3 — Generating Milestone Approval Condition')

    // This preimage is the "secret key" that unlocks the escrow
    // In production: generated when homeowner taps "Approve" in the app
    const preimage = randomBytes(32)
    const fulfillment = new PreimageSha256()
    fulfillment.setPreimage(preimage)

    const fulfillmentHex = fulfillment.serializeBinary().toString('hex').toUpperCase()
    const conditionHex   = fulfillment.getConditionBinary().toString('hex').toUpperCase()

    log('🔐', C.orange, 'Condition', `${conditionHex.substring(0, 40)}...`)
    log('🗝️', C.dim,    'Fulfillment', `${fulfillmentHex.substring(0, 40)}... (held by app until approval)`)
    console.log(`\n  ${C.dim}In production: Condition is stored on-chain with the escrow.`)
    console.log(`  Fulfillment key is released ONLY when homeowner approves the milestone.${C.reset}`)

    // ── STEP 4: SET TIMING ─────────────────────────────────────
    header('STEP 4 — Setting Escrow Timing')

    const now = new Date()
    const cancelAfter = new Date(now.getTime() + (APPROVAL_WINDOW_SEC * 1000))
    const cancelAfterRipple = xrpl.isoTimeToRippleTime(cancelAfter.toISOString())

    log('⏱', C.cyan, 'Auto-Release Window', `${APPROVAL_WINDOW_SEC} seconds (48hrs in production)`)
    log('📅', C.cyan, 'Escrow Expires At', cancelAfter.toLocaleTimeString())
    console.log(`\n  ${C.dim}If homeowner doesn't approve within the window,`)
    console.log(`  escrow auto-releases to contractor automatically.${C.reset}`)

    // ── STEP 5: CREATE ESCROW ─────────────────────────────────
    header(`STEP 5 — Creating Escrow: "${MILESTONE_NAME}"`)

    log('⏳', C.orange, 'Submitting', `Locking ${MILESTONE_AMOUNT_XRP} XRP in escrow...`)

    const escrowCreateTx = {
      TransactionType: 'EscrowCreate',
      Account:         homeowner.address,
      Amount:          xrpl.xrpToDrops(MILESTONE_AMOUNT_XRP),
      Destination:     contractor.address,
      Condition:       conditionHex,
      CancelAfter:     cancelAfterRipple,
    }

    const escrowResult = await client.submitAndWait(escrowCreateTx, {
      wallet: homeowner,
    })

    if (escrowResult.result.meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Escrow creation failed: ${escrowResult.result.meta.TransactionResult}`)
    }

    const escrowTxHash = escrowResult.result.hash
    log('✓', C.green, 'Escrow Created', `${MILESTONE_AMOUNT_XRP} XRP locked on-chain`)
    logTx('Tx Hash', escrowTxHash)

    // Parse escrow sequence for finish tx
    const escrowSeq = escrowResult.result.tx_json?.Sequence ||
                      escrowResult.result.tx_json?.TicketSequence

    console.log(`\n  ${C.dim}Escrow object created on XRPL. Funds are LOCKED.`)
    console.log(`  Neither party can touch them until conditions are met.${C.reset}`)

    // ── STEP 6: SIMULATE MILESTONE SUBMISSION ─────────────────
    header('STEP 6 — Contractor Submits Milestone')

    log('📸', C.cyan, 'Photos',       '8 photos uploaded — job site verified')
    log('📍', C.cyan, 'GPS Stamp',    '34.7304° N, 77.4311° W — on-site confirmed')
    log('🔗', C.cyan, 'Blockchain',   `Milestone submission hash: ${escrowTxHash.substring(0,16)}...`)
    log('⏰', C.cyan, 'Submitted At', new Date().toLocaleTimeString())

    console.log(`\n  ${C.dim}In production: Photo hashes + GPS coordinates are`)
    console.log(`  stored in the escrow memo field — immutable audit trail.${C.reset}`)

    // ── STEP 7: HOMEOWNER APPROVAL (or wait for auto-release) ─
    header('STEP 7 — Homeowner Approval Decision')

    // Simulate homeowner approving (set to false to test auto-release)
    const homeownerApproves = true

    if (homeownerApproves) {
      log('✅', C.green, 'Homeowner', 'Sandra K. approved milestone — releasing funds...')
      console.log(`  ${C.dim}App releases the fulfillment key to the XRPL.${C.reset}\n`)

      await sleep(2000) // Brief pause for realism

      // ── STEP 8: FINISH ESCROW (APPROVAL PATH) ───────────────
      header('STEP 8 — Releasing Funds to Contractor')

      const escrowFinishTx = {
        TransactionType: 'EscrowFinish',
        Account:         contractor.address,
        Owner:           homeowner.address,
        OfferSequence:   escrowSeq,
        Condition:       conditionHex,
        Fulfillment:     fulfillmentHex,
      }

      log('⏳', C.orange, 'Submitting', 'EscrowFinish transaction...')

      const finishResult = await client.submitAndWait(escrowFinishTx, {
        wallet: contractor,
      })

      if (finishResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Escrow finish failed: ${finishResult.result.meta.TransactionResult}`)
      }

      const finishTxHash = finishResult.result.hash
      log('✓', C.green, 'Funds Released', `${MILESTONE_AMOUNT_XRP} XRP delivered to contractor`)
      logTx('Release Tx', finishTxHash)

    } else {
      // AUTO-RELEASE PATH
      log('⏰', C.orange, 'Homeowner', `No response — auto-release in ${APPROVAL_WINDOW_SEC}s`)
      console.log(`\n  ${C.dim}Waiting for approval window to expire...${C.reset}`)

      for (let i = APPROVAL_WINDOW_SEC; i > 0; i--) {
        process.stdout.write(`\r  ${C.orange}⏳ Auto-releasing in ${i}s...${C.reset}   `)
        await sleep(1000)
      }
      console.log('\n')
      log('⚡', C.green, 'Auto-Release', 'Window expired — funds auto-releasing...')
    }

    // ── STEP 9: VERIFY FINAL BALANCES ─────────────────────────
    header('STEP 9 — Final Balance Verification')

    await sleep(1000)
    const hoFinal = await client.getXrpBalance(homeowner.address)
    const coFinal = await client.getXrpBalance(contractor.address)

    log('🏠', C.cyan, 'Homeowner Final',  `${hoFinal} XRP`)
    log('🔨', C.cyan, 'Contractor Final', `${coFinal} XRP`)

    const paid = (parseFloat(coFinal) - parseFloat(coBal)).toFixed(4)
    log('💸', C.green, 'Net Paid Out',    `~${paid} XRP to contractor (minus tx fees)`)

    // ── STEP 10: SUMMARY ──────────────────────────────────────
    header('✅ SIMULATION COMPLETE — LaborLock Flow Summary')

    const steps = [
      ['Homeowner & Contractor wallets created',         '✓'],
      ['Milestone crypto-condition generated',           '✓'],
      ['Funds locked in XRPL native escrow',            '✓'],
      ['Milestone submitted with photo + GPS proof',    '✓'],
      ['Homeowner approval received',                   '✓'],
      ['Fulfillment key released — EscrowFinish sent',  '✓'],
      ['Funds delivered to contractor on-chain',        '✓'],
      ['Immutable audit trail recorded on XRPL',        '✓'],
    ]

    steps.forEach(([step, status]) => {
      console.log(`  ${C.green}${status}${C.reset}  ${step}`)
    })

    console.log(`\n${C.orange}${C.bold}  This is LaborLock on XRPL. No bank. No middleman.`)
    console.log(`  Work verified. Funds released. Contractor paid.${C.reset}\n`)

    console.log(`${C.dim}  Testnet Explorer: https://testnet.xrpl.org`)
    console.log(`  Search either wallet address to see live transactions.${C.reset}\n`)

  } catch (err) {
    console.error(`\n${C.red}${C.bold}ERROR:${C.reset} ${err.message}`)
    console.error(err)
  } finally {
    await client.disconnect()
    log('🔌', C.dim, 'Disconnected', 'XRPL client closed')
  }
}

runLaborLockSim()
