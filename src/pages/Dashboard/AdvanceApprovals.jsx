import React, { useEffect, useState } from "react";
import { Check, Plus, X, RefreshCw, Wallet } from "lucide-react";
import {
  createHrAdvance,
  listAdvanceRequests,
  reviewAdvanceRequest,
  updateAdvanceDeductFrom,
} from "../../services/EmployeePortalService";
import employeeService from "../../services/EmployeeDataService";

const money = (v) =>
  `Rs. ${Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const deductLabel = (row) => {
  if (row.status === "REJECTED") return null;
  const saved = String(row.deduct_from || "").toLowerCase();
  // Payroll treats an approved advance without a saved choice as monthly bonus.
  const v = row.status === "PENDING"
    ? saved || String(row.hr_deduct_from || "").toLowerCase()
    : saved || "bonus";
  if (v === "basic") return "Basic salary";
  if (v === "bonus") return "Monthly bonus";
  return null;
};

const rowDefaultDeduct = (row) => {
  const v = String(row?.deduct_from || row?.hr_deduct_from || "bonus").toLowerCase();
  return v === "basic" ? "basic" : "bonus";
};

function DeductFromField({ value, onChange }) {
  return (
    <fieldset className="md:col-span-2 rounded-xl border border-teal-100 bg-teal-50/40 px-3 py-2">
      <legend className="text-xs font-semibold text-slate-700 px-1">
        Deduct from payroll
      </legend>
      <p className="text-xs text-slate-500 mb-2">HR only — employees cannot choose this.</p>
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

export default function AdvanceApprovals() {
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState({});
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    employee_id: "",
    amount: "",
    needed_on: "",
    reason: "",
    deduct_from: "bonus",
  });
  const [approveFrom, setApproveFrom] = useState({});
  const [changeFrom, setChangeFrom] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      const data = await listAdvanceRequests(status ? { status } : {});
      setItems(data.items || []);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to load advance requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  useEffect(() => {
    employeeService
      .fetchEmployees()
      .then((rows) => setEmployees(Array.isArray(rows) ? rows : rows?.data || []))
      .catch(() => setEmployees([]));
  }, []);

  const review = async (id, action) => {
    try {
      await reviewAdvanceRequest(id, {
        action,
        note: note[id] || "",
        ...(action === "APPROVE"
          ? { deduct_from: approveFrom[id] || rowDefaultDeduct(items.find((r) => r.id === id)) }
          : {}),
      });
      setMsg(`Request ${action === "APPROVE" ? "approved" : "rejected"}`);
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Review failed");
    }
  };

  const saveDeductFrom = async (row) => {
    try {
      const res = await updateAdvanceDeductFrom(row.id, changeFrom[row.id]);
      setMsg(res?.message || "Payroll deduct source updated");
      setChangeFrom((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Update failed");
    }
  };

  const createFromHr = async (e) => {
    e.preventDefault();
    try {
      await createHrAdvance({
        employee_id: Number(form.employee_id),
        amount: Number(form.amount),
        needed_on: form.needed_on || null,
        reason: form.reason,
        deduct_from: form.deduct_from || "bonus",
      });
      setMsg("Salary advance created by HR and sent to Pending Payments (if the company pack is on).");
      setForm({ employee_id: "", amount: "", needed_on: "", reason: "", deduct_from: "bonus" });
      await load();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Create failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[var(--brand-ink)] flex items-center gap-2">
            <Wallet className="w-6 h-6 text-teal-600" />
            Salary Advance Approvals
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            HR can create advances here, or approve portal requests. Choose whether payroll deducts from monthly bonus (default) or basic salary. The employee portal cannot pick this.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="border border-teal-100 rounded-xl px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="">All</option>
          </select>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 text-teal-800 text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <form
        onSubmit={createFromHr}
        className="bg-white rounded-2xl border border-teal-50 p-4 shadow-[0_10px_30px_rgba(6,42,50,0.06)] grid gap-3 md:grid-cols-2"
      >
        <p className="md:col-span-2 font-semibold text-sm text-slate-800 flex items-center gap-2">
          <Plus className="w-4 h-4 text-teal-600" />
          Create salary advance from HR
        </p>
        <select
          required
          className="border border-teal-100 rounded-xl px-3 py-2 text-sm"
          value={form.employee_id}
          onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
        >
          <option value="">Select employee</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.attendance_employee_no ? `#${emp.attendance_employee_no} · ` : ""}
              {emp.full_name || emp.name_with_initials || `Employee ${emp.id}`}
            </option>
          ))}
        </select>
        <input
          required
          type="number"
          min="1"
          step="0.01"
          placeholder="Amount"
          className="border border-teal-100 rounded-xl px-3 py-2 text-sm"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <input
          type="date"
          className="border border-teal-100 rounded-xl px-3 py-2 text-sm"
          value={form.needed_on}
          onChange={(e) => setForm({ ...form, needed_on: e.target.value })}
        />
        <input
          required
          type="text"
          placeholder="Reason"
          className="border border-teal-100 rounded-xl px-3 py-2 text-sm"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
        <DeductFromField
          value={form.deduct_from}
          onChange={(deduct_from) => setForm({ ...form, deduct_from })}
        />
        <button
          type="submit"
          className="md:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold"
        >
          Save HR advance
        </button>
      </form>

      {msg && (
        <div className="rounded-xl bg-teal-50 border border-teal-100 px-4 py-2 text-sm text-teal-800">
          {msg}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-500 text-sm">No advance requests found.</p>
      ) : (
        <div className="space-y-3">
          {items.map((row) => (
            <article
              key={row.id}
              className="bg-white rounded-2xl border border-teal-50 p-4 shadow-[0_10px_30px_rgba(6,42,50,0.06)]"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-display font-bold text-lg text-[var(--brand-ink)]">
                    {money(row.amount)}
                  </p>
                  <p className="text-sm text-slate-600">
                    {row.employee?.full_name ||
                      row.employee?.name_with_initials ||
                      `Employee #${row.employee_id}`}
                    {row.employee?.attendance_employee_no
                      ? ` · #${row.employee.attendance_employee_no}`
                      : ""}
                    {row.company_name ? ` · ${row.company_name}` : ""}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">{row.reason}</p>
                  {row.needed_on && (
                    <p className="text-xs text-slate-400 mt-1">
                      Needed on: {String(row.needed_on).slice(0, 10)}
                    </p>
                  )}
                  {deductLabel(row) && (
                    <p className="text-xs text-teal-800 mt-1 font-semibold">
                      Payroll deduct from: {deductLabel(row)}
                      {row.status === "PENDING" ? " (on approve)" : ""}
                      {row.source === "hr" ? " · Created by HR" : ""}
                    </p>
                  )}
                </div>
                <span
                  className={`h-fit px-2.5 py-1 rounded-full text-xs font-semibold ${
                    row.status === "APPROVED"
                      ? "bg-emerald-100 text-emerald-800"
                      : row.status === "REJECTED"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {row.status}
                </span>
              </div>

              {row.status === "PENDING" && (
                <div className="mt-3 flex flex-col gap-2">
                  <DeductFromField
                    value={approveFrom[row.id] || rowDefaultDeduct(row)}
                    onChange={(deduct_from) =>
                      setApproveFrom({ ...approveFrom, [row.id]: deduct_from })
                    }
                  />
                  <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Review note (optional)"
                    className="flex-1 min-w-[180px] border border-teal-100 rounded-xl px-3 py-2 text-sm"
                    value={note[row.id] || ""}
                    onChange={(e) =>
                      setNote({ ...note, [row.id]: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => review(row.id, "APPROVE")}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
                  >
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => review(row.id, "REJECT")}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                  </div>
                </div>
              )}

              {row.status === "APPROVED" && (
                <div className="mt-3 flex flex-col gap-2">
                  <DeductFromField
                    value={changeFrom[row.id] || (row.deduct_from === "basic" ? "basic" : "bonus")}
                    onChange={(deduct_from) =>
                      setChangeFrom({ ...changeFrom, [row.id]: deduct_from })
                    }
                  />
                  {changeFrom[row.id] &&
                    changeFrom[row.id] !== (row.deduct_from === "basic" ? "basic" : "bonus") && (
                      <button
                        type="button"
                        onClick={() => saveDeductFrom(row)}
                        className="self-start inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold"
                      >
                        <Check className="w-4 h-4" /> Save deduct source
                      </button>
                    )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
