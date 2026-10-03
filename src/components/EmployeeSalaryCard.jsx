import React from "react";
import { Download } from "lucide-react";
import { isAdvanceDeduction } from "@utils/salaryAdvance";

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const sumAmounts = (items) =>
  (items || []).reduce((sum, item) => {
    if (item?.infoOnly) return sum;
    return sum + (Number(item.amount) || 0);
  }, 0);

const Line = ({ label, amount, tone = "red", hint = null }) => {
  if (!amount && amount !== 0) return null;
  const value = Number(amount) || 0;
  if (value === 0 && tone === "muted") return null;
  const amountClass =
    tone === "green"
      ? "text-green-700"
      : tone === "blue"
        ? "text-blue-700"
        : tone === "muted"
          ? "text-gray-500"
          : "text-red-600";

  return (
    <div className="flex justify-between gap-3 text-sm py-0.5">
      <span className="text-gray-600">
        {label}
        {hint ? <span className="text-[10px] text-gray-400 ml-1">({hint})</span> : null}
      </span>
      <span className={`font-semibold ${amountClass}`}>{formatMoney(value)}</span>
    </div>
  );
};

const Subtotal = ({ label, amount, tone = "red" }) => (
  <div className={`flex justify-between gap-3 text-sm pt-2 mt-2 border-t font-bold ${tone === "green" ? "text-green-800 border-green-100" : tone === "blue" ? "text-blue-800 border-blue-100" : "text-red-700 border-red-100"}`}>
    <span>{label}</span>
    <span>{formatMoney(amount)}</span>
  </div>
);

