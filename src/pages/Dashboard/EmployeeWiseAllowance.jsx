import employeeService from "@services/EmployeeDataService";
import AllowancesService from "@services/AllowancesService";
import { fetchCompanies } from "@services/ApiDataService";
import {
  assignAllowance,
  deleteAssignedAllowance,
  listAssignedAllowances,
} from "@services/AssignSalaryComponentService";
import {
  Building2,
  CalendarRange,
  Loader2,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => currentYear - 2 + i);

export function looksLikeSalaryAdvance(...parts) {
  const n = parts.map((p) => String(p || "").toLowerCase()).join(" ").trim();
  if (!n) return false;
  const compact = n.replace(/[\s_-]+/g, "");
  if (["advance", "salaryadvance", "advancesalary"].includes(compact)) return true;
  if (compact.includes("salaryadvance") || compact.includes("advancesalary")) return true;
  return /\badvance\b/.test(n);
}

function isSalaryAdvanceItem(item, nameKey, codeKey) {
  if (!item) return false;
  const from = String(item.deduct_from || "").toLowerCase();
  if (from === "basic" || from === "bonus") return true;
  return looksLikeSalaryAdvance(item[nameKey], item[codeKey], item.category);
}

function monthCount(fromMonth, fromYear, toMonth, toYear) {
  const from = fromYear * 12 + fromMonth;
  const to = toYear * 12 + toMonth;
  return Math.max(0, to - from + 1);
}

export default function EmployeeWiseAllowance() {
  const [companies, setCompanies] = useState([]);
  const [predefined, setPredefined] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [deletingId, setDeletingId] = useState(null);

  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (filterCompany) params.company_id = filterCompany;
      if (filterMonth) params.month = filterMonth;
      if (filterYear) params.year = filterYear;
      setAssignments(await listAssignedAllowances(params));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load allowance assignments");
    } finally {
      setIsLoading(false);
    }
  }, [filterCompany, filterMonth, filterYear]);

  useEffect(() => {
    (async () => {
      try {
        const [companyList, allowanceList] = await Promise.all([
          fetchCompanies(),
          AllowancesService.getAllAllowances(),
        ]);
        setCompanies(companyList || []);
        setPredefined((allowanceList || []).filter((a) => a.status !== "inactive"));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load masters");
      }
    })();
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return assignments;
    return assignments.filter(
      (r) =>
        String(r.allowance_code || "").toLowerCase().includes(term) ||
        String(r.allowance_name || "").toLowerCase().includes(term) ||
        String(r.employee_name || "").toLowerCase().includes(term) ||
        String(r.attendance_no || "").toLowerCase().includes(term)
    );
  }, [assignments, searchTerm]);

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this allowance for this month?")) return;
    setDeletingId(id);
    try {
      await deleteAssignedAllowance(id);
      toast.success("Assignment removed");
      await loadAssignments();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove assignment");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Assign Allowances</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pick a predefined allowance, choose employee or company, then Fixed (range) or
            Variable (one month). After the end month, nothing is applied.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={predefined.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Assign Allowance
        </button>
      </div>

      {predefined.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No predefined allowances yet. Go to <strong>1. Predefine</strong> and create one first.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <select
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_label || c.name}
            </option>
          ))}
        </select>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">All months</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">All years</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search employee / allowance"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Emp No</th>
                <th className="px-4 py-3">Allowance</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-teal-50/30">
                  <td className="px-4 py-3">{row.employee_name}</td>
                  <td className="px-4 py-3">{row.attendance_no}</td>
                  <td className="px-4 py-3">
                    {row.allowance_code} — {row.allowance_name}
                  </td>
                  <td className="px-4 py-3">
                    {MONTHS.find((m) => m.value === Number(row.month))?.label || row.month}/
                    {row.year}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{Number(row.amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={deletingId === row.id}
                      onClick={() => handleDelete(row.id)}
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700"
                    >
                      {deletingId === row.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No assignments for this filter. Click Assign Allowance to add.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <AssignModal
          companies={companies}
          predefined={predefined}
          accent="teal"
          title="Assign Allowance"
          itemLabel="Allowance"
          idKey="allowance_id"
          codeKey="allowance_code"
          nameKey="allowance_name"
          onClose={() => setShowModal(false)}
          onAssign={assignAllowance}
          onSuccess={async () => {
            setShowModal(false);
            await loadAssignments();
          }}
        />
      )}
    </div>
  );
}

