// src/lib/payroll.ts

/**
 * Philippine statutory payroll deductions + derived hourly rates.
 *
 * NOTE: SSS/PhilHealth/Pag-IBIG figures below are simplified flat-percentage
 * approximations tuned to match the reference example (Gross Pay 15,000 ->
 * SSS 750 / PhilHealth 500 / Pag-IBIG 300). Replace with the official SSS
 * bracket table before this is used for real payslips.
 */

const STANDARD_MONTHLY_HOURS = 208 // 26 days x 8 hours

// ---- money helpers -----------------------------------------------------

/**
 * Rounds to 2 decimal places using a numeric round-trip (never string
 * slicing/concatenation — that's what produced the 72120.00 bug: treating
 * "72.12" as the string "7212" and multiplying by 10/100/1000).
 */
export function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Safely coerce whatever the form gives us (string, number, "", null) to a number. */
export function toNumber(value: unknown): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0
    if (typeof value === "string") {
        const n = parseFloat(value)
        return Number.isFinite(n) ? n : 0
    }
    return 0
}

// ---- statutory deductions -----------------------------------------------

const SSS_RATE = 0.05
const SSS_MIN = 200
const SSS_MAX = 1350

export function computeSssDeduction(grossPay: number): number {
    if (grossPay <= 0) return 0
    const flat = grossPay * SSS_RATE
    return round2(Math.min(Math.max(flat, SSS_MIN), SSS_MAX))
}

const PHILHEALTH_RATE = 500 / 15000 // 3.3333% employee share, tuned to reference example
const PHILHEALTH_MIN = 200
const PHILHEALTH_MAX = 900

export function computePhilhealthDeduction(grossPay: number): number {
    if (grossPay <= 0) return 0
    const flat = grossPay * PHILHEALTH_RATE
    return round2(Math.min(Math.max(flat, PHILHEALTH_MIN), PHILHEALTH_MAX))
}

const PAGIBIG_LOW_RATE = 0.01 // salary <= 1,500
const PAGIBIG_HIGH_RATE = 0.02 // salary > 1,500
const PAGIBIG_MSC_CAP = 15000 // contribution computed on gross pay capped here
const PAGIBIG_MAX = 300

export function computePagibigDeduction(grossPay: number): number {
    if (grossPay <= 0) return 0
    const base = Math.min(grossPay, PAGIBIG_MSC_CAP)
    const rate = grossPay <= 1500 ? PAGIBIG_LOW_RATE : PAGIBIG_HIGH_RATE
    return round2(Math.min(base * rate, PAGIBIG_MAX))
}

// TRAIN law monthly withholding tax table (post-2023 rates).
const TAX_BRACKETS: { over: number; fixed: number; rate: number }[] = [
    { over: 0, fixed: 0, rate: 0 },
    { over: 20833, fixed: 0, rate: 0.15 },
    { over: 33333, fixed: 1875, rate: 0.2 },
    { over: 66667, fixed: 8541.8, rate: 0.25 },
    { over: 166667, fixed: 33541.8, rate: 0.3 },
    { over: 666667, fixed: 183541.8, rate: 0.35 },
]

export function computeWithholdingTax(taxableIncome: number): number {
    if (taxableIncome <= 0) return 0
    const bracket = [...TAX_BRACKETS].reverse().find((b) => taxableIncome > b.over)!
    return round2(bracket.fixed + (taxableIncome - bracket.over) * bracket.rate)
}

// ---- hourly rate derivation ----------------------------------------------

export interface HourlyRates {
    regRatePerHour: number
    regOtPerHour: number
    sundayRatePerHour: number
    sundayOtPerHour: number
    holidayRatePerHour: number
    holidayOtPerHour: number
    lateRatePerHour: number
    undertimeRatePerHour: number
}

export function computeHourlyRates(grossPay: number): HourlyRates {
    const regRatePerHour = round2(grossPay / STANDARD_MONTHLY_HOURS)
    return {
        regRatePerHour,
        regOtPerHour: round2(regRatePerHour * 1.25),
        sundayRatePerHour: round2(regRatePerHour * 1.3),
        sundayOtPerHour: round2(regRatePerHour * 1.3 * 1.3),
        holidayRatePerHour: round2(regRatePerHour * 2.0),
        holidayOtPerHour: round2(regRatePerHour * 2.0 * 1.3),
        lateRatePerHour: round2(regRatePerHour * 1.0),
        undertimeRatePerHour: round2(regRatePerHour * 1.0),
    }
}

// ---- top-level orchestrator -----------------------------------------------

export interface PayrollComputationResult {
    sss_deduction: number
    philhealth_deduction: number
    pagibig_deduction: number
    with_holding_tax: number
    reg_rate_pre_hour: number
    reg_ot_per_hour: number
    sunday_rate_per_hour: number
    sunday_ot_per_hour: number
    holiday_rate_per_hour: number
    holiday_ot_per_hour: number
    late_rate_per_hour: number
    undertime_rate_per_hour: number
}

/**
 * Single entry point: given a raw Gross Pay input (string or number),
 * returns every derived payroll field, already rounded to 2 decimals.
 * This is the ONLY place these numbers should be computed — the form
 * hook just calls this and writes the result back with setValue.
 */
export function computePayrollFields(grossPayInput: unknown): PayrollComputationResult {
    const grossPay = toNumber(grossPayInput)

    const sss = computeSssDeduction(grossPay)
    const philhealth = computePhilhealthDeduction(grossPay)
    const pagibig = computePagibigDeduction(grossPay)
    const taxableIncome = round2(grossPay - (sss + philhealth + pagibig))
    const withholdingTax = computeWithholdingTax(taxableIncome)

    const rates = computeHourlyRates(grossPay)

    return {
        sss_deduction: sss,
        philhealth_deduction: philhealth,
        pagibig_deduction: pagibig,
        with_holding_tax: withholdingTax,
        reg_rate_pre_hour: rates.regRatePerHour,
        reg_ot_per_hour: rates.regOtPerHour,
        sunday_rate_per_hour: rates.sundayRatePerHour,
        sunday_ot_per_hour: rates.sundayOtPerHour,
        holiday_rate_per_hour: rates.holidayRatePerHour,
        holiday_ot_per_hour: rates.holidayOtPerHour,
        late_rate_per_hour: rates.lateRatePerHour,
        undertime_rate_per_hour: rates.undertimeRatePerHour,
    }
}