import axios from "@utils/axios";

let brandedCompanyId = null;
let brandedCompany = null;
let brandingPromise = null;

export function setBrandedCompany(row) {
  brandedCompany = row || null;
  brandedCompanyId = row?.id != null ? Number(row.id) : null;
}

export function getBrandedCompanyId() {
  return brandedCompanyId;
}

function groupKey(row) {
  return String(row?.org_group || "")
    .trim()
    .toLowerCase();
}

export function currentAppHost() {
  if (typeof window === "undefined") return "";
  return window.location.hostname.replace(/^www\./i, "").toLowerCase();
}

export function normalizeCompanyHost(host) {
  return String(host || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

export function isLocalAppHost(host = currentAppHost()) {
  return ["localhost", "127.0.0.1", "::1"].includes(host);
}

function tenantSlugFromPath() {
  if (typeof window === "undefined") return "";
  const m = window.location.pathname.match(/^\/c\/([a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : "";
}

export async function ensureBrandedCompany() {
  if (brandedCompanyId) return brandedCompanyId;
  if (!brandingPromise) {
    brandingPromise = axios
      .get("/public/branding", {
        params: {
          host: currentAppHost(),
          slug: tenantSlugFromPath() || undefined,
        },
      })
      .then(({ data }) => {
        setBrandedCompany(data?.data || null);
        return brandedCompanyId;
      })
      .catch(() => brandedCompanyId)
      .finally(() => {
        brandingPromise = null;
      });
  }
  return brandingPromise;
}

export function companyListQueryParams() {
  const host = currentAppHost();
  const params = { host };
  const slug = tenantSlugFromPath();
  if (slug) params.slug = slug;
  return params;
}

function isSharedSpmPortal(host = currentAppHost()) {
  return (
    isLocalAppHost(host) ||
    host.includes("spmhr") ||
    host.includes("apispmhr") ||
    host.includes("sunfohr") ||
    host.includes("apisunfohr") ||
    host.includes("bdchr") ||
    host.includes("apibdchr") ||
    host.includes("hilburn") ||
    host.includes("apihilburn") ||
    host.includes("jcfood") ||
    host.includes("apijcfood") ||
    host.includes("jayseafood") ||
    host.includes("urbanhr") ||
    host.includes("apiurbanhr") ||
    host.includes("svahr") ||
    host.includes("apisvahr")
  );
}

/** Companies that belong on this login URL / organization group. */
export function companiesForCurrentUrl(companies) {
  const list = Array.isArray(companies) ? companies : [];
  const host = currentAppHost();

  if (isSharedSpmPortal(host)) {
    return list;
  }

  const onThisUrl = list.filter((row) => normalizeCompanyHost(row.frontend_host) === host);
  if (onThisUrl.length) {
    const group = groupKey(onThisUrl[0]);
    if (group) {
      const grouped = list.filter((row) => groupKey(row) === group);
      if (grouped.length) {
        return grouped;
      }
    }
    return onThisUrl;
  }

  return list;
}

export function isDedicatedCompanyUrl(companies) {
  return companiesForCurrentUrl(companies).length === 1;
}

export function scopeOrgRecords(companies, departments = [], subDepartments = []) {
  const ids = new Set((companies || []).map((row) => Number(row.id)));
  const depts = (departments || []).filter((row) => ids.has(Number(row.company_id)));
  const deptIds = new Set(depts.map((row) => Number(row.id)));
  const subs = (subDepartments || []).filter((row) => deptIds.has(Number(row.department_id)));
  return { companies, departments: depts, subDepartments: subs };
}
