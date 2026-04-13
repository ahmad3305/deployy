"use client";

import React, { useEffect, useState } from "react";
import { API_BASE } from "@/app/config";

type Payment = {
  payment_id: number;
  ticket_id?: number;
  seat_number?: string;
  seat_class?: string;
  flight_number?: string;
  passenger_first_name?: string;
  passenger_last_name?: string;
  cargo_id?: number;
  amount: number;
  payment_method: string;
  payment_status: string;
  payment_date: string;
  
  [key: string]: any;
};


function toCsv(rows: Payment[]): string {
  if (!rows.length) return "";
  const keys: string[] = [
    "payment_id", "payment_date", "amount", "payment_method", "payment_status",
    "ticket_id", "seat_number", "seat_class", "flight_number",
    "passenger_first_name", "passenger_last_name", "cargo_id"
  ];
  const escape = (v: any) => ("" + (v ?? "")).replace(/"/g, '""');
  const header = keys.join(",");
  const body = rows.map(row => keys.map(k => `"${escape(row[k])}"`).join(",")).join("\n");
  return header + "\n" + body;
}

const PAYMENT_METHODS = ["Credit Card", "Cash", "Online Transfer"];
const PAYMENT_STATUS = ["Pending", "Completed", "Failed"];
const PAYMENT_TYPE_OPTIONS = [
  { label: "All", value: "" },
  { label: "Ticket", value: "ticket" },
  { label: "Cargo", value: "cargo" }
];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    payment_type: "",
    payment_status: "",
    payment_method: "",
    query: "",
    from: "",
    to: ""
  });

  const [details, setDetails] = useState<Payment | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = [];
        if (filters.payment_status) params.push(`payment_status=${filters.payment_status}`);
        if (filters.from)         params.push(`from=${filters.from}`);
        if (filters.to)           params.push(`to=${filters.to}`);
        
        const url = `${API_BASE}/payments` + (params.length ? "?" + params.join("&") : "");
        const token = localStorage.getItem("token") || "";
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);
        let rows: Payment[] = json.data || [];
        
        if (filters.payment_type === "ticket") rows = rows.filter(p => p.ticket_id);
        if (filters.payment_type === "cargo") rows = rows.filter(p => p.cargo_id);
        if (filters.payment_method) rows = rows.filter(p => p.payment_method === filters.payment_method);
        if (filters.query) {
          const q = filters.query.toLowerCase();
          rows = rows.filter(p =>
            (p.payment_id + "").includes(q) ||
            (p.ticket_id && (p.ticket_id + "").includes(q)) ||
            (p.cargo_id && (p.cargo_id + "").includes(q)) ||
            ((p.passenger_first_name + " " + p.passenger_last_name).toLowerCase().includes(q)) ||
            (p.flight_number || "").toLowerCase().includes(q)
          );
        }
        // Date range filtering (the backend does not support from/to)
        if (filters.from)
          rows = rows.filter(p => p.payment_date && p.payment_date >= filters.from);
        if (filters.to)
          rows = rows.filter(p => p.payment_date && p.payment_date <= filters.to + "T23:59:59");
        setPayments(rows);
      } catch (e: any) {
        setError(e?.message || "Failed to load payments");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [
    filters.payment_type,
    filters.payment_status,
    filters.payment_method,
    filters.query,
    filters.from,
    filters.to,
  ]);

  function handleExportCSV() {
    const csv = toCsv(payments);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "payments.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Totals calculation
  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <div style={styles.headerBar}>
          <div style={styles.title}>All Payments</div>
          <div>
            <button style={styles.exportBtn} onClick={handleExportCSV}>Export CSV</button>
          </div>
        </div>
        <div style={styles.card}>
          {/* Filters */}
          <div style={styles.filterBar}>
            <select
              style={styles.input}
              value={filters.payment_type}
              onChange={e => setFilters(f => ({ ...f, payment_type: e.target.value }))}
            >
              {PAYMENT_TYPE_OPTIONS.map(op => (
                <option value={op.value} key={op.value}>{op.label}</option>
              ))}
            </select>
            <select
              style={styles.input}
              value={filters.payment_method}
              onChange={e => setFilters(f => ({ ...f, payment_method: e.target.value }))}
            >
              <option value="">All Methods</option>
              {PAYMENT_METHODS.map(m => <option value={m} key={m}>{m}</option>)}
            </select>
            <select
              style={styles.input}
              value={filters.payment_status}
              onChange={e => setFilters(f => ({ ...f, payment_status: e.target.value }))}
            >
              <option value="">All Status</option>
              {PAYMENT_STATUS.map(st => <option value={st} key={st}>{st}</option>)}
            </select>
            <input
              style={styles.input}
              type="date"
              value={filters.from}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
              placeholder="From"
            />
            <input
              style={styles.input}
              type="date"
              value={filters.to}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
              placeholder="To"
            />
            <input
              style={styles.input}
              placeholder="Search..."
              value={filters.query}
              onChange={e => setFilters(f => ({ ...f, query: e.target.value }))}
            />
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <div style={{ paddingBottom: 10, color: "#c7e2ff", fontWeight: 500 }}>
            Total Payments: {payments.length} &nbsp;|&nbsp; Total Amount: <b>${totalAmount.toFixed(2)}</b>
          </div>
          {loading ? (
            <div style={styles.loading}>Loading payments...</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Ticket / Cargo</th>
                  <th style={styles.th}>Method</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Payer</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#fca5a5", padding: 16 }}>
                      No payments found.
                    </td>
                  </tr>
                ) : (
                  payments.map((pay, i) => (
                    <tr
                      key={pay.payment_id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setDetails(pay)}
                    >
                      <td style={styles.td}>{pay.payment_id}</td>
                      <td style={styles.td}>{pay.payment_date?.replace("T", " ").slice(0, 16)}</td>
                      <td style={styles.td}>${Number(pay.amount).toFixed(2)}</td>
                      <td style={styles.td}>
                        {pay.ticket_id ? "Ticket" : pay.cargo_id ? "Cargo" : "-"}
                      </td>
                      <td style={styles.td}>
                        {pay.ticket_id
                          ? `T#${pay.ticket_id}` +
                            (pay.flight_number ? ` (${pay.flight_number})` : "")
                          : pay.cargo_id
                          ? `C#${pay.cargo_id}`
                          : "-"}
                      </td>
                      <td style={styles.td}>{pay.payment_method}</td>
                      <td style={styles.td}>
                        <span style={{
                          color:
                            pay.payment_status === "Completed" ? "#34e36b" :
                            pay.payment_status === "Pending"   ? "#60a5fa" :
                            "#f87171"
                        }}>
                          {pay.payment_status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {pay.passenger_first_name ? `${pay.passenger_first_name} ${pay.passenger_last_name}` : "---"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        {details &&
          <div style={styles.detailsModal} onClick={() => setDetails(null)}>
            <div style={styles.detailsModalInner} onClick={e => e.stopPropagation()}>
              <h3 style={{ ...styles.title, marginBottom: 5 }}>Payment #{details.payment_id} Details</h3>
              <div style={{ color: "#d8eefd" }}>
                <b>Amount:</b> ${Number(details.amount).toFixed(2)}<br />
                <b>Status:</b> {details.payment_status}<br />
                <b>Date:</b> {details.payment_date?.replace("T", " ").slice(0, 16)}<br />
                <b>Method:</b> {details.payment_method}<br />
                <b>Type:</b> {details.ticket_id ? "Ticket" : details.cargo_id ? "Cargo" : "---"}<br />
                {details.ticket_id && (
                  <>
                    <b>Ticket:</b> #{details.ticket_id} ({details.flight_number || "---"})<br />
                    <b>Passenger:</b> {details.passenger_first_name} {details.passenger_last_name}<br />
                    <b>Seat:</b> {details.seat_number} ({details.seat_class})<br />
                  </>
                )}
                {details.cargo_id && (
                  <>
                    <b>Cargo:</b> #{details.cargo_id}<br />
                  </>
                )}
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setDetails(null)}>Close</button>
            </div>
          </div>
        }
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: { minHeight: "100vh", width: "100vw", background: "linear-gradient(140deg, #1e293b 70%, #2563eb 110%)", color: "#e6eefb", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif", padding: 0 },
  shell: { maxWidth: 1200, margin: "0 auto", padding: "45px 18px 60px 18px", minHeight: "100vh" },
  headerBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 27, fontWeight: 800, color: "#60a5fa", marginBottom: 0, letterSpacing: 0.5, background: "none" },
  exportBtn: { padding: "10px 22px", background: "linear-gradient(90deg,#2563eb 79%, #0ea5e9)", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", boxShadow: "0 2px 8px #2563eb33" },
  card: { background: "linear-gradient(110deg,#111827 70%, #1d4ed822 100%)", borderRadius: 15, boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33", border: "1.3px solid #2563eb26", marginBottom: 21, padding: "29px 25px 24px 25px" },
  filterBar: { display: "flex", gap: 14, marginBottom: 12 },
  input: { background: "#1e293b", border: "1.2px solid #2563eb39", borderRadius: 7, color: "#e6eefb", fontSize: 16, padding: "7px 12px", outline: "none" },
  error: { background: "#3f1d1d", color: "#fecaca", fontWeight: 600, padding: "14px 24px", borderRadius: 8, border: "1.5px solid #f87171", margin: "16px 0 8px", fontSize: 16, textAlign: "center" },
  loading: { color: "#93c5fd", fontSize: 18, padding: 23, textAlign: "center", fontWeight: 500 },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 7, fontSize: 15.5 },
  th: { textAlign: "left", color: "#9dc3fa", fontWeight: 700, padding: "10px 8px", borderBottom: "1.5px solid #2563eb32" },
  td: { padding: "9px 8px", borderBottom: "1px solid #2563eb21" },
  detailsModal: { position: "fixed", left: 0, top: 0, width: "100vw", height: "100dvh", background: "#111827cc", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" },
  detailsModalInner: { background: "#182952", borderRadius: 12, boxShadow: "0 8px 36px #1e293ba8", padding: "30px 28px 22px 30px", minWidth: 350, color: "#e6eefb", position: "relative", border: "2px solid #2563eb48" },
  modalCloseBtn: { padding: "9px 20px", background: "#0ea5e9", fontWeight: 700, color: "#fff", borderRadius: 8, border: "none", fontSize: 16, marginTop: 25, cursor: "pointer" },
};