const EmployeeSalaryCard = ({ employee, empId, isSelected, onSelect, onDownload }) => {
  let allowances = [];
  let bonuses = [];
  let deductions = [];
  let breakdown = {};

  try { allowances = typeof employee.allowances === "string" ? JSON.parse(employee.allowances) : (employee.allowances || []); } catch (e) { /* ignore */ }
  try { bonuses = typeof employee.bonuses === "string" ? JSON.parse(employee.bonuses) : (employee.bonuses || []); } catch (e) { /* ignore */ }
  try { deductions = typeof employee.deductions === "string" ? JSON.parse(employee.deductions) : (employee.deductions || []); } catch (e) { /* ignore */ }
  try { breakdown = typeof employee.salary_breakdown === "string" ? JSON.parse(employee.salary_breakdown) : (employee.salary_breakdown || {}); } catch (e) { /* ignore */ }

  const listedAllowancesTotal = sumAmounts(allowances);
  const listedBonusesTotal = sumAmounts(bonuses);

  const brAllowance = Number(breakdown.br_allowance || 0);
  const dinnerInList = allowances.some((a) => String(a.category || "").toLowerCase() === "dinner_allowance");

  // Header "Allowances" = assigned/employee-wise/dinner/KPI allowance lines only
  const totalAllowances = Number(breakdown.total_allowances ?? listedAllowancesTotal);
  const totalBonuses = Number(breakdown.total_bonuses ?? listedBonusesTotal);

  const gross = Number(breakdown.gross_salary || 0);
  const net = Number(breakdown.net_salary || 0);

  const fullDayNoPay = Number(breakdown.full_day_nopay_deduction || 0);
  const leaveShortfallBasicNoPay = Number(breakdown.leave_shortfall_nopay_basic_deduction || 0);
  const leaveShortfallBonusNoPay = Number(breakdown.leave_shortfall_nopay_bonus_deduction || 0);
  const leaveShortfallDays = Number(breakdown.leave_shortfall_nopay_days || 0);
  const saturdayNoPay = Number(breakdown.saturday_nopay_deduction || 0);
  const earlyOutNoPay = Number(breakdown.early_out_nopay_deduction || 0);
  const majorLateNoPay = Number(
    breakdown.monthly_late_nopay_deduction ?? breakdown.major_late_deduction ?? 0
  );
  const lateNoPayDays = Number(breakdown.monthly_late_nopay_days || 0);
  const excessLateBasic = Number(breakdown.excess_late_nopay_basic || 0);
  const excessLateBonus = Number(breakdown.excess_late_nopay_bonus || 0);
  const lateGraceBasic = Number(breakdown.late_grace_nopay_basic || 0);
  const lateGraceBonus = Number(breakdown.late_grace_nopay_bonus || 0);
  const lateGraceHint = breakdown.late_grace_enabled
    ? `${breakdown.late_grace_excess_minutes || 0} min over ${breakdown.late_grace_start_time || "07:15"} + ${breakdown.late_grace_grace_minutes ?? 15} min grace (${breakdown.late_grace_late_days || 0} day(s)) → ${breakdown.late_grace_nopay_days || 0} NoPay day(s)`
    : "";
  const shortLeaveLate = Number(breakdown.short_leave_deduction || 0);
  const halfDayLate = Number(breakdown.half_day_deduction || 0);
  const epfEmployee = Number(breakdown.epf_employee_deduction || 0);
  const epfEmployer = Number(breakdown.epf_employer_contribution || 0);
  const etfEmployer = Number(breakdown.etf_employer_contribution || 0);
  const epfEtfBase = Number(breakdown.epf_etf_base || 0);
  const epfEtfFixed = Number(breakdown.epf_etf_fixed_deductions || 0);
  const probationDeduction = Number(breakdown.probation_deduction || 0);
  const stampDuty = Number(breakdown.stamp_duty || breakdown.stamp || 0);
  const sportsFund = Number(breakdown.sports_fund_deduction || 0);
  const staffFund = Number(breakdown.staff_fund_deduction || 0);

  const rawLoanTarget = employee.loan_deduct_from || breakdown.loan_deduct_from || "bonus";
  const loanTarget = String(rawLoanTarget).toLowerCase().trim();
  const loanPrincipal = Number(breakdown.loan_principal || breakdown.loan_installment || 0);
  const loanInterest = Number(breakdown.loan_interest || 0);
  const loanBasicPrincipal = Number(
    breakdown.loan_basic_principal ?? (loanTarget === "basic" ? loanPrincipal : 0)
  );
  const loanBasicInterest = Number(
    breakdown.loan_basic_interest ?? (loanTarget === "basic" ? loanInterest : 0)
  );
  const loanBonusPrincipal = Number(
    breakdown.loan_bonus_principal ?? (loanTarget === "bonus" || loanTarget === "split" ? (loanTarget === "bonus" ? loanPrincipal : 0) : 0)
  );
  const loanBonusInterest = Number(
    breakdown.loan_bonus_interest ?? (loanTarget === "bonus" ? loanInterest : 0)
  );
  const salaryAdvanceBasic = Number(breakdown.salary_advance_basic || 0);
  const salaryAdvanceBonus = Number(breakdown.salary_advance_bonus || 0);
  // Payroll already places advances on the basic or bonus side; don't list the assigned line again.
  const customDeductions = salaryAdvanceBasic + salaryAdvanceBonus > 0
    ? deductions.filter((d) => !isAdvanceDeduction(d))
    : deductions;

  const totalLatePenalty =
    shortLeaveLate + halfDayLate + majorLateNoPay + saturdayNoPay + lateGraceBasic + lateGraceBonus;

  // Rebuild total deductions the same way backend does, so UI explains the header total.
  const basicDeductionLines = [
    { label: "EPF Employee (8%)", amount: epfEmployee, hint: "(basic − basic NoPay) × 8%" },
    { label: "EPF/ETF Fixed Deductions", amount: epfEtfFixed },
    { label: "Full Day No-Pay (Weekdays)", amount: fullDayNoPay },
    {
      label: "Leave Shortfall NoPay → Basic",
      amount: leaveShortfallBasicNoPay,
      hint: leaveShortfallDays > 0
        ? `${leaveShortfallDays} day(s) × basic/${breakdown.nopay_working_days || 30}`
        : `(basic + bonus)/${breakdown.nopay_working_days || 30} split`,
    },
    { label: "Probation Leave Deduction", amount: probationDeduction },
    {
      label: "Late >30m NoPay → Basic",
      amount: excessLateBasic,
      hint: "Rejected leave — deducted for late minutes",
    },
    ...(lateGraceBasic > 0
      ? [{ label: "Late Grace NoPay → Basic", amount: lateGraceBasic, hint: lateGraceHint }]
      : []),
    ...(loanBasicPrincipal > 0
      ? [{ label: "Loan Installment (Principal) → Basic", amount: loanBasicPrincipal }]
      : []),
    ...(loanBasicInterest > 0
      ? [{ label: "Loan Interest → Basic", amount: loanBasicInterest }]
      : []),
    ...(salaryAdvanceBasic > 0
      ? [{ label: "Salary Advance → Basic", amount: salaryAdvanceBasic }]
      : []),
  ];

  const bonusDeductionLines = [
    {
      label: "Late Deduction NoPay (basic + bonus rate) → Monthly Bonus",
      amount: majorLateNoPay,
      hint: lateNoPayDays > 0
        ? `${lateNoPayDays} day(s) × monthly bonus/${breakdown.nopay_working_days || 30}`
        : "valued from monthly bonus, deducted from bonus",
    },
    {
      label: "Late >30m NoPay → Monthly Bonus",
      amount: excessLateBonus,
      hint: "Rejected leave — deducted for late minutes",
    },
    ...(breakdown.late_grace_enabled && breakdown.late_grace_deduct_from !== "basic"
      ? [{ label: "Late Grace NoPay → Monthly Bonus (variable allowance)", amount: lateGraceBonus, hint: lateGraceHint }]
      : []),
    {
      label: "Leave Shortfall NoPay → Monthly Bonus",
      amount: leaveShortfallBonusNoPay,
      hint: leaveShortfallDays > 0
        ? `${leaveShortfallDays} day(s) × monthly bonus/${breakdown.nopay_working_days || 30}`
        : `(basic + bonus)/${breakdown.nopay_working_days || 30} split`,
    },
    {
      label: "Total NoPay under Monthly Bonus",
      amount: Number(
        breakdown.bonus_nopay_total
        ?? (leaveShortfallBonusNoPay + majorLateNoPay)
      ),
      hint: "Leave shortfall bonus portion + late deduction NoPay (summary only)",
      infoOnly: true,
    },
    { label: "Short Leave Penalty (Late)", amount: shortLeaveLate },
    { label: "Half Day Penalty (Late)", amount: halfDayLate },
    { label: "Early Out No-Pay", amount: earlyOutNoPay },
    { label: "Saturday No-Pay", amount: saturdayNoPay },
    ...customDeductions.map((d) => ({
      label: d.name || "Custom Deduction",
      amount: Number(d.amount) || 0,
      hint: d.category || "General",
    })),
    { label: "Sports Fund", amount: sportsFund },
    { label: "Staff Fund", amount: staffFund },
    ...(loanBonusInterest > 0
      ? [{ label: "Loan Interest → Monthly Bonus", amount: loanBonusInterest }]
      : []),
    ...(loanBonusPrincipal > 0
      ? [{ label: "Loan Installment (Principal) → Monthly Bonus", amount: loanBonusPrincipal }]
      : []),
    ...(salaryAdvanceBonus > 0
      ? [{ label: "Salary Advance → Monthly Bonus", amount: salaryAdvanceBonus }]
      : []),
  ];

  const listedCustomDeductionsTotal = sumAmounts(customDeductions);
  const basicDeductionsSum = sumAmounts(basicDeductionLines);
  const bonusDeductionsSum = sumAmounts(bonusDeductionLines);
  const reconstructedTotalDeductions = basicDeductionsSum + bonusDeductionsSum + stampDuty;
  const totalDeductions = Number(breakdown.total_deductions || reconstructedTotalDeductions);

  const otMorning = Number(breakdown.ot_morning_fees || 0);
  const otNight = Number(breakdown.ot_night_fees || 0);
  const holidayOt = Number(breakdown.holiday_ot_fees || 0);
  const otTotal = otMorning + otNight + holidayOt;

  const basicSalary = Number(breakdown.basic_salary || employee.basic_salary || 0);
  const monthlyBonus = Number(breakdown.monthly_bonus || 0);

  const basicGross = basicSalary + totalAllowances;
  const basicDeductionsForNet = basicDeductionsSum + stampDuty;
  const basicNet = basicGross - basicDeductionsForNet;
  const bonusGross = totalBonuses;
  const bonusNet = bonusGross - bonusDeductionsSum;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-4">
      <div className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="pt-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              className="rounded border-gray-300 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-gray-900">
                {employee.emp_no || employee.employee_no} • {employee.full_name}
              </span>
              {employee.compensation && employee.compensation.enable_epf_etf ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">EPF/ETF</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-100">Non-EPF</span>
              )}
            </div>

            <div className="text-xs text-gray-500 mt-1">
              {employee.company_name} • {employee.department_name}
            </div>

            <div className="text-xs text-gray-500 mt-1">
              Basic (incl. BR/increment): <span className="font-semibold text-gray-800">{formatMoney(basicSalary)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 min-w-[320px] flex-1">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-[11px] text-gray-500">Gross</div>
            <div className="text-sm font-bold">{formatMoney(gross)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-[11px] text-gray-500">Allowances</div>
            <div className="text-sm font-bold">{formatMoney(totalAllowances)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-blue-50 p-3">
            <div className="text-[11px] text-blue-600">Bonuses</div>
            <div className="text-sm font-bold text-blue-700">{formatMoney(totalBonuses)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-red-50 p-3">
            <div className="text-[11px] text-red-600">Late/Leave Penalty</div>
            <div className="text-sm font-bold text-red-700">{formatMoney(totalLatePenalty)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-[11px] text-gray-500">Total Deductions</div>
            <div className="text-sm font-bold text-red-600">{formatMoney(totalDeductions)}</div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-3">
            <div className="text-[11px] text-green-700">Net Salary</div>
            <div className="text-sm font-extrabold text-green-700">{formatMoney(net)}</div>
          </div>
        </div>

        <div className="mt-4 lg:mt-0 flex items-center justify-end">
          <button
            onClick={() => onDownload(employee)}
            className="flex items-center justify-center gap-2 p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors shadow-sm"
            title="Download payslips"
          >
            <Download size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      <details className="border-t border-gray-200">
        <summary className="cursor-pointer select-none px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">
          View details — how Allowances / Deductions totals are calculated
        </summary>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ALLOWANCES */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
            <div className="text-sm font-bold text-blue-900 mb-1">Allowances breakdown</div>
            <p className="text-[11px] text-blue-700/80 mb-3">
              Header total = sum of lines below (BR is inside Basic, not in Allowances).
            </p>
            {allowances.length === 0 ? (
              <div className="text-xs text-gray-500">No allowance lines for this month.</div>
            ) : (
              allowances.map((a, i) => (
                <Line
                  key={`alw-${i}`}
                  label={a.name || "Allowance"}
                  amount={a.amount}
                  tone="blue"
                  hint={a.category || "General"}
                />
              ))
            )}
            {!dinnerInList && Number(breakdown.total_dinner_allowance || 0) > 0 && (
              <Line label="Dinner Allowance" amount={breakdown.total_dinner_allowance} tone="blue" />
            )}
            <Subtotal label="Allowances total (matches header)" amount={listedAllowancesTotal || totalAllowances} tone="blue" />
            {Math.abs((listedAllowancesTotal || 0) - totalAllowances) > 0.05 && (
              <p className="text-[11px] text-amber-700 mt-1">
                Note: stored total {formatMoney(totalAllowances)} vs listed {formatMoney(listedAllowancesTotal)}.
              </p>
            )}
          </div>

          {/* BONUSES */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
            <div className="text-sm font-bold text-indigo-900 mb-1">Bonuses breakdown</div>
            <p className="text-[11px] text-indigo-700/80 mb-3">
              Includes monthly bonus / KPI bonus when applicable.
            </p>
            {bonuses.length === 0 ? (
              <div className="text-xs text-gray-500">No bonus lines for this month.</div>
            ) : (
              bonuses.map((b, i) => (
                <Line
                  key={`bon-${i}`}
                  label={b.name || "Bonus"}
                  amount={b.amount}
                  tone="blue"
                  hint={b.category || "General"}
                />
              ))
            )}
            {monthlyBonus > 0 && !bonuses.some((b) => String(b.category || "").includes("monthly")) && (
              <Line label="Monthly Bonus (compensation)" amount={monthlyBonus} tone="blue" />
            )}
            <Subtotal label="Bonuses total (matches header)" amount={listedBonusesTotal || totalBonuses} tone="blue" />
          </div>

          {/* BASIC DEDUCTIONS */}
          <div className="rounded-2xl border border-red-100 p-4">
            <div className="text-sm font-bold text-gray-800 mb-3">Basic-side deductions</div>
            {basicDeductionLines.map((line, i) => (
              <Line key={`bd-${i}`} label={line.label} amount={line.amount} />
            ))}
            <Line label="Stamp Duty" amount={stampDuty} />
            <Subtotal label="Basic deductions + stamp" amount={basicDeductionsSum + stampDuty} />
          </div>

          {/* BONUS / PENALTY DEDUCTIONS */}
          <div className="rounded-2xl border border-red-100 p-4">
            <div className="text-sm font-bold text-gray-800 mb-3">Bonus-side / penalty / custom deductions</div>
            {bonusDeductionLines.map((line, i) => (
              <Line
                key={`bnd-${i}`}
                label={line.label}
                amount={line.amount}
                hint={line.hint}
                tone={line.infoOnly ? "muted" : "red"}
              />
            ))}
            <Subtotal label="Bonus-side deductions subtotal" amount={bonusDeductionsSum} />
          </div>

          {/* TOTAL DEDUCTIONS RECONCILIATION */}
          <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4 lg:col-span-2">
            <div className="text-sm font-bold text-red-900 mb-2">How Total Deductions is calculated</div>
            <Line label="Basic-side deductions" amount={basicDeductionsSum} />
            <Line label="Bonus-side / penalties / custom" amount={bonusDeductionsSum} />
            <Line label="Stamp Duty" amount={stampDuty} />
            <Subtotal label="Total Deductions (sum of above)" amount={reconstructedTotalDeductions} />
            <div className="flex justify-between text-sm mt-1 text-gray-700">
              <span>Header Total Deductions</span>
              <span className="font-bold">{formatMoney(totalDeductions)}</span>
            </div>
            {Math.abs(reconstructedTotalDeductions - totalDeductions) > 0.05 ? (
              <p className="text-[11px] text-amber-700 mt-2">
                Difference {formatMoney(Math.abs(reconstructedTotalDeductions - totalDeductions))} — refresh salary process data if values look stale.
              </p>
            ) : (
              <p className="text-[11px] text-green-700 mt-2">Breakdown matches the Total Deductions header.</p>
            )}
            <p className="text-[11px] text-gray-500 mt-2">
              Custom deduction lines listed above: {formatMoney(listedCustomDeductionsTotal)} (part of bonus-side total).
            </p>
          </div>

          {/* GROSS / OT */}
          <div className="rounded-2xl border border-gray-200 p-4 lg:col-span-2">
            <div className="text-sm font-bold text-gray-800 mb-2">Gross composition</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="rounded-xl border bg-gray-50 p-3">
                <div className="text-[11px] text-gray-500">Basic (+ BR/increment)</div>
                <div className="text-sm font-bold">{formatMoney(basicSalary)}</div>
                {brAllowance > 0 && <div className="text-[10px] text-gray-400">includes BR {formatMoney(brAllowance)}</div>}
              </div>
              <div className="rounded-xl border bg-gray-50 p-3">
                <div className="text-[11px] text-gray-500">Allowances</div>
                <div className="text-sm font-bold">{formatMoney(totalAllowances)}</div>
              </div>
              <div className="rounded-xl border bg-gray-50 p-3">
                <div className="text-[11px] text-gray-500">Bonuses</div>
                <div className="text-sm font-bold">{formatMoney(totalBonuses)}</div>
              </div>
              <div className="rounded-xl border bg-gray-50 p-3">
                <div className="text-[11px] text-gray-500">OT total</div>
                <div className="text-sm font-bold">{formatMoney(otTotal)}</div>
              </div>
            </div>
            <Line label={`OT Morning (${breakdown.ot_morning_hours || 0} hrs)`} amount={otMorning} tone="muted" />
            <Line label={`OT Night (${breakdown.ot_night_hours || 0} hrs)`} amount={otNight} tone="muted" />
            <Line label={`Holiday OT (${breakdown.holiday_ot_hours || 0} hrs)`} amount={holidayOt} tone="muted" />
            <Subtotal
              label="Gross (Basic + Allowances + Bonuses + OT)"
              amount={basicSalary + totalAllowances + totalBonuses + otTotal}
              tone="green"
            />
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Header Gross</span>
              <span className="font-bold">{formatMoney(gross)}</span>
            </div>
            <div className="mt-3 pt-2 border-t space-y-2">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-sm">
                <span className="font-bold text-slate-800">Basic Net = (Basic + Allowances) − Basic Deductions</span>
                <span className="font-extrabold text-slate-800">
                  {formatMoney(basicGross)} − {formatMoney(basicDeductionsForNet)} = {formatMoney(basicNet)}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-sm">
                <span className="font-bold text-indigo-800">Bonus Net = Bonuses − Bonus Deductions</span>
                <span className="font-extrabold text-indigo-800">
                  {formatMoney(bonusGross)} − {formatMoney(bonusDeductionsSum)} = {formatMoney(bonusNet)}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-sm pt-2 border-t">
                <span className="font-bold text-green-800">Net = Gross − Total Deductions</span>
                <span className="font-extrabold text-green-700">
                  {formatMoney(gross)} − {formatMoney(totalDeductions)} = {formatMoney(net)}
                </span>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 mt-2 space-y-1">
                <p className="text-[11px] text-emerald-800 font-semibold">
                  EPF / ETF base = basic − basic NoPay
                  {epfEtfBase > 0 ? ` (${formatMoney(epfEtfBase)})` : ""}
                </p>
                <Line label="EPF employee 8%" amount={epfEmployee} tone="green" hint="from EPF/ETF base" />
                <Line label="EPF employer 12%" amount={epfEmployer} tone="green" hint="employer — not deducted from net" />
                <Line label="ETF employer 3%" amount={etfEmployer} tone="green" hint="employer — not deducted from net" />
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
};

export default EmployeeSalaryCard;
