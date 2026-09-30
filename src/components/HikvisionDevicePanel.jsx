import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import hikvisionService from "@services/hikvisionService";

const emptyForm = {
  name: "",
  model: "DS-K1T320EFWX",
  serial_number: "",
  ip_address: "",
  port: 80,
  username: "admin",
  password: "",
  company_id: "",
  is_active: true,
  webhook_enabled: true,
  polling_enabled: true,
};

export default function HikvisionDevicePanel({ companies = [] }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expanded, setExpanded] = useState(false);
  const [bridgeSyncs, setBridgeSyncs] = useState({});

  const loadBridgeSyncs = async (list) => {
    const cloud = (list || []).filter((d) => !d.lan_mode);
    const entries = await Promise.all(
      cloud.map(async (d) => {
        try {
          return [d.id, await hikvisionService.getSyncRequests(d.id)];
        } catch {
          return [d.id, null];
        }
      })
    );
    setBridgeSyncs(Object.fromEntries(entries));
  };

  const loadDevices = async () => {
    setLoading(true);
    try {
      const data = await hikvisionService.listDevices();
      setDevices(data);
      loadBridgeSyncs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) loadDevices();
  }, [expanded]);

  const syncInProgress = Object.values(bridgeSyncs).some((s) =>
    (s?.data || []).some((r) => r.status === "pending" || r.status === "running")
  );

  useEffect(() => {
    if (!expanded || !syncInProgress) return undefined;
    const timer = setInterval(() => loadBridgeSyncs(devices), 15000);
    return () => clearInterval(timer);
  }, [expanded, syncInProgress, devices]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.ip_address || !form.password) {
      Swal.fire({ icon: "warning", title: "Missing fields", text: "Name, IP and password are required." });
      return;
    }

    try {
      await hikvisionService.createDevice({
        ...form,
        company_id: form.company_id || null,
        port: Number(form.port) || 80,
      });
      Swal.fire({ icon: "success", title: "Device added", timer: 1500, showConfirmButton: false });
      setForm(emptyForm);
      setShowForm(false);
      loadDevices();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Save failed", text: err.response?.data?.message || err.message });
    }
  };

  const runAction = async (label, fn) => {
    try {
      const res = await fn();
      const detail =
        res?.data?.message ||
        res?.message ||
        (res?.data ? `Imported ${res.data.imported ?? 0}, skipped ${res.data.skipped ?? 0}` : "Done");
      Swal.fire({ icon: "success", title: label, text: detail });
      loadDevices();
    } catch (err) {
      const data = err.response?.data;
      Swal.fire({
        icon: "error",
        title: label + " failed",
        html: `<p>${data?.message || err.message}</p>${
          data?.punches_url || data?.webhook_url
            ? `<p class="text-sm mt-2 break-all">Punches URL:<br><code>${
                data.punches_url || data.webhook_url
              }</code></p>`
            : ""
        }`,
      });
    }
  };

  const toDateInput = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const syncWithDateRange = async (deviceId) => {
    const today = toDateInput(new Date());
    const weekAgo = toDateInput(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const monthAgo = toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const result = await Swal.fire({
      title: "Sync attendance range",
      width: 440,
      html: `
        <div class="text-left space-y-3 px-1">
          <p class="text-sm text-slate-600">Pull fingerprint punches from the device for the dates below (missed days after offline PC).</p>
          <div>
            <label for="hv-sync-from" class="block text-xs font-semibold text-slate-600 mb-1">From</label>
            <input id="hv-sync-from" type="date" class="swal2-input m-0 w-full" value="${weekAgo}" max="${today}" />
          </div>
          <div>
            <label for="hv-sync-to" class="block text-xs font-semibold text-slate-600 mb-1">To</label>
            <input id="hv-sync-to" type="date" class="swal2-input m-0 w-full" value="${today}" max="${today}" />
          </div>
          <div class="flex flex-wrap gap-2 pt-1">
            <button type="button" id="hv-preset-7" class="px-2 py-1 text-xs rounded bg-slate-100 text-slate-800">Last 7 days</button>
            <button type="button" id="hv-preset-30" class="px-2 py-1 text-xs rounded bg-slate-100 text-slate-800">Last 30 days</button>
          </div>
          <p class="text-xs text-slate-500">Max about 30 days per sync. Duplicates are skipped safely.</p>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Sync Now",
      cancelButtonText: "Cancel",
      didOpen: () => {
        const fromEl = document.getElementById("hv-sync-from");
        const toEl = document.getElementById("hv-sync-to");
        document.getElementById("hv-preset-7")?.addEventListener("click", () => {
          if (fromEl) fromEl.value = weekAgo;
          if (toEl) toEl.value = today;
        });
        document.getElementById("hv-preset-30")?.addEventListener("click", () => {
          if (fromEl) fromEl.value = monthAgo;
          if (toEl) toEl.value = today;
        });
      },
      preConfirm: () => {
        const from_date = document.getElementById("hv-sync-from")?.value;
        const to_date = document.getElementById("hv-sync-to")?.value;
        if (!from_date || !to_date) {
          Swal.showValidationMessage("Both From and To dates are required");
          return false;
        }
        if (from_date > to_date) {
          Swal.showValidationMessage("From date must be on or before To date");
          return false;
        }
        return { from_date, to_date };
      },
    });

    if (!result.isConfirmed || !result.value) return;

    try {
      const res = await hikvisionService.syncNow(deviceId, result.value);
      if (res?.data?.queued) {
        Swal.fire({
          icon: res.data.agent_online ? "success" : "warning",
          title: res.data.agent_online ? "Sync sent to office PC" : "Sync queued",
          text: res.message,
        });
        loadBridgeSyncs(devices);
        return;
      }
      Swal.fire({
        icon: "success",
        title: "Sync",
        text: res?.message || `Imported ${res?.data?.imported ?? 0}, skipped ${res?.data?.skipped ?? 0}`,
      });
      loadDevices();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Sync failed", text: err.response?.data?.message || err.message });
    }
  };

  const syncStatusStyle = {
    pending: "bg-amber-100 text-amber-800",
    running: "bg-blue-100 text-blue-800",
    done: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  const showAgentConfig = async (deviceId) => {
    try {
      const cfg = await hikvisionService.getAgentConfig(deviceId);
      const punches = cfg?.cloud?.punches_url || "";
      const webhook = cfg?.cloud?.webhook_url || "";
      await Swal.fire({
        icon: "info",
        title: "Office bridge / Agent config",
        width: 640,
        html: `
          <div class="text-left text-sm space-y-2">
            <p><b>Mode:</b> ${cfg?.lan_mode ? "Office LAN (direct Sync OK)" : "Cloud — use hikvision-bridge"}</p>
            <p><b>Punches URL</b> (put in bridge .env as CLOUD_PUNCHES_URL):</p>
            <code class="block break-all bg-slate-100 p-2 rounded text-xs">${punches}</code>
            <p><b>Webhook URL:</b></p>
            <code class="block break-all bg-slate-100 p-2 rounded text-xs">${webhook}</code>
            <p class="mt-2">Device IP: <b>${cfg?.device?.ip}:${cfg?.device?.port}</b> · User: <b>${cfg?.device?.username}</b></p>
            <p class="text-xs text-slate-600">Copy <code>sohan_hr_system_backend/scripts/hikvision-bridge</code> to an always-on office PC. Save the downloaded file there as <code>.env</code>, then <code>npm install</code> and <code>npm start</code> or <code>install-autostart.bat</code>.</p>
          </div>
        `,
        confirmButtonText: "Download office .env",
        showDenyButton: true,
        denyButtonText: "Copy Punches URL",
        showCancelButton: true,
        cancelButtonText: "Close",
      }).then((r) => {
        if (r.isConfirmed) {
          const envText = [
            `DEVICE_IP=${cfg?.device?.ip || ""}`,
            `DEVICE_PORT=${cfg?.device?.port || 80}`,
            `DEVICE_USER=${cfg?.device?.username || "admin"}`,
            `DEVICE_PASSWORD=${cfg?.device?.password || ""}`,
            `CLOUD_PUNCHES_URL=${punches}`,
            `CLOUD_BASE_URL=${cfg?.cloud?.public_api_url || ""}`,
            cfg?.cloud?.secret_header ? `HIKVISION_SECRET=${cfg.cloud.secret_header}` : "",
            "POLL_SECONDS=60",
            "LOOKBACK_MINUTES=180",
          ].filter(Boolean).join("\n");
          const blob = new Blob([envText], { type: "text/plain" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "hikvision-bridge.env";
          a.click();
        }
        if (r.isDenied && punches && navigator.clipboard) {
          navigator.clipboard.writeText(punches);
        }
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Agent config failed", text: err.response?.data?.message || err.message });
    }
  };

  return (
    <div className="mb-6 border border-indigo-200 rounded-xl overflow-hidden bg-indigo-50/40">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-600 text-white font-semibold"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>Hikvision Fingerprint Device Sync (DS-K1T320)</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          <p className="text-sm text-slate-600">
            <b>Sync Now</b> opens a date picker to re-read fingerprint punches for missed days (default last 7 days).
            On cloud HR the request is sent to the office <b>hikvision-bridge</b> PC, which must be on. Device user ID must match{" "}
            <strong>Attendance Employee No</strong>.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cancel" : "Add Device"}
            </button>
            <button
              type="button"
              className="px-3 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-medium"
              onClick={loadDevices}
              disabled={loading}
            >
              Refresh
            </button>
            <button
              type="button"
              className="px-3 py-2 bg-amber-100 text-amber-900 rounded-lg text-sm font-medium"
              onClick={async () => {
                try {
                  const g = await hikvisionService.getSetupGuide();
                  Swal.fire({
                    icon: "info",
                    title: "Setup guide",
                    width: 640,
                    html: `<ol class="text-left text-sm list-decimal pl-5 space-y-2">${(g.steps || [])
                      .map((s) => `<li><b>${s.title}</b><br/>${s.detail}</li>`)
                      .join("")}</ol>`,
                  });
                } catch (e) {
                  Swal.fire({ icon: "error", title: "Failed", text: e.message });
                }
              }}
            >
              Setup Guide
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white rounded-lg border">
              {[
                ["name", "Device name", "text"],
                ["model", "Model (DS-K1T320EFWX)", "text"],
                ["serial_number", "Serial (GG4907842)", "text"],
                ["ip_address", "IP address", "text"],
                ["port", "Port", "number"],
                ["username", "Username", "text"],
                ["password", "Password", "password"],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                  <input
                    type={type}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Company</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                >
                  <option value="">All companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold">
                  Save Device
                </button>
              </div>
            </form>
          )}

          {loading && <p className="text-sm text-slate-500">Loading devices...</p>}

          {!loading && devices.length === 0 && (
            <p className="text-sm text-slate-500">No devices configured yet.</p>
          )}

          {devices.map((d) => (
            <div key={d.id} className="p-4 bg-white border rounded-lg space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.model} · {d.ip_address}:{d.port}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${d.is_active ? "bg-green-100 text-green-800" : "bg-gray-100"}`}>
                  {d.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <p className="text-xs break-all text-slate-600">
                <span className="font-semibold">Punches URL:</span> {d.punches_url || "—"}
              </p>
              <p className="text-xs break-all text-slate-500">
                <span className="font-semibold">Webhook:</span> {d.webhook_url}
              </p>
              <p className="text-xs text-slate-600">{d.cloud_note}</p>
              {d.last_sync_at && (
                <p className="text-xs text-slate-500">Last sync: {new Date(d.last_sync_at).toLocaleString()}</p>
              )}
              {d.last_error && (
                <p className="text-xs text-red-600">Last error: {d.last_error}</p>
              )}

              {!d.lan_mode && bridgeSyncs[d.id] && (
                <div className="text-xs space-y-1 border-t pt-2">
                  <p className={bridgeSyncs[d.id].agent_online ? "text-green-700" : "text-amber-700"}>
                    <span className="font-semibold">Office PC:</span>{" "}
                    {bridgeSyncs[d.id].agent_online ? "Online" : "Not connected"}
                    {bridgeSyncs[d.id].agent_last_seen_at &&
                      ` (last seen ${new Date(bridgeSyncs[d.id].agent_last_seen_at).toLocaleString()})`}
                  </p>
                  {(bridgeSyncs[d.id].data || []).slice(0, 5).map((r) => (
                    <div key={r.id} className="flex flex-wrap items-start gap-2">
                      <span className={`px-1.5 py-0.5 rounded capitalize ${syncStatusStyle[r.status] || "bg-gray-100"}`}>
                        {r.status}
                      </span>
                      <span className="text-slate-700">
                        {r.from_date === r.to_date ? r.from_date : `${r.from_date} → ${r.to_date}`}
                      </span>
                      {r.message && <span className="text-slate-500">{r.message}</span>}
                      {(r.errors || []).length > 0 && (
                        <span className="text-red-600 w-full">{r.errors.slice(0, 3).join("; ")}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                  onClick={() => runAction("Connection", () => hikvisionService.testConnection(d.id))}
                >
                  Test
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-emerald-100 text-emerald-800 rounded"
                  onClick={() => syncWithDateRange(d.id)}
                >
                  Sync Now
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded"
                  onClick={() => showAgentConfig(d.id)}
                >
                  Agent config
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded"
                  onClick={() => runAction("Webhook configured", () => hikvisionService.configureWebhook(d.id))}
                >
                  Configure Webhook
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded"
                  onClick={async () => {
                    const ok = await Swal.fire({
                      icon: "warning",
                      title: "Remove device?",
                      showCancelButton: true,
                    });
                    if (ok.isConfirmed) {
                      await hikvisionService.deleteDevice(d.id);
                      loadDevices();
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
