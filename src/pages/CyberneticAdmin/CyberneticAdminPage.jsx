import React, { useEffect, useState } from "react";
import { Building2, CheckCircle2, Lock, LogOut, MapPin, Plus, Save, Settings2, Shield, Upload } from "lucide-react";
import Swal from "sweetalert2";
import {
  activateCompanyPortal,
  createCompany,
  fetchCompanies,
  fetchDepartmentsById,
  updateCompany,
  uploadCompanyLogo,
} from "../../services/ApiDataService";
import {
  getCyberneticToken,
  loadCyberneticAdmin,
  loginCyberneticAdmin,
  logoutCyberneticAdmin,
} from "../../services/cyberneticAdminService";
import { extractThemeFromImageFile, applyThemeToDocument } from "../../utils/logoTheme";
import { googleDriveLogoUrl } from "../../utils/googleDriveLogo";
import { isFirebaseConfigured, uploadToFirebase } from "../../services/firebaseStorage";
import { useBranding } from "../../contexts/BrandingContext";

const PROCESS_OPTIONS = [
  {
    key: "spm_standard",
    label: "SPM current process",
    summary:
      "One roster shift per day. Working hours are the full IN–OUT span. OT, late, NoPay, attendance and salary stay on the current SPM Tax rules.",
  },
  {
    key: "shift_roster",
    label: "Multiple roster (manual table)",
    summary:
      "One employee can work more than one roster on the same day (Kasun R1+R3, Saman R2+R4). Overnight rosters such as R4 18:00–02:00 next day are allowed. Early/late IN and OUT are recorded; OT or penalty is applied from the rules below.",
  },
];

const OT_HOUR_OPTIONS = [
  {
    key: "current",
    label: "Current OT hours",
    summary:
      "Keep the existing OT hour rule: time is taken in 30-minute blocks, and OT is saved only when it is more than 0.5 hours.",
  },
  {
    key: "minute_band",
    label: "Minute-band OT hours",
    summary:
      "0h 00–29m = 0. 0h 30–44m = 0.30. 0h 45–59m = 0.45. For 1h+: 00–14m keep whole hours; 15–29m add 0.15; 30–44m add 0.30; 45–59m add 0.45.",
  },
  {
    key: "shift_end_band",
    label: "After shift-end 15-minute OT",
    summary:
      "After shift end: first 30 minutes = no OT. From 31 minutes = 0.30. From 45 minutes = 0.45. From 1 hour = 1.00. After that first hour, every extra 15 minutes adds 0.15 (1.15, 1.30, 1.45, 2.00…).",
  },
];

const EMPLOYEE_ADDON_PACKS = [
  ["qualifications", "Quals"],
  ["following_qualifications", "Following"],
  ["ol_results", "O/L"],
  ["al_results", "A/L"],
  ["previous_employment", "Prev. employment"],
  ["hr_company_create", "HR adds companies"],
  ["contract_as_permanent", "Contract = permanent"],
];

const packOn = (company, key) =>
  !!(company?.process_config?.[key]?.enabled ?? company?.process_config?.[key] === true);

const FUTURE_CONFIGS = [
  {
    key: "holiday_calendar",
    label: "Holiday calendar pack",
    summary: "Public holidays and OT holiday mapping for this company.",
  },
  {
    key: "biometric_map",
    label: "Biometric device map",
    summary: "Bind Hikvision / fingerprint clocks to this tenant.",
  },
];

const emptyForm = {
  company_code: "",
  name: "",
  location: "",
  established: "",
  nopay_working_days: 30,
  slug: "",
  frontend_host: "",
  org_group: "",
  logo_url: "",
  theme_primary: "#0B4F5C",
  theme_secondary: "#0D9488",
  theme_accent: "#FF6B4A",
  late_attendance_policy_enabled: false,
  late_grace_nopay: false,
  late_grace_start_time: "07:15",
  late_grace_grace_minutes: 15,
  late_grace_block_minutes: 30,
  late_grace_days_per_block: 1,
  late_grace_deduct_from: "bonus",
  portal_active: false,
  attendance_process: "spm_standard",
  ot_hour_calculation: "current",
  early_in: "ot",
  late_in: "penalty",
  early_out: "penalty",
  late_out: "ot",
  leave_workflow: false,
  weekly_off: false,
  medical_claims: false,
  medical_leave: false,
  salary_advance: false,
  salary_advance_percent: 50,
  salary_advance_hr_deduct_from: "bonus",
  reland_excel_import: false,
  qualifications: false,
  ol_results: false,
  al_results: false,
  following_qualifications: false,
  previous_employment: false,
  hr_company_create: false,
  contract_as_permanent: false,
  medical_annual_quota: 0,
  punch_enabled: false,
  punch_scope: "company",
  punch_latitude: "",
  punch_longitude: "",
  punch_radius: 400,
  punch_office_name: "",
  punch_require_biometric: true,
  punch_department_ids: [],
};