function AssignModal({
  companies,
  predefined,
  accent,
  title,
  itemLabel,
  idKey,
  codeKey,
  nameKey,
  onClose,
  onAssign,
  onSuccess,
}) {
  const now = new Date();
  const [step, setStep] = useState(1);
  const [applyTo, setApplyTo] = useState("employee");
  const [companyId, setCompanyId] = useState("");
  const [itemId, setItemId] = useState("");
  const [valueType, setValueType] = useState("fixed");
  const [fromMonth, setFromMonth] = useState(now.getMonth() + 1);
  const [fromYear, setFromYear] = useState(now.getFullYear());
  const [toMonth, setToMonth] = useState(now.getMonth() + 1);
  const [toYear, setToYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [amount, setAmount] = useState("");
  const [deductFrom, setDeductFrom] = useState("bonus");
  const [employee, setEmployee] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const attendanceRef = useRef(null);

  const filteredItems = useMemo(() => {
    if (!companyId) return predefined;
    return predefined.filter((a) => String(a.company_id) === String(companyId));
  }, [predefined, companyId]);

  const selected = useMemo(
    () => predefined.find((a) => String(a.id) === String(itemId)),
    [predefined, itemId]
  );
  const salaryAdvance = idKey === "deduction_id" && isSalaryAdvanceItem(selected, nameKey, codeKey);

  useEffect(() => {
    if (salaryAdvance) {
      setDeductFrom(selected?.deduct_from === "basic" ? "basic" : "bonus");
    }
  }, [salaryAdvance, selected?.deduct_from]);

  const months = valueType === "fixed"
    ? monthCount(Number(fromMonth), Number(fromYear), Number(toMonth), Number(toYear))
    : 1;

  const accentBtn = accent === "rose" ? "bg-rose-700 hover:bg-rose-800" : "bg-teal-700 hover:bg-teal-800";
  const accentRing = accent === "rose" ? "ring-rose-600 border-rose-600" : "ring-teal-600 border-teal-600";
  const accentSoft = accent === "rose" ? "bg-rose-50 text-rose-900" : "bg-teal-50 text-teal-900";

  const searchEmployee = async () => {
    const no = attendanceRef.current?.value?.trim();
    if (!no) {
      toast.error("Enter attendance number");
      return;
    }
    try {
      const emp = await employeeService.searchByAttendanceNo(no);
      if (!emp) {
        toast.error("Employee not found");
        setEmployee(null);
        return;
      }
      setEmployee(emp);
      const empCompany = emp.organization_assignment?.company_id;
      if (empCompany) setCompanyId(String(empCompany));
    } catch (err) {
      console.error(err);
      toast.error("Employee search failed");
    }
  };

  const canNextFrom1 = !!itemId && (applyTo === "all" ? !!companyId : !!employee?.id);
  const canNextFrom2 =
    valueType === "fixed"
      ? months > 0 && months <= 36
      : amount !== "" && Number(amount) >= 0;

  const handleSubmit = async () => {
    if (!canNextFrom1 || !canNextFrom2) return;

    const payload = {
      apply_to: applyTo,
      employee_id: applyTo === "employee" ? employee.id : null,
      company_id: companyId || selected?.company_id || null,
      [idKey]: Number(itemId),
      value_type: valueType,
    };
    if (salaryAdvance) {
      payload.deduct_from = deductFrom === "basic" ? "basic" : "bonus";
    }

    if (valueType === "fixed") {
      Object.assign(payload, {
        from_month: Number(fromMonth),
        from_year: Number(fromYear),
        to_month: Number(toMonth),
        to_year: Number(toYear),
      });
    } else {
      Object.assign(payload, {
        month: Number(month),
        year: Number(year),
        amount: Number(amount),
      });
    }

    setIsSaving(true);
    try {
      const res = await onAssign(payload);
      toast.success(
        `${res.message || "Assigned"} (${res.affected_employees} employee(s), ${res.months} month(s))`
      );
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message ||
          (err.response?.data?.errors && JSON.stringify(err.response.data.errors)) ||
          "Assign failed"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">Step {step} of 3</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-100 px-5 py-3">
          {["Item & scope", "Fixed / Variable", "Confirm"].map((label, i) => (
            <div
              key={label}
              className={`flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium ${
                step === i + 1 ? accentSoft : "bg-slate-50 text-slate-400"
              }`}
            >
              {i + 1}. {label}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Apply to</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setApplyTo("employee")}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                      applyTo === "employee" ? accentRing + " ring-1 " + accentSoft : "border-slate-200"
                    }`}
                  >
                    <User className="h-5 w-5" />
                    <div>
                      <div className="text-sm font-semibold">One employee</div>
                      <div className="text-xs text-slate-500">Search by attendance no</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplyTo("all")}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                      applyTo === "all" ? accentRing + " ring-1 " + accentSoft : "border-slate-200"
                    }`}
                  >
                    <Building2 className="h-5 w-5" />
                    <div>
                      <div className="text-sm font-semibold">Entire company</div>
                      <div className="text-xs text-slate-500">All employees in company</div>
                    </div>
                  </button>
                </div>
              </div>

              {applyTo === "employee" && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Employee</label>
                  <div className="flex gap-2">
                    <input
                      ref={attendanceRef}
                      placeholder="Attendance number"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={searchEmployee}
                      className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white"
                    >
                      Search
                    </button>
                  </div>
                  {employee && (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      {employee.name_with_initials || employee.full_name} (
                      {employee.attendance_employee_no})
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    setItemId("");
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  required={applyTo === "all"}
                >
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_label || c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Predefined {itemLabel}
                </label>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Select {itemLabel.toLowerCase()}</option>
                  {filteredItems.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a[codeKey]} — {a[nameKey]}
                      {a.amount != null ? ` · ${Number(a.amount).toFixed(2)}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {salaryAdvance && (
                <DeductFromRadios
                  value={deductFrom}
                  onChange={setDeductFrom}
                  employeeWise={applyTo === "employee"}
                />
              )}
            </>
          )}

          {step === 2 && (
            <>
              {salaryAdvance && (
                <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                  This assignment will deduct from{" "}
                  <strong>{deductFrom === "basic" ? "basic salary" : "monthly bonus"}</strong>
                  . Change it on the previous step if needed.
                </p>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Mode</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setValueType("fixed")}
                    className={`rounded-xl border p-4 text-left transition ${
                      valueType === "fixed" ? accentRing + " ring-1 " + accentSoft : "border-slate-200"
                    }`}
                  >
                    <CalendarRange className="mb-2 h-5 w-5" />
                    <div className="text-sm font-semibold">Fixed</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Month range. Uses master amount. Stops after end month.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setValueType("variable");
                      setAmount("");
                    }}
                    className={`rounded-xl border p-4 text-left transition ${
                      valueType === "variable"
                        ? accentRing + " ring-1 " + accentSoft
                        : "border-slate-200"
                    }`}
                  >
                    <CalendarRange className="mb-2 h-5 w-5" />
                    <div className="text-sm font-semibold">Variable</div>
                    <div className="mt-1 text-xs text-slate-500">
                      One month only. Enter the amount to apply.
                    </div>
                  </button>
                </div>
              </div>

              {valueType === "fixed" ? (
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs text-slate-600">
                    Master amount:{" "}
                    <strong>{Number(selected?.amount || 0).toFixed(2)}</strong>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectMonth label="From month" value={fromMonth} onChange={setFromMonth} />
                    <SelectYear label="From year" value={fromYear} onChange={setFromYear} />
                    <SelectMonth label="To month" value={toMonth} onChange={setToMonth} />
                    <SelectYear label="To year" value={toYear} onChange={setToYear} />
                  </div>
                  {months > 36 && (
                    <p className="text-xs text-rose-600">Range cannot exceed 36 months.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <SelectMonth label="Month" value={month} onChange={setMonth} />
                    <SelectYear label="Year" value={year} onChange={setYear} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      required
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <div className={`space-y-3 rounded-xl p-4 ${accentSoft}`}>
              <h4 className="font-semibold">Confirm assignment</h4>
              <ul className="space-y-1.5 text-sm">
                <li>
                  <strong>{itemLabel}:</strong> {selected?.[codeKey]} — {selected?.[nameKey]}
                </li>
                <li>
                  <strong>Scope:</strong>{" "}
                  {applyTo === "all"
                    ? `Entire company (#${companyId})`
                    : `${employee?.name_with_initials || employee?.full_name} (${employee?.attendance_employee_no})`}
                </li>
                <li>
                  <strong>Mode:</strong> {valueType === "fixed" ? "Fixed (month range)" : "Variable (single month)"}
                </li>
                <li>
                  <strong>Period:</strong>{" "}
                  {valueType === "fixed"
                    ? `${MONTHS.find((m) => m.value === Number(fromMonth))?.label} ${fromYear} → ${MONTHS.find((m) => m.value === Number(toMonth))?.label} ${toYear}`
                    : `${MONTHS.find((m) => m.value === Number(month))?.label} ${year}`}
                </li>
                <li>
                  <strong>Amount:</strong>{" "}
                  {valueType === "fixed"
                    ? Number(selected?.amount || 0).toFixed(2)
                    : Number(amount || 0).toFixed(2)}
                </li>
                <li>
                  <strong>Will create:</strong> {months} month row(s)
                  {applyTo === "all" ? " per employee in company" : ""}
                </li>
                {salaryAdvance && (
                  <li>
                    <strong>Deduct from:</strong>{" "}
                    {deductFrom === "basic" ? "Basic salary" : "Monthly bonus"}
                    {applyTo === "employee" ? " (this employee)" : " (all selected employees)"}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={() => (step === 1 ? onClose() : setStep((s) => s - 1))}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>
          {step < 3 ? (
            <button
              type="button"
              disabled={step === 1 ? !canNextFrom1 : !canNextFrom2}
              onClick={() => setStep((s) => s + 1)}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${accentBtn}`}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSubmit}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${accentBtn}`}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm & Assign
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DeductFromRadios({ value, onChange, employeeWise }) {
  return (
    <fieldset className="rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-3">
      <legend className="text-sm font-semibold text-slate-800 px-1">
        Deduct salary advance from
      </legend>
      <p className="text-xs text-slate-500 mb-2">
        {employeeWise
          ? "This employee only. Payroll will take this assignment from monthly bonus or basic salary."
          : "Applies to every employee in this assignment. You can assign again per employee with a different choice."}
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={value !== "basic"}
            onChange={() => onChange("bonus")}
          />
          Monthly bonus (default)
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={value === "basic"}
            onChange={() => onChange("basic")}
          />
          Basic salary
        </label>
      </div>
    </fieldset>
  );
}

function SelectMonth({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SelectYear({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

export { AssignModal, MONTHS, YEARS, monthCount };
