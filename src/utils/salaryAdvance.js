/** Same rule as backend SalaryAdvanceService::isNamedAdvanceDeduction. */
export const isAdvanceDeductionName = (name) => {
  const n = String(name || "").toLowerCase().trim();
  if (!n) return false;
  const compact = n.replace(/[\s_-]+/g, "");
  if (["advance", "salaryadvance", "advancesalary"].includes(compact)) return true;
  return (
    n.includes("salary advance") ||
    n.includes("salary_advance") ||
    n.includes("advance salary") ||
    n.includes("advance_salary") ||
    /\badvance\b/.test(n)
  );
};

/** Assigned deduction line that payroll treats as a salary advance (flag, name or code). */
export const isAdvanceDeduction = (d) =>
  !!Number(d?.is_advance) || isAdvanceDeductionName(d?.name) || isAdvanceDeductionName(d?.code);