export default function CyberneticAdminPage() {
  const { refreshBranding } = useBranding();
  const [authed, setAuthed] = useState(!!getCyberneticToken());
  const [checking, setChecking] = useState(!!getCyberneticToken());
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [sessionInfo, setSessionInfo] = useState(null);

  useEffect(() => {
    document.title = "Cybernetic Control Plane";
    let cancelled = false;
    const token = getCyberneticToken();
    if (!token) {
      setChecking(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!cancelled) setChecking(false);
    }, 4000);
    loadCyberneticAdmin()
      .then((me) => {
        if (!cancelled) {
          setAuthed(true);
          setSessionInfo(me);
        }
      })
      .catch(() => {
        logoutCyberneticAdmin({ revoke: false });
        if (!cancelled) setAuthed(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!authed) return;
    refresh();
  }, [authed]);

  const refresh = async () => {
    try {
      const rows = await fetchCompanies({ all: true });
      setCompanies(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setCompanies([]);
      Swal.fire({
        icon: "error",
        title: "Companies did not load",
        text:
          err?.response?.data?.message ||
          err?.message ||
          "The API did not return the company list. Check apiurbanhr is Laravel /api, not the welcome page.",
      });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const data = await loginCyberneticAdmin(password.trim());
      setSessionInfo(data);
      setAuthed(true);
      setPassword("");
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      if (apiMessage) {
        setLoginError(apiMessage);
      } else if (!err?.response) {
        setLoginError(
          "Login was blocked before the password was checked (CORS or the API host is not Laravel). Open Network and confirm the request reaches /index.php?__lr=/api/cybernetic-admin/login."
        );
      } else {
        setLoginError("Invalid password.");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const startEdit = (company) => {
    setEditingId(company.id);
    setLogoFile(null);
    setForm({
      company_code: company.company_code || "",
      name: company.name || "",
      location: company.location || "",
      established: company.established || "",
      nopay_working_days: company.nopay_working_days ?? 30,
      slug: company.slug || "",
      frontend_host: company.frontend_host || "",
      org_group: company.org_group || "",
      logo_url: company.logo_url || "",
      theme_primary: company.theme_primary || "#0B4F5C",
      theme_secondary: company.theme_secondary || "#0D9488",
      theme_accent: company.theme_accent || "#FF6B4A",
      late_attendance_policy_enabled: !!company.late_attendance_policy_enabled,
      late_grace_nopay: packOn(company, "late_grace_nopay"),
      late_grace_start_time: company.process_config?.late_grace_nopay?.start_time || "07:15",
      late_grace_grace_minutes: company.process_config?.late_grace_nopay?.grace_minutes ?? 15,
      late_grace_block_minutes: company.process_config?.late_grace_nopay?.block_minutes ?? 30,
      late_grace_days_per_block: company.process_config?.late_grace_nopay?.days_per_block ?? 1,
      late_grace_deduct_from:
        company.process_config?.late_grace_nopay?.deduct_from === "basic" ? "basic" : "bonus",
      portal_active: !!company.portal_active,
      attendance_process: company.attendance_process || "spm_standard",
      ot_hour_calculation: company.process_config?.ot_hour_calculation || "current",
      early_in: company.process_config?.multi_roster?.early_in || "ot",
      late_in: company.process_config?.multi_roster?.late_in || "penalty",
      early_out: company.process_config?.multi_roster?.early_out || "penalty",
      late_out: company.process_config?.multi_roster?.late_out || "ot",
      leave_workflow: !!(
        company.process_config?.leave_workflow?.enabled ??
        company.process_config?.leave_workflow
      ),
      weekly_off: !!(
        company.process_config?.weekly_off?.enabled ??
        company.process_config?.weekly_off
      ),
      medical_claims: !!(
        company.process_config?.medical_claims?.enabled ??
        company.process_config?.medical_claims
      ),
      medical_leave: !!(
        company.process_config?.medical_leave?.enabled ??
        company.process_config?.medical_leave
      ),
      salary_advance: !!(
        company.process_config?.salary_advance?.enabled ??
        company.process_config?.salary_advance
      ),
      reland_excel_import: !!(
        company.process_config?.reland_excel_import?.enabled ??
        company.process_config?.reland_excel_import
      ),
      qualifications: !!(
        company.process_config?.qualifications?.enabled ??
        company.process_config?.qualifications
      ),
      ol_results: packOn(company, "ol_results"),
      al_results: packOn(company, "al_results"),
      following_qualifications: packOn(company, "following_qualifications"),
      previous_employment: packOn(company, "previous_employment"),
      hr_company_create: packOn(company, "hr_company_create"),
      contract_as_permanent: packOn(company, "contract_as_permanent"),
      medical_annual_quota: company.process_config?.medical_claims?.annual_quota || 0,
      salary_advance_percent: company.process_config?.salary_advance?.percent || 50,
      salary_advance_hr_deduct_from:
        company.process_config?.salary_advance?.hr_deduct_from === "basic" ? "basic" : "bonus",
      punch_enabled: !!company.process_config?.mobile_punch?.enabled,
      punch_scope: company.process_config?.mobile_punch?.scope === "department" ? "department" : "company",
      punch_latitude: company.process_config?.mobile_punch?.latitude ?? "",
      punch_longitude: company.process_config?.mobile_punch?.longitude ?? "",
      punch_radius: company.process_config?.mobile_punch?.radiusMeters || 400,
      punch_office_name: company.process_config?.mobile_punch?.officeName || company.name || "",
      punch_require_biometric: company.process_config?.mobile_punch?.requireBiometric !== false,
      punch_department_ids: (company.process_config?.mobile_punch?.department_ids || []).map(Number),
    });
    fetchDepartmentsById(company.id).then((rows) => setDepartments(Array.isArray(rows) ? rows : []));
  };

  const startAdd = () => {
    setEditingId(null);
    setLogoFile(null);
    setForm(emptyForm);
    setDepartments([]);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_code: String(form.company_code || "").trim().toUpperCase(),
        established: form.established ? Number(form.established) : null,
        nopay_working_days: Number(form.nopay_working_days || 30),
        logo_url: googleDriveLogoUrl(form.logo_url),
        attendance_process: form.attendance_process || "spm_standard",
        process_config: {
          ...((editingId && companies.find((c) => c.id === editingId)?.process_config) || {}),
          attendance_process: form.attendance_process || "spm_standard",
          ot_hour_calculation: form.ot_hour_calculation || "current",
          multi_roster: {
            early_in: form.early_in || "ot",
            late_in: form.late_in || "penalty",
            early_out: form.early_out || "penalty",
            late_out: form.late_out || "ot",
          },
          leave_workflow: { enabled: !!form.leave_workflow },
          weekly_off: { enabled: !!form.weekly_off },
          medical_leave: { enabled: !!form.medical_leave },
          medical_claims: {
            enabled: !!form.medical_claims,
            annual_quota: Number(form.medical_annual_quota || 0),
          },
          salary_advance: {
            enabled: !!form.salary_advance,
            percent: Number(form.salary_advance_percent || 50),
            hr_deduct_from: form.salary_advance_hr_deduct_from === "basic" ? "basic" : "bonus",
          },
          reland_excel_import: { enabled: !!form.reland_excel_import },
          qualifications: { enabled: !!form.qualifications },
          ol_results: { enabled: !!form.ol_results },
          al_results: { enabled: !!form.al_results },
          following_qualifications: { enabled: !!form.following_qualifications },
          previous_employment: { enabled: !!form.previous_employment },
          hr_company_create: { enabled: !!form.hr_company_create },
          contract_as_permanent: { enabled: !!form.contract_as_permanent },
          late_grace_nopay: {
            enabled: !!form.late_grace_nopay,
            start_time: form.late_grace_start_time || "07:15",
            grace_minutes: Math.max(0, Number(form.late_grace_grace_minutes) || 0),
            block_minutes: Math.max(1, Number(form.late_grace_block_minutes) || 30),
            days_per_block: Math.max(0, Number(form.late_grace_days_per_block) || 0),
            deduct_from: form.late_grace_deduct_from === "basic" ? "basic" : "bonus",
          },
          mobile_punch: {
            enabled: !!form.punch_enabled,
            scope: form.punch_scope === "department" ? "department" : "company",
            latitude: form.punch_latitude === "" ? null : Number(form.punch_latitude),
            longitude: form.punch_longitude === "" ? null : Number(form.punch_longitude),
            radiusMeters: Number(form.punch_radius || 400),
            officeName: String(form.punch_office_name || form.name || "Office").trim(),
            requireBiometric: !!form.punch_require_biometric,
            department_ids:
              form.punch_scope === "department"
                ? (form.punch_department_ids || []).map(Number).filter(Boolean)
                : [],
          },
        },
      };
      let saved;
      if (editingId) {
        saved = await updateCompany(editingId, payload);
      } else {
        saved = await createCompany(payload);
      }
      if (saved?.id && logoFile) {
        await uploadCompanyLogo(saved.id, logoFile, { logo_url: payload.logo_url });
      }
      Swal.fire({
        icon: "success",
        title: editingId ? "Company updated" : "Company created",
        timer: 1400,
        showConfirmButton: false,
      });
      startAdd();
      await refresh();
      await refreshBranding();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Could not save",
        text: error?.response?.data?.message || "Check the form and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const setActivePortal = async (company) => {
    try {
      await activateCompanyPortal(company.id);
      Swal.fire({
        icon: "success",
        title: `${company.name} is now the active login brand`,
        timer: 1600,
        showConfirmButton: false,
      });
      await refresh();
      await refreshBranding();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Could not activate",
        text: error?.response?.data?.message || "Try again.",
      });
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#06141f] text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-teal-400/30 border-t-teal-400 animate-spin" />
          <p className="text-sm tracking-wide text-slate-400">Verifying control-plane session</p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#06141f] text-white relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(13,148,136,0.18),_transparent_55%)]" />
        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:flex-row lg:items-center lg:justify-between gap-12">
          <div className="max-w-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-400">Cybernetic</p>
            <h1 className="mt-3 font-[Outfit,sans-serif] text-4xl font-semibold leading-tight">
              Control plane
            </h1>
            <p className="mt-4 text-slate-400 leading-relaxed">
              Restricted operator console for tenant companies, branding, attendance packs and portal activation.
              This is not an HR user login.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 text-teal-400" />
                Signed JWT session stays in this browser after close, and expires automatically.
              </li>
              <li className="flex items-start gap-2">
                <Lock className="mt-0.5 h-4 w-4 text-teal-400" />
                Failed attempts are rate-limited. Use the server password from CYBERNETIC_ADMIN_PASSWORD.
              </li>
            </ul>
          </div>
          <form
            onSubmit={handleLogin}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-500/15 text-teal-300">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Operator sign-in</h2>
                <p className="text-sm text-slate-400">Cybernetic Admin</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Access password</label>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#06141f] px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Enter operator password"
            />
            {loginError && <p className="mt-2 text-sm text-red-400">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="mt-5 w-full rounded-lg bg-teal-500 py-2.5 font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-60"
            >
              {loginLoading ? "Authenticating…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-800 bg-[#06141f] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-500/15 text-teal-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-400">Cybernetic control plane</p>
              <h1 className="text-lg font-semibold">Tenant operations</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs text-slate-400 sm:block">
              <div>Operator session</div>
              <div>
                {sessionInfo?.expires_in_hours || sessionInfo?.session?.ttl_hours
                  ? `TTL ${sessionInfo.expires_in_hours || sessionInfo.session?.ttl_hours}h`
                  : "Signed in"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                logoutCyberneticAdmin();
                setSessionInfo(null);
                setAuthed(false);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Companies</h2>
            <button
              type="button"
              onClick={startAdd}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Company</th>
                  <th className="py-2 pr-3">HR URL</th>
                  <th className="py-2 pr-3">Org group</th>
                  <th className="py-2 pr-3">Login brand</th>
                  <th className="py-2 pr-3">Late policy</th>
                  <th className="py-2 pr-3">Payroll process</th>
                  <th className="py-2 pr-3">OT hours</th>
                  <th className="py-2 pr-3">Leave</th>
                  <th className="py-2 pr-3">Phone punch</th>
                  <th className="py-2 pr-3">Reland Excel</th>
                  <th className="py-2 pr-3">Employee add-ons</th>
                  <th className="py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-b last:border-0">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        {company.logo_url ? (
                          <img src={company.logo_url} alt="" referrerPolicy="no-referrer" className="h-8 w-8 object-contain" />
                        ) : (
                          <Building2 className="h-5 w-5 text-slate-400" />
                        )}
                        <div>
                          <div className="font-medium text-slate-900">{company.name}</div>
                          <div className="font-mono text-xs text-slate-500">{company.company_code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-teal-800">
                      {company.frontend_host || "—"}
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-slate-700">
                      {company.org_group || "—"}
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      {company.portal_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActivePortal(company)}
                          className="rounded-full border border-slate-200 px-2 py-0.5 font-medium text-slate-600 hover:border-teal-500 hover:text-teal-800"
                        >
                          Set active
                        </button>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      {company.late_attendance_policy_enabled ? (
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 font-semibold text-teal-800">On</span>
                      ) : (
                        <span className="text-slate-400">Off</span>
                      )}
                      {packOn(company, "late_grace_nopay") && (
                        <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">
                          Grace NoPay
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      {company.attendance_process === "shift_roster" ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">Multi roster</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">SPM current</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      {company.process_config?.ot_hour_calculation === "shift_end_band" ? (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-900">Shift-end band</span>
                      ) : company.process_config?.ot_hour_calculation === "minute_band" ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-900">Minute band</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">Current</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      {company.process_config?.leave_workflow?.enabled || company.process_config?.leave_workflow === true ? (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-900">Covering workflow</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">Current</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      {company.process_config?.mobile_punch?.enabled ? (
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 font-semibold text-teal-800">
                          {company.process_config.mobile_punch.scope === "department"
                            ? "Departments"
                            : "Company"}
                        </span>
                      ) : (
                        <span className="text-slate-400">Off</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      {company.process_config?.reland_excel_import?.enabled || company.process_config?.reland_excel_import === true ? (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-900">On</span>
                      ) : (
                        <span className="text-slate-400">Off</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      {EMPLOYEE_ADDON_PACKS.some(([key]) => packOn(company, key)) ? (
                        <span className="flex flex-wrap gap-1">
                          {EMPLOYEE_ADDON_PACKS.filter(([key]) => packOn(company, key)).map(([key, label]) => (
                            <span key={key} className="rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-900">
                              {label}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-slate-400">Off</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(company)}
                        className="text-teal-700 hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {companies.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">No companies yet.</p>
            )}
          </div>
        </section>

        <form onSubmit={save} className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-800">
            {editingId ? "Edit company" : "Add company"}
          </h2>
          <label className="block text-sm">
            Company ID
            <input
              required
              value={form.company_code}
              onChange={(e) => setForm({ ...form, company_code: e.target.value.toUpperCase() })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Location
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={!!form.portal_active}
              onChange={(e) => setForm({ ...form, portal_active: e.target.checked })}
            />
            <span>
              <span className="font-semibold text-emerald-900">Active login brand</span>
              <span className="block text-xs text-emerald-800">
                Login page uses this company&apos;s logo and theme colours. Only one company can be active.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={!!form.late_attendance_policy_enabled}
              onChange={(e) => setForm({ ...form, late_attendance_policy_enabled: e.target.checked })}
            />
            <span>
              <span className="font-semibold text-teal-900">Enable late attendance calculation</span>
              <span className="block text-xs text-teal-800">
                For {form.name || "this company"} only: monthly ≤30m deduction and &gt;30m leave/NoPay review. Leave off to ignore.
              </span>
            </span>
          </label>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.late_grace_nopay}
                onChange={(e) => setForm({ ...form, late_grace_nopay: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-amber-900">Variable allowance attendance (late grace NoPay)</span>
                <span className="block text-xs text-amber-800">
                  Each day, minutes late after start time + grace are added up for the month. Every time the total
                  reaches the block, the employee gets NoPay day(s). Replaces the other late NoPay deductions in salary
                  for {form.name || "this company"}.
                </span>
              </span>
            </label>
            {form.late_grace_nopay && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs text-amber-900">
                    Start time
                    <input
                      type="time"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={form.late_grace_start_time}
                      onChange={(e) => setForm({ ...form, late_grace_start_time: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-amber-900">
                    Grace (minutes / day)
                    <input
                      type="number"
                      min="0"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={form.late_grace_grace_minutes}
                      onChange={(e) => setForm({ ...form, late_grace_grace_minutes: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-amber-900">
                    Monthly total that triggers NoPay (minutes)
                    <input
                      type="number"
                      min="1"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={form.late_grace_block_minutes}
                      onChange={(e) => setForm({ ...form, late_grace_block_minutes: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-amber-900">
                    NoPay days each time
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={form.late_grace_days_per_block}
                      onChange={(e) => setForm({ ...form, late_grace_days_per_block: e.target.value })}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-amber-900">
                  <span className="font-semibold">Deduct from:</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="late_grace_deduct_from"
                      checked={form.late_grace_deduct_from !== "basic"}
                      onChange={() => setForm({ ...form, late_grace_deduct_from: "bonus" })}
                    />
                    Monthly bonus (variable allowance)
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="late_grace_deduct_from"
                      checked={form.late_grace_deduct_from === "basic"}
                      onChange={() => setForm({ ...form, late_grace_deduct_from: "basic" })}
                    />
                    Basic salary
                  </label>
                </div>
                <p className="text-xs text-amber-800">
                  Example: start {form.late_grace_start_time || "07:15"}, grace {form.late_grace_grace_minutes || 0} min —
                  IN at the start + {Number(form.late_grace_grace_minutes || 0) + 10} min counts 10 minutes. When the
                  month&apos;s total reaches {form.late_grace_block_minutes || 30} minutes = {form.late_grace_days_per_block || 0} NoPay
                  day(s), {Number(form.late_grace_block_minutes || 30) * 2} minutes = {Number(form.late_grace_days_per_block || 0) * 2}, and so on.
                  One day&apos;s pay = (basic + monthly bonus) ÷ NoPay working days.
                </p>
              </>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Settings2 className="h-4 w-4" />
              Company process configuration
            </div>
            <p className="text-xs text-slate-600">
              Attendance, OT, late, NoPay, working hours and salary for this company follow the option you select. More packs can be added later without changing other tenants.
            </p>
            <div className="space-y-2">
              {PROCESS_OPTIONS.map((option) => {
                const selected = (form.attendance_process || "spm_standard") === option.key;
                return (
                  <label
                    key={option.key}
                    className={`flex items-start gap-2 rounded-lg border p-3 text-sm cursor-pointer ${
                      selected ? "border-teal-500 bg-white" : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      name="attendance_process"
                      value={option.key}
                      checked={selected}
                      onChange={() => setForm({ ...form, attendance_process: option.key })}
                    />
                    <span>
                      <span className="font-semibold text-slate-900">{option.label}</span>
                      <span className="block text-xs text-slate-600 mt-0.5">{option.summary}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {form.attendance_process === "shift_roster" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-3">
                <p className="text-xs font-semibold text-amber-950">Manual roster table (example)</p>
                <p className="text-[11px] text-amber-900">
                  Create these as Shift Time codes, then assign more than one on the same day in Roster. Overnight end time is next morning.
                </p>
                <table className="w-full text-xs bg-white rounded-md overflow-hidden">
                  <thead className="bg-amber-100 text-amber-950">
                    <tr>
                      <th className="p-1.5 text-left">Code</th>
                      <th className="p-1.5 text-left">Window</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t"><td className="p-1.5 font-mono font-bold">R1</td><td className="p-1.5">06:00am – 01:00pm</td></tr>
                    <tr className="border-t"><td className="p-1.5 font-mono font-bold">R2</td><td className="p-1.5">10:00am – 04:00pm</td></tr>
                    <tr className="border-t"><td className="p-1.5 font-mono font-bold">R3</td><td className="p-1.5">03:00pm – 08:00pm</td></tr>
                    <tr className="border-t"><td className="p-1.5 font-mono font-bold">R4</td><td className="p-1.5">06:00pm – 02:00am (next day)</td></tr>
                  </tbody>
                </table>
                <p className="text-[11px] text-amber-900">Kasun can be R1 + R3 the same day. Saman can be R2 + R4. R4 OUT is recorded on the next calendar date.</p>
                <p className="text-[11px] uppercase tracking-wide text-amber-800 pt-1">OT or penalty (always recorded)</p>
                {[
                  { key: "early_in", label: "Early arrival" },
                  { key: "late_in", label: "Late arrival" },
                  { key: "early_out", label: "Early departure" },
                  { key: "late_out", label: "Late departure" },
                ].map((row) => (
                  <label key={row.key} className="flex items-center justify-between gap-2 text-xs text-slate-800">
                    <span>{row.label}</span>
                    <select
                      className="rounded border px-2 py-1 bg-white"
                      value={form[row.key]}
                      onChange={(e) => setForm({ ...form, [row.key]: e.target.value })}
                    >
                      {(row.key === "early_in" || row.key === "late_out"
                        ? [["ot", "OT"], ["record_only", "Record only"]]
                        : [["penalty", "Penalty"], ["record_only", "Record only"]]
                      ).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
            <p className="text-[11px] uppercase tracking-wide text-slate-500 pt-2">OT hour calculation</p>
            <p className="text-xs text-slate-600">
              Separate from attendance process. Current OT stays as it is unless you pick minute-band rounding for this company.
            </p>
            <div className="space-y-2">
              {OT_HOUR_OPTIONS.map((option) => {
                const selected = (form.ot_hour_calculation || "current") === option.key;
                return (
                  <label
                    key={option.key}
                    className={`flex items-start gap-2 rounded-lg border p-3 text-sm cursor-pointer ${
                      selected ? "border-teal-500 bg-white" : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      name="ot_hour_calculation"
                      value={option.key}
                      checked={selected}
                      onChange={() => setForm({ ...form, ot_hour_calculation: option.key })}
                    />
                    <span>
                      <span className="font-semibold text-slate-900">{option.label}</span>
                      <span className="block text-xs text-slate-600 mt-0.5">{option.summary}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.leave_workflow}
                onChange={(e) => setForm({ ...form, leave_workflow: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">Covering-person leave workflow</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Leave unchecked to keep the current leave process. Allow this pack to require a covering person, then supervisor, then HR, with portal balance and notifications.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.weekly_off}
                onChange={(e) => setForm({ ...form, weekly_off: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">Weekly off management</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Unchecked keeps the current day-off field only. Allow to earn weekly offs, apply from the portal, and publish an HR weekly-off calendar to employees after approve.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.medical_leave}
                onChange={(e) => setForm({ ...form, medical_leave: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">Medical leave with evidence</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Unchecked hides medical leave on the employee portal. Allow a separate medical request, optional report upload, HR cannot approve until evidence is attached, and days deduct Casual first then Annual.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.medical_claims}
                onChange={(e) => setForm({ ...form, medical_claims: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">Medical claims</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Unchecked = no medical-claim module. Allow portal bill upload, quota check, HR approve/reject, and Pending Payments.
                </span>
              </span>
            </label>
            {form.medical_claims && (
              <label className="block text-sm">
                Default annual medical quota (LKR)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={form.medical_annual_quota}
                  onChange={(e) => setForm({ ...form, medical_annual_quota: e.target.value })}
                />
              </label>
            )}
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.salary_advance}
                onChange={(e) => setForm({ ...form, salary_advance: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">Salary advance quota</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Unchecked keeps the current portal advance. Allow to show available amount, validate requests, notify, and send approved advances to Pending Payments.
                </span>
              </span>
            </label>
            {form.salary_advance && (
              <>
                <label className="block text-sm">
                  Available advance (% of basic)
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    value={form.salary_advance_percent}
                    onChange={(e) => setForm({ ...form, salary_advance_percent: e.target.value })}
                  />
                </label>
                <fieldset className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <legend className="font-semibold text-slate-900 px-1">
                    HR salary advance deduct from
                  </legend>
                  <p className="text-xs text-slate-600 mb-2">
                    Default for the HR approval screen if HR does not change it. Employees never see this choice.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="salary_advance_hr_deduct_from"
                      checked={form.salary_advance_hr_deduct_from !== "basic"}
                      onChange={() => setForm({ ...form, salary_advance_hr_deduct_from: "bonus" })}
                    />
                    Monthly bonus
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                      type="radio"
                      name="salary_advance_hr_deduct_from"
                      checked={form.salary_advance_hr_deduct_from === "basic"}
                      onChange={() => setForm({ ...form, salary_advance_hr_deduct_from: "basic" })}
                    />
                    Basic salary
                  </label>
                </fieldset>
              </>
            )}
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.reland_excel_import}
                onChange={(e) => setForm({ ...form, reland_excel_import: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">Reland fingerprint Excel import</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Unchecked hides Reland import on Time Card. Allow HR to upload Reland Raw Clock-InOut Log.xls and write those punches as time cards for this company only.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.qualifications}
                onChange={(e) => setForm({ ...form, qualifications: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">Employee qualifications</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Adds qualifications to the Education step in Employee Master. Allow HR to record any number of completed qualifications (e.g. 7 diplomas and 2 degrees), for this company only.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.following_qualifications}
                onChange={(e) => setForm({ ...form, following_qualifications: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">Following qualifications</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Adds a Following section to the Education step: name of the qualification, institute, starting and ending year/month, and Weekday or Weekend lectures, for this company only.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.ol_results}
                onChange={(e) => setForm({ ...form, ol_results: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">O/L results</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Adds O/L fields to the Education step in Employee Master: English grade, Mathematics grade and year sat, for this company only.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.al_results}
                onChange={(e) => setForm({ ...form, al_results: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">A/L details</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Adds A/L fields to the Education step in Employee Master: syllabus (National, Cambridge, AQA), subject stream and year sat, for this company only.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.previous_employment}
                onChange={(e) => setForm({ ...form, previous_employment: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">Previous employment information</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Adds a Previous Employment step to Employee Master: organization name, last designation, join date, last date and comments (50 words max), for this company only.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.hr_company_create}
                onChange={(e) => setForm({ ...form, hr_company_create: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">HR can create companies</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Shows Add Company in Department Master for HR users of this company who have Department Master &quot;add&quot;
                  permission. HR sets code, name, location, established and NoPay days only; the new company joins this
                  company&apos;s organization group. Branding, portal URL and add-ons stay here in Cybernetic Admin.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!form.contract_as_permanent}
                onChange={(e) => setForm({ ...form, contract_as_permanent: e.target.checked })}
              />
              <span>
                <span className="font-semibold text-slate-900">Contract employees follow the permanent process</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  Off = contract employees are kept out of the normal process and appear only in Contract Time Attendance.
                  On = this company&apos;s contract employees appear everywhere permanent employees do: employee lists, time
                  cards, attendance and absent reports, overtime, leave, dashboard counts and salary processing.
                </span>
              </span>
            </label>
            <div className="pt-1">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Coming soon</p>
              <div className="space-y-2">
                {FUTURE_CONFIGS.map((option) => (
                  <label
                    key={option.key}
                    className="flex items-start gap-2 rounded-lg border border-dashed border-slate-200 bg-white/70 p-3 text-sm opacity-70"
                  >
                    <input type="checkbox" className="mt-1" disabled />
                    <span>
                      <span className="font-semibold text-slate-700">{option.label}</span>
                      <span className="block text-xs text-slate-500 mt-0.5">{option.summary}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <label className="block text-sm">
            HR URL host
            <input
              value={form.frontend_host}
              onChange={(e) => setForm({ ...form, frontend_host: e.target.value.toLowerCase() })}
              className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"
              placeholder="www.spmhr.lk"
            />
          </label>
          <label className="block text-sm">
            Organization group
            <input
              value={form.org_group}
              onChange={(e) => setForm({ ...form, org_group: e.target.value.toLowerCase() })}
              className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"
              placeholder="spm"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Companies with the same group appear together in HR. Use <code>spm</code> for SPM-C and SPM Tax. Use a different group (e.g. <code>bsky</code>) so Blue Sky never shows on the SPM login.
            </span>
          </label>
          <label className="block text-sm">
            Google Drive logo link
            <input
              type="text"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              onBlur={() =>
                setForm((prev) => ({ ...prev, logo_url: googleDriveLogoUrl(prev.logo_url) }))
              }
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="Paste Drive share link (Anyone with the link)"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Pick a file to upload to Firebase Storage, or paste a Drive/https link.
              {form.logo_url ? (
                <>
                  {" "}
                  ·{" "}
                  <a href={form.logo_url} target="_blank" rel="noreferrer" className="text-teal-700 underline">
                    preview
                  </a>
                </>
              ) : null}
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Upload className="h-4 w-4" />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                setLogoFile(file || null);
                if (!file) return;
                const theme = await extractThemeFromImageFile(file);
                applyThemeToDocument(theme);
                setForm((prev) => ({
                  ...prev,
                  theme_primary: theme.primary,
                  theme_secondary: theme.secondary,
                  theme_accent: theme.accent,
                }));
                if (await isFirebaseConfigured()) {
                  setUploadingLogo(true);
                  try {
                    const url = await uploadToFirebase(file, "hr/company-logos");
                    setForm((prev) => ({ ...prev, logo_url: url }));
                    setLogoFile(null);
                  } catch (err) {
                    Swal.fire({
                      icon: "error",
                      title: "Firebase upload failed",
                      text: err?.response?.data?.message || err?.message || "Logo could not be uploaded to Firebase.",
                    });
                  } finally {
                    setUploadingLogo(false);
                  }
                } else {
                  Swal.fire({
                    icon: "error",
                    title: "Firebase is required",
                    text: "Configure Firebase Storage. Logos and documents are stored only in Firebase.",
                  });
                  setLogoFile(null);
                }
              }}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {["theme_primary", "theme_secondary", "theme_accent"].map((key) => (
              <label key={key} className="text-xs text-slate-600">
                {key.replace("theme_", "")}
                <input
                  type="color"
                  className="mt-1 h-8 w-full"
                  value={/^#[0-9A-Fa-f]{6}$/.test(form[key] || "") ? form[key] : "#0B4F5C"}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <MapPin className="h-4 w-4 text-teal-700" />
              Mobile fingerprint premises
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.punch_enabled}
                onChange={(e) => setForm({ ...form, punch_enabled: e.target.checked })}
              />
              Enable phone fingerprint punch
            </label>
            <p className="text-xs text-slate-500">
              Only employees in the selected company or departments can punch, and only at this GPS pin. Everyone else sees fingerprint disabled.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="punch_scope"
                  checked={form.punch_scope !== "department"}
                  onChange={() => setForm({ ...form, punch_scope: "company" })}
                />
                Whole company
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="punch_scope"
                  checked={form.punch_scope === "department"}
                  onChange={() => setForm({ ...form, punch_scope: "department" })}
                />
                Selected departments
              </label>
            </div>
            {form.punch_scope === "department" && (
              <div className="max-h-40 overflow-y-auto rounded-lg border bg-white p-2 space-y-1">
                {departments.length === 0 ? (
                  <p className="text-xs text-slate-500">Save/open a company to load departments, or add departments in HR first.</p>
                ) : (
                  departments.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(form.punch_department_ids || []).includes(Number(d.id))}
                        onChange={(e) => {
                          const id = Number(d.id);
                          const ids = new Set((form.punch_department_ids || []).map(Number));
                          if (e.target.checked) ids.add(id);
                          else ids.delete(id);
                          setForm({ ...form, punch_department_ids: [...ids] });
                        }}
                      />
                      {d.name}
                    </label>
                  ))
                )}
              </div>
            )}
            <label className="block text-sm">
              Premises name
              <input
                value={form.punch_office_name}
                onChange={(e) => setForm({ ...form, punch_office_name: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="Head office"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                Latitude
                <input
                  type="number"
                  step="0.000001"
                  value={form.punch_latitude}
                  onChange={(e) => setForm({ ...form, punch_latitude: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Longitude
                <input
                  type="number"
                  step="0.000001"
                  value={form.punch_longitude}
                  onChange={(e) => setForm({ ...form, punch_longitude: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            </div>
            <label className="block text-sm">
              Allowed radius (meters)
              <input
                type="number"
                min="20"
                max="2000"
                value={form.punch_radius}
                onChange={(e) => setForm({ ...form, punch_radius: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <button
              type="button"
              className="w-full rounded-lg border border-teal-200 bg-white py-2 text-sm font-medium text-teal-800 hover:bg-teal-50"
              onClick={() => {
                if (!navigator.geolocation) {
                  Swal.fire({ icon: "error", title: "Location not available on this browser" });
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setForm((prev) => ({
                      ...prev,
                      punch_latitude: pos.coords.latitude.toFixed(6),
                      punch_longitude: pos.coords.longitude.toFixed(6),
                    }));
                  },
                  (err) => Swal.fire({ icon: "error", title: "Could not read GPS", text: err.message })
                );
              }}
            >
              Use this device location as the premises pin
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.punch_require_biometric}
                onChange={(e) => setForm({ ...form, punch_require_biometric: e.target.checked })}
              />
              Require fingerprint / Face ID on the phone
            </label>
          </div>
          <button
            type="submit"
            disabled={saving || uploadingLogo}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving || uploadingLogo ? "Saving…" : "Save company"}
          </button>
        </form>
      </main>
    </div>
  );
}
