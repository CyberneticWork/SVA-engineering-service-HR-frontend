import React, { useState } from "react";
import { 
  FileSpreadsheet, Building2, Download, Eye,
  FileText, FileBarChart, Loader2, FileCheck, Wallet, CreditCard, Scissors, Gift, Clock, Banknote, X
} from "lucide-react";
import Swal from "sweetalert2";
import ReportService from "../../services/ReportService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const NOTES_ARRAY = [5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1];

const Reports = () => {
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [reportData, setReportData] = useState([]);
  const [scheduleReportData, setScheduleReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [showCoinageModal, setShowCoinageModal] = useState(false);
  const [coinageFormat, setCoinageFormat] = useState("pdf");
  const [editableCoinage, setEditableCoinage] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewReport, setPreviewReport] = useState(null);

  const months = [
    { value: "01", label: "January" }, { value: "02", label: "February" },
    { value: "03", label: "March" }, { value: "04", label: "April" },
    { value: "05", label: "May" }, { value: "06", label: "June" },
    { value: "07", label: "July" }, { value: "08", label: "August" },
    { value: "09", label: "September" }, { value: "10", label: "October" },
    { value: "11", label: "November" }, { value: "12", label: "December" },
  ];
  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  const handleFetchData = async () => {
    try {
      setIsLoading(true);
      const [data, scheduleData] = await Promise.all([
        ReportService.getMonthlyReportData(selectedMonth, selectedYear),
        ReportService.getScheduleReportData(selectedMonth, selectedYear),
      ]);
      setReportData(data);
      setScheduleReportData(scheduleData);
      if(data.length === 0) Swal.fire("No Data", "No salaries processed for this month.", "info");
      else Swal.fire({ icon: "success", title: "Data Loaded", text: `Ready to generate reports for ${data.length} employees.`, timer: 1500, showConfirmButton: false });
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      Swal.fire("Error", `Failed: ${JSON.stringify(errorMsg)}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const generateMasterData = () => {
    const uniqueAllowances = new Set(); const uniqueBonuses = new Set(); const uniqueDeductions = new Set();
    reportData.forEach(e => {
       (e.raw_allowances || []).forEach(a => uniqueAllowances.add(a.name));
       (e.raw_bonuses || []).forEach(b => uniqueBonuses.add(b.name));
       (e.raw_deductions || []).forEach(d => uniqueDeductions.add(d.name));
    });
    const allowHeaders = Array.from(uniqueAllowances); const bonusHeaders = Array.from(uniqueBonuses); const dedHeaders = Array.from(uniqueDeductions);
    const headers = ["Emp No", "Name", "Basic Salary", ...allowHeaders, ...bonusHeaders, "Gross Salary", "EPF 8%", "No Pay", "Loan Deductions", ...dedHeaders, "Total Deductions", "Net Pay", "Employer EPF 12%", "ETF 3%"];
    let rows = []; let totals = new Array(headers.length).fill(0);

    reportData.forEach(e => {
      const basic = Number(e.basic_salary) || 0;
      const gross = Number(e.gross_salary) || 0;
      const totalDed = Number(e.total_deductions) || 0;
      const net = Number(e.net_salary) || 0;
      let row = [e.emp_no, e.name, basic.toFixed(2)]; totals[2] += basic;
      allowHeaders.forEach((h, i) => { let amt = ((e.raw_allowances || []).find(a => a.name === h) || {}).amount || 0; row.push(parseFloat(amt).toFixed(2)); totals[3 + i] += parseFloat(amt); });
      let bonusOffset = 3 + allowHeaders.length;
      bonusHeaders.forEach((h, i) => { let amt = ((e.raw_bonuses || []).find(b => b.name === h) || {}).amount || 0; row.push(parseFloat(amt).toFixed(2)); totals[bonusOffset + i] += parseFloat(amt); });
      let grossIdx = bonusOffset + bonusHeaders.length;
      row.push(gross.toFixed(2)); totals[grossIdx] += gross;
      let epf8 = Number(e.epf_8) || 0; let noPay = Number(e.no_pay_amount) || 0; let loan = (Number(e.loan_installment) || 0) + (Number(e.loan_interest) || 0);
      row.push(epf8.toFixed(2)); totals[grossIdx + 1] += epf8; row.push(noPay.toFixed(2)); totals[grossIdx + 2] += noPay; row.push(loan.toFixed(2)); totals[grossIdx + 3] += loan;
      let dedOffset = grossIdx + 4;
      dedHeaders.forEach((h, i) => { let amt = ((e.raw_deductions || []).find(d => d.name === h) || {}).amount || 0; row.push(parseFloat(amt).toFixed(2)); totals[dedOffset + i] += parseFloat(amt); });
      let totDedIdx = dedOffset + dedHeaders.length;
      row.push(totalDed.toFixed(2)); totals[totDedIdx] += totalDed;
      let netIdx = totDedIdx + 1;
      row.push(net.toFixed(2)); totals[netIdx] += net;
      let epf12 = Number(e.epf_12) || 0; let etf3 = Number(e.etf_3) || 0;
      row.push(epf12.toFixed(2)); totals[netIdx + 1] += epf12; row.push(etf3.toFixed(2)); totals[netIdx + 2] += etf3;
      rows.push(row);
    });

    let footer = ["", "TOTAL"];
    for (let i = 2; i < totals.length; i++) { footer.push(totals[i].toFixed(2)); }
    return { headers, rows, footer };
  };

  // 🔥 මෙතනින් තමයි හරියටම Bank Amount එක ගන්නේ
  const generateBankData = () => {
    let rows = []; let totalAmount = 0;
    reportData.forEach(e => {
      let amount = e.bank_amount || 0;
      if (amount > 0) { 
        rows.push([e.emp_no, e.name, e.bank, e.branch, e.account, amount.toFixed(2)]); 
        totalAmount += amount; 
      }
    });
    return { headers: ["Emp No", "Name", "Bank", "Branch", "Account No", "Bank Net Amount"], rows, footer: ["", "", "", "", "TOTAL AMOUNT", totalAmount.toFixed(2)] };
  };

  const generateEPFData = () => {
    let rows = []; let tBase = 0, tEmp8 = 0, tEmp12 = 0, tEpf20 = 0, tEtf3 = 0;
    reportData.forEach(e => {
      const epf8 = Number(e.epf_8) || 0;
      const epf12 = Number(e.epf_12) || 0;
      const etf3 = Number(e.etf_3) || 0;
      const epfBase = Number(e.salary_for_epf ?? e.epf_base) || 0;
      if (epf8 + epf12 + etf3 > 0) {
        let totalEpf = epf8 + epf12;
        rows.push([
          e.epf_member_no || e.emp_no,
          e.name,
          epfBase.toFixed(2),
          epf12.toFixed(2),
          epf8.toFixed(2),
          totalEpf.toFixed(2),
          etf3.toFixed(2)
        ]);
        tBase += epfBase; tEmp12 += epf12; tEmp8 += epf8; tEpf20 += totalEpf; tEtf3 += etf3;
      }
    });
    return { headers: ["Member No", "Name", "Salary for EPF", "Employer 12%", "Employee 8%", "Total EPF 20%", "ETF 3%"], rows, footer: ["", "TOTAL", tBase.toFixed(2), tEmp12.toFixed(2), tEmp8.toFixed(2), tEpf20.toFixed(2), tEtf3.toFixed(2)] };
  };

  const generateAllowancesOnlyData = () => {
    const uniqueNames = new Set();
    reportData.forEach(e => { (e.raw_allowances || []).forEach(a => uniqueNames.add(a.name)); });
    const dynamicHeaders = Array.from(uniqueNames);
    let rows = []; let columnTotals = new Array(dynamicHeaders.length).fill(0); let tTotal = 0;
    reportData.forEach(e => {
      let row = [e.emp_no, e.name]; let empTotalAdditions = 0;
      dynamicHeaders.forEach((headerName, index) => {
        let item = (e.raw_allowances || []).find(a => a.name === headerName);
        let amount = item ? parseFloat(item.amount) : 0;
        row.push(amount.toFixed(2)); columnTotals[index] += amount; empTotalAdditions += amount;
      });
      if(empTotalAdditions > 0) { row.push(empTotalAdditions.toFixed(2)); tTotal += empTotalAdditions; rows.push(row); }
    });
    if (dynamicHeaders.length === 0) return { headers: ["Emp No", "Name", "No Allowances"], rows: [], footer: [] };
    return { headers: ["Emp No", "Name", ...dynamicHeaders, "Total Allowances"], rows, footer: ["", "TOTAL", ...columnTotals.map(t => t.toFixed(2)), tTotal.toFixed(2)] };
  };

  const generateBonusesOnlyData = () => {
    const uniqueNames = new Set();
    reportData.forEach(e => { (e.raw_bonuses || []).forEach(b => uniqueNames.add(b.name)); });
    const dynamicHeaders = Array.from(uniqueNames);
    let rows = []; let columnTotals = new Array(dynamicHeaders.length).fill(0); let tTotal = 0;
    reportData.forEach(e => {
      let row = [e.emp_no, e.name]; let empTotalBonuses = 0;
      dynamicHeaders.forEach((headerName, index) => {
        let item = (e.raw_bonuses || []).find(b => b.name === headerName);
        let amount = item ? parseFloat(item.amount) : 0;
        row.push(amount.toFixed(2)); columnTotals[index] += amount; empTotalBonuses += amount;
      });
      if (empTotalBonuses > 0) { row.push(empTotalBonuses.toFixed(2)); rows.push(row); tTotal += empTotalBonuses; }
    });
    if (dynamicHeaders.length === 0) return { headers: ["Emp No", "Name", "No Bonuses Found"], rows: [], footer: [] };
    return { headers: ["Emp No", "Name", ...dynamicHeaders, "Total Bonuses"], rows, footer: ["", "TOTAL", ...columnTotals.map(t => t.toFixed(2)), tTotal.toFixed(2)] };
  };

  const generateDynamicDeductionsData = () => {
    const uniqueNames = new Set();
    reportData.forEach(e => { (e.raw_deductions || []).forEach(d => uniqueNames.add(d.name)); });
    const dynamicHeaders = Array.from(uniqueNames);
    let rows = []; let columnTotals = new Array(dynamicHeaders.length).fill(0); let tTotal = 0;
    reportData.forEach(e => {
      let row = [e.emp_no, e.name]; let empTotalDeds = 0;
      dynamicHeaders.forEach((headerName, index) => {
        let item = (e.raw_deductions || []).find(d => d.name === headerName);
        let amount = item ? parseFloat(item.amount) : 0;
        row.push(amount.toFixed(2)); columnTotals[index] += amount; empTotalDeds += amount;
      });
      if (empTotalDeds > 0) { row.push(empTotalDeds.toFixed(2)); rows.push(row); tTotal += empTotalDeds; }
    });
    if (dynamicHeaders.length === 0) return { headers: ["Emp No", "Name", "No Custom Deductions"], rows: [], footer: [] };
    return { headers: ["Emp No", "Name", ...dynamicHeaders, "Total Custom Deductions"], rows, footer: ["", "TOTAL", ...columnTotals.map(t => t.toFixed(2)), tTotal.toFixed(2)] };
  };

  const generateLoanData = () => {
    let rows = []; let tAmount = 0, tInst = 0, tInt = 0, tDed = 0, tOut = 0;
    reportData.forEach(e => {
      if (e.loan_amount > 0) {
        let totDed = e.loan_installment + e.loan_interest; let outStanding = Math.max(0, e.loan_amount - e.loan_installment);
        rows.push([e.emp_no, e.name, e.loan_amount.toFixed(2), e.loan_installment.toFixed(2), e.loan_interest.toFixed(2), totDed.toFixed(2), outStanding.toFixed(2)]);
        tAmount += e.loan_amount; tInst += e.loan_installment; tInt += e.loan_interest; tDed += totDed; tOut += outStanding;
      }
    });
    return { headers: ["Emp No", "Name", "Loan Amount", "Installment", "Interest", "Total Deduction", "Balance Outstanding"], rows, footer: ["", "TOTAL", tAmount.toFixed(2), tInst.toFixed(2), tInt.toFixed(2), tDed.toFixed(2), tOut.toFixed(2)] };
  };

  const generateNoPayData = () => {
    let rows = []; let tDays = 0, tAmount = 0;
    reportData.forEach(e => {
      if (e.no_pay_amount > 0 || e.no_pay_days > 0) {
        rows.push([e.emp_no, e.name, e.no_pay_days.toString(), e.no_pay_amount.toFixed(2)]);
        tDays += e.no_pay_days; tAmount += e.no_pay_amount;
      }
    });
    return { headers: ["Emp No", "Name", "No Pay Days", "Deduction Amount"], rows, footer: ["", "TOTAL", tDays.toString(), tAmount.toFixed(2)] };
  };

  const generateOTData = () => {
    let rows = []; let tMornHrs = 0, tMornFees = 0, tNightHrs = 0, tNightFees = 0, tHolHrs = 0, tHolFees = 0, tTotFees = 0;
    reportData.forEach(e => {
      let totFees = (e.ot_morning_fees || 0) + (e.ot_night_fees || 0) + (e.holiday_ot_fees || 0);
      if (totFees > 0) {
        rows.push([e.emp_no, e.name, (e.ot_morning_hours || 0).toFixed(2), (e.ot_morning_fees || 0).toFixed(2), (e.ot_night_hours || 0).toFixed(2), (e.ot_night_fees || 0).toFixed(2), (e.holiday_ot_hours || 0).toFixed(2), (e.holiday_ot_fees || 0).toFixed(2), totFees.toFixed(2)]);
        tMornHrs += (e.ot_morning_hours || 0); tMornFees += (e.ot_morning_fees || 0); tNightHrs += (e.ot_night_hours || 0); tNightFees += (e.ot_night_fees || 0); tHolHrs += (e.holiday_ot_hours || 0); tHolFees += (e.holiday_ot_fees || 0); tTotFees += totFees;
      }
    });
    const headers = ["Emp No", "Name", "Morning OT (Hrs)", "Morning OT (Rs)", "Night OT (Hrs)", "Night OT (Rs)", "Holiday OT (Hrs)", "Holiday OT (Rs)", "Total OT (Rs)"];
    const footer = ["", "TOTAL", tMornHrs.toFixed(2), tMornFees.toFixed(2), tNightHrs.toFixed(2), tNightFees.toFixed(2), tHolHrs.toFixed(2), tHolFees.toFixed(2), tTotFees.toFixed(2)];
    if (rows.length === 0) return { headers: ["Emp No", "Name", "No Overtime Recorded"], rows: [], footer: [] };
    return { headers, rows, footer };
  };

  const fmt = (n) => (Number(n) || 0).toFixed(2);

  const monthLabel = months.find(m => m.value === selectedMonth)?.label || selectedMonth;

  const generateSalaryAllowanceTotalData = () => {
    const headers = [
      "Employee Name", "Date Joined",
      "Salary", "Allowance", "Gross Salary",
      "Nopay (Sch 02)", "Salary Advance (Sch 03)",
      "Loan Installment (Sch 04)", "Loan Interest (Sch 04)",
      "Sports Fund (Sch 05)", "EPF 8% (Sch 06)", "Staff Fund (Sch 07)", "Other Deduction (Sch 08)",
      "Total Deductions", "Net Pay"
    ];
    const totals = new Array(headers.length).fill(0);
    const rows = reportData.map(e => {
      const row = [
        e.name, e.date_joined || "-",
        fmt(e.salary_component), fmt(e.allowance_component), fmt(e.gross_salary),
        fmt(e.no_pay_amount), fmt(e.salary_advance),
        fmt(e.loan_installment), fmt(e.loan_interest),
        fmt(e.sports_fund), fmt(e.epf_8), fmt(e.staff_fund), fmt(e.other_deduction),
        fmt(e.total_report_deductions), fmt(e.total_report_net)
      ];
      [2,3,4,5,6,7,8,9,10,11,12,13,14].forEach(i => { totals[i] += parseFloat(row[i]); });
      return row;
    });
    const footer = ["TOTAL", "", ...totals.slice(2).map(t => t.toFixed(2))];
    return { headers, rows, footer, reportTitle: `Salary & Allowance (Total) — ${monthLabel} ${selectedYear}` };
  };

  const generateSalaryDetailsData = () => {
    const headers = [
      "Employee Name", "EPF Member No.", "Date Joined",
      "Basic Salary (Sch 01)", "Budgetary Allowance (Sch 01)", "Budget Relief Allowance (Sch 01)", "Total Salary",
      "Nopay (Sch 02)", "Salary for EPF",
      "Salary Advance (Sch 03)", "Loan Installment (Sch 04)", "EPF 8% (Sch 06)",
      "Total Deductions", "Net Salary"
    ];
    const totals = new Array(headers.length).fill(0);
    const rows = reportData.map(e => {
      const row = [
        e.name, e.epf_member_no || e.emp_no || "-", e.date_joined || "-",
        fmt(e.base_basic_salary), fmt(e.budgetary_allowance), fmt(e.budget_relief_allowance), fmt(e.total_salary_sch01),
        fmt(e.basic_no_pay), fmt(e.salary_for_epf),
        fmt(e.salary_advance_basic), fmt(e.loan_on_basic),
        fmt(e.epf_8),
        fmt(e.epf_schedule_deductions), fmt(e.epf_schedule_net)
      ];
      [3,4,5,6,7,8,9,10,11,12,13].forEach(i => { totals[i] += parseFloat(row[i]); });
      return row;
    });
    const footer = ["TOTAL", "", "", ...totals.slice(3).map(t => t.toFixed(2))];
    return { headers, rows, footer, reportTitle: `Salary Details (EPF/ETF) — ${monthLabel} ${selectedYear}` };
  };

  const generateAllowanceScheduleData = () => {
    const headers = [
      "Employee Name", "Date Joined",
      "Allowance", "Gross Salary",
      "Nopay (Sch 02)", "Salary Advance (Sch 03)",
      "Loan Installment (Sch 04)", "Loan Interest (Sch 04)",
      "Sports Fund (Sch 05)", "Staff Fund (Sch 07)", "Other Deduction (Sch 08)",
      "Total Deductions", "Net Salary"
    ];
    const totals = new Array(headers.length).fill(0);
    const rows = reportData.map(e => {
      const row = [
        e.name, e.date_joined || "-",
        fmt(e.allowance_component), fmt(e.allowance_gross),
        fmt(e.bonus_no_pay), fmt(e.salary_advance_bonus ?? e.salary_advance),
        fmt(e.loan_on_bonus), fmt(e.loan_interest),
        fmt(e.sports_fund), fmt(e.staff_fund), fmt(e.allowance_other_deductions ?? e.other_deduction),
        fmt(e.allowance_deductions), fmt(e.allowance_net)
      ];
      [2,3,4,5,6,7,8,9,10,11,12].forEach(i => { totals[i] += parseFloat(row[i]); });
      return row;
    });
    const footer = ["TOTAL", "", ...totals.slice(2).map(t => t.toFixed(2))];
    return { headers, rows, footer, reportTitle: `Allowance — ${monthLabel} ${selectedYear}` };
  };

  const buildNoPaySection = (label, salaryKey, daysKey, amountKey) => {
    let subSalary = 0, subDays = 0, subAmount = 0;
    const rows = [];
    reportData.forEach(e => {
      const amount = Number(e[amountKey]) || 0;
      const days = Number(e[daysKey]) || 0;
      if (amount <= 0 && days <= 0) return;
      const salary = Number(e[salaryKey]) || 0;
      rows.push([e.name, fmt(salary), fmt(days), fmt(amount)]);
      subSalary += salary;
      subDays += days;
      subAmount += amount;
    });
    rows.push([`Total for ${label}`, fmt(subSalary), fmt(subDays), fmt(subAmount)]);
    return { rows, subSalary, subDays, subAmount };
  };

  const generateSchedule02NoPayData = () => {
    const headers = ["Employee Name", "Salary", "No of NOPAY days", "Amount"];
    const basic = buildNoPaySection("Basic Salary", "base_basic_salary", "basic_nopay_days", "basic_nopay_amount");
    const salary = buildNoPaySection("Salary", "salary_component", "salary_nopay_days", "salary_nopay_amount");
    const allowance = buildNoPaySection("Allowance", "allowance_component", "allowance_nopay_days", "allowance_nopay_amount");

    const rows = [
      ...basic.rows,
      ...salary.rows,
      ...allowance.rows,
    ];

    const grandDays = basic.subDays + allowance.subDays;
    const grandAmount = basic.subAmount + allowance.subAmount;
    const totalSalary = reportData.reduce((s, e) => s + (Number(e.gross_salary) || 0), 0);
    const footer = ["Grand Total", fmt(basic.subSalary + salary.subSalary + allowance.subSalary), fmt(grandDays), fmt(grandAmount)];

    const summaryHeaders = ["Total Salary", "Total No Pay Days", "Total No Pay", "Difference"];
    const summaryRows = [[fmt(totalSalary), fmt(grandDays), fmt(grandAmount), fmt(totalSalary - grandAmount)]];

    return {
      headers,
      rows,
      footer,
      summaryHeaders,
      summaryRows,
      reportTitle: `Schedule 02 — Nopay — ${monthLabel} ${selectedYear}`,
    };
  };

  const generateSchedule07CumulativeData = () => {
    let employerContribution = 0, totalContribution = 0, paymentsMade = 0;
    const rows = [];

    reportData.forEach(e => {
      const monthly = Number(e.staff_fund_monthly) || 0;
      const ytdContribution = Number(e.staff_fund_ytd_contribution) || 0;
      const ytdPaid = Number(e.staff_fund_ytd_paid) || 0;
      if (monthly <= 0) return;
      employerContribution += monthly;
      totalContribution += ytdContribution;
      paymentsMade += ytdPaid;
      rows.push([
        e.name,
        fmt(monthly),
        fmt(ytdContribution),
        fmt(ytdPaid),
        fmt(ytdContribution - ytdPaid),
      ]);
    });

    const headers = ["Employee Name", "Employer Contribution", "Total Contribution", "Payments Made", "Balance Payable"];
    const footer = [
      "TOTAL",
      fmt(employerContribution),
      fmt(totalContribution),
      fmt(paymentsMade),
      fmt(totalContribution - paymentsMade),
    ];

    return {
      headers,
      rows: rows.length > 0 ? rows : [["—", "0.00", "0.00", "0.00", "0.00"]],
      footer,
      reportTitle: `Schedule 07 — Staff Fund Cumulative — ${monthLabel} ${selectedYear}`,
    };
  };

  const generateSchedule04LoanSummaryData = () => {
    const sch = scheduleReportData?.loan_summary;
    if (!sch) return { headers: ["No Data"], rows: [], footer: [] };

    const rows = (sch.rows || []).map(r => [
      r.employee_name || "",
      r.loan_label || r.loan_id || "",
      r.granted_date || "-",
      fmt(r.granted_amount),
      fmt(r.loan_monthly_deduction),
      fmt(r.loan_total_deduction),
      fmt(r.loan_balance_outstanding),
      fmt(r.interest_monthly_deduction),
      fmt(r.interest_total_deduction),
      fmt(r.interest_balance_outstanding),
    ]);

    const f = sch.footer || {};
    const footer = [
      f.employee_name || "TOTAL", f.loan_label || "",
      f.granted_date || "", fmt(f.granted_amount),
      fmt(f.loan_monthly_deduction), fmt(f.loan_total_deduction), fmt(f.loan_balance_outstanding),
      fmt(f.interest_monthly_deduction), fmt(f.interest_total_deduction), fmt(f.interest_balance_outstanding),
    ];

    const summaryHeaders = ["Available Staff Fund", "Balance Recoverable"];
    const summaryRows = [[
      fmt(sch.summary?.available_staff_fund),
      fmt(sch.summary?.balance_recoverable),
    ]];

    return {
      headers: sch.headers || [
        "Employee Name", "Loan", "Granted Date", "Granted Amount",
        "Loan Monthly Ded.", "Loan Total Ded.", "Loan Balance",
        "Interest Monthly Ded.", "Interest Total Ded.", "Interest Balance",
      ],
      rows,
      footer,
      summaryHeaders,
      summaryRows,
      reportTitle: `Schedule 04 — Loan Summary — ${monthLabel} ${selectedYear}`,
    };
  };

  const generateSchedule04aLoanDetailData = () => {
    const sections = scheduleReportData?.loan_details || [];
    if (sections.length === 0) {
      return {
        headers: ["Month", "Loan Date", "Loan Amount", "Monthly Deduction", "Balance Outstanding", "Interest", "Total Deduction"],
        rows: [["—", "—", "0.00", "0.00", "0.00", "0.00", "0.00"]],
        reportTitle: `Schedule 04(a) — Staff Loan Detail — ${monthLabel} ${selectedYear}`,
        multiSections: [],
      };
    }

    const multiSections = sections.map(sec => ({
      title: `${sec.employee_name} — ${sec.loan_label || sec.loan_id}`,
      headers: sec.headers,
      rows: (sec.rows || []).map(r => [
        r.month, r.loan_date, fmt(r.loan_amount), fmt(r.monthly_deduction),
        fmt(r.balance_outstanding), fmt(r.interest), fmt(r.total_deduction),
      ]),
    }));

    return {
      headers: multiSections[0]?.headers || [],
      rows: multiSections[0]?.rows || [],
      reportTitle: `Schedule 04(a) — Staff Loan Detail — ${monthLabel} ${selectedYear}`,
      multiSections,
    };
  };

  const generateSchedule07StaffFundData = () => {
    const sf = scheduleReportData?.staff_fund;
    if (!sf) return { headers: ["No Data"], rows: [], footer: [] };

    const detail = sf.detail || {};
    const rows = (detail.rows || []).map(r => [
      r.date_joined, r.date_resigned, r.period_of_service, r.employee_name,
      fmt(r.basic_salary), fmt(r.allowance), fmt(r.total_salary),
      fmt(r.employee_contribution), fmt(r.employer_contribution), fmt(r.total_contribution),
    ]);

    const df = detail.footer || {};
    const footer = [
      df.date_joined || "", df.date_resigned || "", df.period_of_service || "TOTAL", df.employee_name || "",
      fmt(df.basic_salary), fmt(df.allowance), fmt(df.total_salary),
      fmt(df.employee_contribution), fmt(df.employer_contribution), fmt(df.total_contribution),
    ];

    const cum = sf.cumulative?.rows?.[0] || {};
    const summaryHeaders = sf.cumulative?.headers || [
      "Employee Contribution", "Employer Contribution", "Total Contribution", "Payments Made", "Balance Payable",
    ];
    const summaryRows = [[
      fmt(cum.employee_contribution), fmt(cum.employer_contribution), fmt(cum.total_contribution),
      fmt(cum.payments_made), fmt(cum.balance_payable),
    ]];

    return {
      headers: detail.headers || [],
      rows,
      footer,
      summaryHeaders,
      summaryRows,
      reportTitle: `Schedule 07 — Staff Fund — ${monthLabel} ${selectedYear}`,
    };
  };

  const sumField = (key) => reportData.reduce((s, e) => s + (Number(e[key]) || 0), 0);

  const generateSchedule07aStaffFundDetailData = () => {
    const data = scheduleReportData?.staff_fund_detail_07a;
    if (!data?.employees?.length) {
      return { headers: ["Period", "Staff Fund", "Sports Fund", "Total"], rows: [], multiSections: [] };
    }

    const empHeaders = ["Period", "Staff Fund", "Sports Fund", "Total"];
    const erHeaders = ["Period", "Staff Fund", "Sports Fund", "Total"];
    const multiSections = [];

    data.employees.forEach(emp => {
      multiSections.push({
        title: `${emp.employee_name} — FY ${data.fiscal_year} | Joined: ${emp.date_joined} | Resigned: ${emp.date_resigned} | Service: ${emp.period_of_service}`,
        headers: ["Employee Contribution", ...empHeaders],
        rows: [
          ...emp.employee_rows.map(r => [r.period, fmt(r.employee_staff), fmt(r.employee_sports), fmt(r.employee_total)]),
          [emp.employee_footer.period, fmt(emp.employee_footer.employee_staff), fmt(emp.employee_footer.employee_sports), fmt(emp.employee_footer.employee_total)],
        ],
      });
      multiSections.push({
        title: `${emp.employee_name} — Employer Contribution`,
        headers: erHeaders,
        rows: [
          ...emp.employee_rows.map(r => [r.period, fmt(r.employer_staff), fmt(r.employer_sports), fmt(r.employer_total)]),
          [emp.employer_footer.period, fmt(emp.employer_footer.employer_staff), fmt(emp.employer_footer.employer_sports), fmt(emp.employer_footer.employer_total)],
        ],
      });
      multiSections.push({
        title: `${emp.employee_name} — Total Contribution`,
        headers: ["Staff Fund", "Sports Fund", "Grand Total"],
        rows: [[fmt(emp.grand_total.staff), fmt(emp.grand_total.sports), fmt(emp.grand_total.total)]],
      });
    });

    return {
      headers: empHeaders,
      rows: multiSections[0]?.rows || [],
      reportTitle: `Schedule 07(a) — Detail Staff Fund Contributions — ${monthLabel} ${selectedYear}`,
      multiSections,
    };
  };

  const generateNetPaySummaryListData = () => {
    const headers = ["Employee Name", "Basic Salary", "Allowance", "Total Net Pay"];
    let tBasic = 0, tAllow = 0, tNet = 0;
    const rows = reportData.map(e => {
      const basicNet = Number(e.epf_schedule_net) || 0;
      const allowNet = Number(e.allowance_net) || 0;
      const total = Number(e.net_salary) || 0;
      tBasic += basicNet; tAllow += allowNet; tNet += total;
      return [e.name, fmt(basicNet), fmt(allowNet), fmt(total)];
    });
    return {
      headers, rows,
      footer: ["TOTAL", fmt(tBasic), fmt(tAllow), fmt(tNet)],
      reportTitle: `Summary for Net Pay — ${monthLabel} ${selectedYear}`,
    };
  };

  const generateNetPaySummaryBreakdownData = () => {
    const salaryComp = sumField('salary_component');
    const allowComp = sumField('allowance_component');
    const gross = sumField('gross_salary');
    const basicNp = sumField('basic_no_pay');
    const bonusNp = sumField('bonus_no_pay');
    const totalNp = sumField('no_pay_amount');
    const advance = sumField('salary_advance');
    const advanceBasic = sumField('salary_advance_basic');
    const loanInst = sumField('loan_installment');
    const loanInt = sumField('loan_interest');
    const sports = sumField('sports_fund');
    const staff = sumField('staff_fund');
    const epf8 = sumField('epf_8');
    const totalDed = sumField('total_deductions');
    const basicNet = sumField('epf_schedule_net');
    const allowNet = sumField('allowance_net');
    const net = sumField('net_salary');

    const rows = [
      ["Earnings", fmt(salaryComp), fmt(allowComp), fmt(gross)],
      ["Less: No pay", fmt(basicNp), fmt(bonusNp), fmt(totalNp)],
      ["Gross Pay", fmt(salaryComp - basicNp), fmt(allowComp - bonusNp), fmt(gross - totalNp)],
      ["Salary Advance", fmt(advanceBasic), fmt(advance - advanceBasic), fmt(advance)],
      ["Loan Installment", fmt(sumField('loan_on_basic')), fmt(sumField('loan_on_bonus')), fmt(loanInst)],
      ["Loan Interest", fmt(0), fmt(loanInt), fmt(loanInt)],
      ["Sports Fund", fmt(0), fmt(sports), fmt(sports)],
      ["Staff Fund", fmt(0), fmt(staff), fmt(staff)],
      ["EPF 8%", fmt(epf8), fmt(0), fmt(epf8)],
      ["Total Deductions", fmt(epf8 + basicNp + sumField('loan_on_basic') + advanceBasic), fmt(totalDed - epf8 - basicNp - sumField('loan_on_basic') - advanceBasic), fmt(totalDed)],
      ["Net Pay", fmt(basicNet), fmt(allowNet), fmt(net)],
    ];

    return {
      headers: ["", "Basic Salary", "Allowance", "Total"],
      rows,
      reportTitle: `Summary for Net Pay (Breakdown) — ${monthLabel} ${selectedYear}`,
    };
  };

  const generateBankSalaryLetterData = () => {
    const company = scheduleReportData?.company?.name || "Company";
    const rows = [];
    let total = 0;
    reportData.forEach(e => {
      const amount = Number(e.bank_amount) || 0;
      if (amount <= 0) return;
      rows.push([e.name, e.bank || "-", e.branch || "-", e.account || "-", fmt(amount)]);
      total += amount;
    });

    const debitDate = `${selectedYear}-${selectedMonth}-10`;
    return {
      headers: ["Name", "Bank", "Branch", "A/C NO", "Amount (Rs.)"],
      rows: rows.length ? rows : [["—", "—", "—", "—", "0.00"]],
      footer: ["TOTAL", "", "", "", fmt(total)],
      letterLines: [
        company,
        `Staff Salaries for the month of ${monthLabel} ${selectedYear}`,
        "",
        `Please be kind enough to debit the above salary on ${debitDate} from ${company} A/C No. ____________`,
        "",
        "Thanking You,",
        "",
        "_________________________",
        "(Authorized Signatory)",
      ],
      reportTitle: `Bank Salary Payment Letter — ${monthLabel} ${selectedYear}`,
    };
  };

  const generateOvertimeScheduleData = () => {
    const headers = [
      "Employee Name", "Basic Salary (a)",
      "Normal Days (b)", "Holidays (c)", "Total (d)",
      "Normal Rate (e)", "Holiday Rate (f)",
      "Overtime (g)", "Poya Allowance (h)", "Mercantile Holiday (i)", "Total",
    ];
    let tOt = 0, tTotal = 0;
    const rows = reportData.map(e => {
      const basic = Number(e.base_basic_salary) || Number(e.salary_for_epf) || 0;
      const normalHrs = (Number(e.ot_morning_hours) || 0) + (Number(e.ot_night_hours) || 0);
      const holHrs = Number(e.ot_holiday_hours) || 0;
      const totalHrs = normalHrs + holHrs;
      const rateNormal = basic / 240 * 1.5;
      const rateHol = basic / 240 * 2;
      const calcOt = (normalHrs * rateNormal) + (holHrs * rateHol);
      const actualOt = (Number(e.ot_morning_fees) || 0) + (Number(e.ot_night_fees) || 0) + (Number(e.ot_holiday_fees) || 0);
      const otPay = actualOt > 0 ? actualOt : calcOt;
      const poya = basic / 30 * 1.5;
      const mercantile = basic / 30 * 1.5;
      const rowTotal = holHrs > 0 || normalHrs > 0 ? otPay : 0;
      tOt += rowTotal; tTotal += rowTotal;
      return [
        e.name, fmt(basic),
        fmt(normalHrs), fmt(holHrs), fmt(totalHrs),
        fmt(rateNormal), fmt(rateHol),
        fmt(rowTotal), holHrs > 0 ? fmt(poya) : fmt(0), holHrs > 0 ? fmt(mercantile) : fmt(0), fmt(rowTotal),
      ];
    });
    return {
      headers, rows,
      footer: ["Total Overtime", "", "", "", "", "", "", fmt(tOt), "", "", fmt(tTotal)],
      reportTitle: `Overtime — ${monthLabel} ${selectedYear}`,
    };
  };

  const generateEPFSchedule06Data = () => {
    const company = scheduleReportData?.company;
    const regNo = company?.registration_no && company.registration_no !== '-' ? company.registration_no : '';
    let rows = []; let tBase = 0, tEmp8 = 0, tEmp12 = 0, tEpf20 = 0, tEtf3 = 0;
    reportData.forEach(e => {
      const epf8 = Number(e.epf_8) || 0;
      const epf12 = Number(e.epf_12) || 0;
      const etf3 = Number(e.etf_3) || 0;
      const epfBase = Number(e.salary_for_epf ?? e.epf_base) || 0;
      if (epf8 + epf12 + etf3 > 0) {
        const totalEpf = epf8 + epf12;
        rows.push([
          e.epf_member_no || e.emp_no, e.name, fmt(epfBase),
          fmt(epf12), fmt(epf8), fmt(totalEpf), fmt(etf3),
        ]);
        tBase += epfBase; tEmp12 += epf12; tEmp8 += epf8; tEpf20 += totalEpf; tEtf3 += etf3;
      }
    });
    return {
      headers: ["Member No.", "Employee Name", "Salary for EPF", "Employer 12%", "Employee 8%", "Total EPF 20%", "ETF 3%"],
      rows,
      footer: ["", "TOTAL", fmt(tBase), fmt(tEmp12), fmt(tEmp8), fmt(tEpf20), fmt(tEtf3)],
      reportTitle: `Schedule 06 — EPF & ETF — ${monthLabel} ${selectedYear}${regNo ? ` — Co. Reg: ${regNo}` : ''}`,
      subtitle: regNo ? `Company Registration No: ${regNo}` : undefined,
    };
  };

  const buildCoinageRows = (useAllowanceNet = true) => {
    const rows = [];
    const noteTotals = new Array(NOTES_ARRAY.length).fill(0);
    let totalCash = 0;
    reportData.forEach(e => {
      const amount = Math.round(useAllowanceNet ? (Number(e.allowance_net) || Number(e.cash_amount) || 0) : (Number(e.cash_amount) || 0));
      if (amount <= 0) return;
      let counts = e.saved_coinage || {};
      if (!e.saved_coinage) {
        counts = {};
        let temp = amount;
        NOTES_ARRAY.forEach(note => { counts[note] = Math.floor(temp / note); temp = temp % note; });
      }
      const row = [e.name, fmt(amount)];
      NOTES_ARRAY.forEach((note, index) => {
        const count = Number(counts[note]) || 0;
        row.push(String(count));
        noteTotals[index] += count;
      });
      const rowSum = NOTES_ARRAY.reduce((s, note) => s + note * (Number(counts[note]) || 0), 0);
      row.push(fmt(rowSum));
      rows.push(row);
      totalCash += amount;
    });
    return { rows, noteTotals, totalCash };
  };

  const generateCashAllowanceSummaryData = () => {
    const { rows, noteTotals, totalCash } = buildCoinageRows(true);
    const noteHeaders = NOTES_ARRAY.map(n => (n >= 100 ? `Note ${n}` : `Rs.${n}`));
    return {
      headers: ["Employee Name", "Net Pay Allowance (Rs.)", ...noteHeaders, "Total Pay Rs."],
      rows: rows.length ? rows : [["—", "0.00", ...NOTES_ARRAY.map(() => "0"), "0.00"]],
      footer: ["TOTAL", fmt(totalCash), ...noteTotals.map(n => String(n)), fmt(totalCash)],
      reportTitle: `Cash Summary for Net Allowance — ${monthLabel} ${selectedYear}`,
    };
  };

  const generateCoinageStaffAllowanceData = () => {
    const { rows, noteTotals, totalCash } = buildCoinageRows(true);
    const coinRows = NOTES_ARRAY.map((note, i) => [
      note >= 100 ? `${note} Note` : `${note} Coin`,
      String(noteTotals[i]),
      fmt(note * noteTotals[i]),
    ]);
    return {
      headers: ["Notes & Coins", "Nos.", "Amount Rs."],
      rows: coinRows,
      footer: ["Grand Total", "", fmt(totalCash)],
      reportTitle: `Coinage for Staff Allowance — ${monthLabel} ${selectedYear}`,
    };
  };

  const downloadCombinedSchedulesPDF = () => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    const sections = [
      { title: "Salary & Allowance (Total)", data: generateSalaryAllowanceTotalData() },
      { title: "Salary Details (EPF/ETF)", data: generateSalaryDetailsData() },
      { title: "Allowance", data: generateAllowanceScheduleData() },
    ];
    const doc = new jsPDF("landscape", "mm", "a3");
    doc.setFontSize(16);
    doc.text(`Salary & Allowance Reports - ${monthLabel} ${selectedYear}`, 14, 15);
    let startY = 25;
    sections.forEach((section, idx) => {
      if (idx > 0) startY += 8;
      doc.setFontSize(12);
      doc.text(section.data.reportTitle || section.title, 14, startY);
      autoTable(doc, {
        startY: startY + 4,
        head: [section.data.headers],
        body: section.data.rows,
        foot: section.data.footer?.length ? [section.data.footer] : [],
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
        styles: { fontSize: 7, cellPadding: 1.5 },
        margin: { left: 14, right: 14 },
      });
      startY = doc.lastAutoTable.finalY + 10;
      if (startY > 180 && idx < sections.length - 1) {
        doc.addPage();
        startY = 20;
      }
    });
    doc.save(`Salary_Allowance_Schedules_${selectedYear}_${selectedMonth}.pdf`);
  };

  const openCoinageEditor = (format) => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    let initialData = [];
    reportData.forEach(e => {
      let amount = Math.round(Number(e.allowance_net) || Number(e.cash_amount) || 0);
      if (amount > 0) {
        if (e.saved_coinage) {
          initialData.push({ process_id: e.process_id, emp_no: e.emp_no, name: e.name, amount: amount, notes: e.saved_coinage });
        } else {
          let counts = {}; let temp = amount;
          NOTES_ARRAY.forEach(note => { counts[note] = Math.floor(temp / note); temp = temp % note; });
          initialData.push({ process_id: e.process_id, emp_no: e.emp_no, name: e.name, amount: amount, notes: counts });
        }
      }
    });
    if (initialData.length === 0) return Swal.fire("Empty", "No allowance cash payments for this month.", "info");
    setEditableCoinage(initialData); setCoinageFormat(format); setShowCoinageModal(true);
  };

  const handleNoteChange = (empIndex, noteValue, newCount) => {
    const updated = [...editableCoinage];
    updated[empIndex].notes[noteValue] = parseInt(newCount) || 0;
    setEditableCoinage(updated);
  };

  const processAndDownloadCoinage = async () => {
    try {
      await ReportService.saveCoinageData(editableCoinage);
      let rows = []; let noteTotals = new Array(NOTES_ARRAY.length).fill(0); let totalCash = 0;
      editableCoinage.forEach(emp => {
        let row = [emp.emp_no, emp.name, emp.amount.toFixed(2)];
        totalCash += emp.amount;
        NOTES_ARRAY.forEach((note, index) => {
          let count = emp.notes[note] || 0;
          row.push(count.toString());
          noteTotals[index] += count;
        });
        rows.push(row);
      });
      const headers = ["Emp No", "Name", "Cash Amount", ...NOTES_ARRAY.map(n => `Rs. ${n}`)];
      const footer = ["", "TOTAL", totalCash.toFixed(2), ...noteTotals.map(n => n.toString())];
      const dataFunc = () => ({ headers, rows, footer });

      if (coinageFormat === 'csv') downloadCSV(dataFunc, "Cash_Coinage_Summary");
      else downloadPDF(dataFunc, "Cash Coinage Summary", "Cash_Coinage_Summary");
      setShowCoinageModal(false);
      handleFetchData();
    } catch (error) {
      Swal.fire("Error", "Failed to save coinage data. Please try again.", "error");
    }
  };

  const downloadCSV = (dataFunc, filename) => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    const { headers, rows, footer, summaryHeaders, summaryRows } = dataFunc();
    if (rows.length === 0) return Swal.fire("Empty", "No data available for this report.", "info");
    let csvContent = "\uFEFF" + headers.join(",") + "\n";
    rows.forEach(r => { csvContent += r.map(v => `"${v}"`).join(",") + "\n"; });
    if (footer && footer.length > 0) csvContent += footer.map(v => `"${v}"`).join(",") + "\n";
    if (summaryHeaders?.length && summaryRows?.length) {
      csvContent += "\n" + summaryHeaders.join(",") + "\n";
      summaryRows.forEach(r => { csvContent += r.map(v => `"${v}"`).join(",") + "\n"; });
    }
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); 
    link.setAttribute("download", `${filename}_${selectedYear}_${selectedMonth}.csv`);
    document.body.appendChild(link); link.click(); link.remove();
  };

  const downloadPDF = (dataFunc, title, filename) => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    const result = dataFunc();
    const { headers, rows, footer, reportTitle, summaryHeaders, summaryRows, multiSections, letterLines, subtitle } = result;
    if (rows.length === 0 && !(multiSections?.length)) return Swal.fire("Empty", "No data available for this report.", "info");
    const isWideTable = headers.length > 9;
    const doc = new jsPDF("landscape", "mm", isWideTable ? "a3" : "a4");
    doc.setFontSize(isWideTable ? 18 : 16);
    doc.text(reportTitle || `${title} - ${selectedMonth}/${selectedYear}`, 14, 15);
    let startY = 22;
    if (subtitle) {
      doc.setFontSize(10);
      doc.text(subtitle, 14, startY);
      startY += 8;
    }
    if (letterLines?.length) {
      doc.setFontSize(10);
      letterLines.forEach((line) => {
        if (line) doc.text(line, 14, startY);
        startY += line ? 6 : 3;
      });
      startY += 4;
    }

    const renderTable = (tableStartY, tableHeaders, tableRows, tableFooter) => {
      autoTable(doc, {
        startY: tableStartY, head: [tableHeaders], body: tableRows, foot: tableFooter?.length > 0 ? [tableFooter] : [],
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        styles: { fontSize: isWideTable ? 7 : 9, cellPadding: 2 }
      });
    };

    if (multiSections?.length) {
      let y = startY;
      multiSections.forEach((section, idx) => {
        if (idx > 0) y = (doc.lastAutoTable?.finalY || y) + 10;
        doc.setFontSize(11);
        doc.text(section.title, 14, y);
        renderTable(y + 4, section.headers, section.rows, section.footer || []);
        if ((doc.lastAutoTable?.finalY || 0) > 180 && idx < multiSections.length - 1) {
          doc.addPage();
          y = 20;
        }
      });
    } else {
      renderTable(startY, headers, rows, footer);
    }

    if (summaryHeaders?.length && summaryRows?.length) {
      const finalY = doc.lastAutoTable?.finalY || startY;
      doc.setFontSize(11);
      doc.text("Summary", 14, finalY + 12);
      autoTable(doc, {
        startY: finalY + 16,
        head: [summaryHeaders],
        body: summaryRows,
        theme: 'grid',
        headStyles: { fillColor: [52, 73, 94], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 2 },
      });
    }
    doc.save(`${filename}_${selectedYear}_${selectedMonth}.pdf`);
  };

  const openReportPreview = (card) => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    const result = card.func();
    const { headers, rows, footer, reportTitle, summaryHeaders, summaryRows, multiSections } = result;
    if (rows.length === 0 && !(multiSections?.length)) return Swal.fire("Empty", "No data available for this report.", "info");

    const sections = multiSections?.length
      ? multiSections.map(s => ({ title: s.title, headers: s.headers, rows: s.rows, footer: [] }))
      : [{ title: reportTitle || card.title, headers, rows, footer, summaryHeaders, summaryRows }];

    if (!multiSections?.length && summaryHeaders?.length) {
      sections[0].summaryHeaders = summaryHeaders;
      sections[0].summaryRows = summaryRows;
    } else if (multiSections?.length && summaryHeaders?.length) {
      sections.push({ title: "Summary", headers: summaryHeaders, rows: summaryRows, footer: [] });
    }

    setPreviewReport({
      title: reportTitle || card.title,
      file: card.file,
      func: card.func,
      sections,
    });
    setShowPreviewModal(true);
  };

  const openCombinedPreview = () => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    const sections = [
      { title: "Salary & Allowance (Total)", ...generateSalaryAllowanceTotalData() },
      { title: "Salary Details (EPF/ETF)", ...generateSalaryDetailsData() },
      { title: "Allowance", ...generateAllowanceScheduleData() },
    ];
    if (sections.every(s => s.rows.length === 0)) {
      return Swal.fire("Empty", "No data available for these reports.", "info");
    }
    setPreviewReport({
      title: "Salary & Allowance Schedules (All 3 Reports)",
      file: "Salary_Allowance_Schedules",
      sections,
    });
    setShowPreviewModal(true);
  };

  const renderPreviewTable = (section) => (
    <div key={section.title} className="mb-8 last:mb-0">
      <h3 className="text-sm font-bold text-gray-800 mb-2 sticky top-0 bg-white py-1">{section.title}</h3>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-blue-600 text-white">
            <tr>
              {section.headers.map((h, i) => (
                <th key={i} className="px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-1.5 border-t border-gray-100">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {section.footer?.length > 0 && (
            <tfoot className="bg-gray-100 font-bold">
              <tr>
                {section.footer.map((cell, fi) => (
                  <td key={fi} className="px-3 py-2 border-t border-gray-300">{cell}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {section.summaryHeaders?.length > 0 && section.summaryRows?.length > 0 && (
        <div className="mt-4 overflow-x-auto border border-gray-200 rounded-lg max-w-2xl">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-slate-700 text-white">
              <tr>
                {section.summaryHeaders.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.summaryRows.map((row, ri) => (
                <tr key={ri} className="bg-white">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 border-t border-gray-100 font-semibold">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-1">{section.rows.length} employee row(s)</p>
    </div>
  );

  const reportCards = [
    { id: 18, title: "Summary for Net Pay", desc: "Employee net pay split — Basic Salary & Allowance.", icon: <FileBarChart className="w-6 h-6 text-blue-800" />, func: generateNetPaySummaryListData, file: "Summary_Net_Pay" },
    { id: 19, title: "Summary for Net Pay (Breakdown)", desc: "Earnings & deductions by Basic / Allowance / Total.", icon: <FileBarChart className="w-6 h-6 text-indigo-800" />, func: generateNetPaySummaryBreakdownData, file: "Summary_Net_Pay_Breakdown" },
    { id: 20, title: "Bank Salary Payment Letter", desc: "Formal bank letter with staff salary transfer list.", icon: <Building2 className="w-6 h-6 text-green-700" />, func: generateBankSalaryLetterData, file: "Bank_Salary_Letter" },
    { id: 21, title: "Overtime Schedule", desc: "OT hours, rates (a/240×1.5 / ×2) and allowances.", icon: <Clock className="w-6 h-6 text-sky-700" />, func: generateOvertimeScheduleData, file: "Overtime_Schedule" },
    { id: 22, title: "Cash Summary — Net Allowance", desc: "Coinage breakdown per employee for allowance payout.", icon: <Banknote className="w-6 h-6 text-emerald-700" />, func: generateCashAllowanceSummaryData, file: "Cash_Summary_Net_Allowance" },
    { id: 23, title: "Coinage — Staff Allowance", desc: "Total notes & coins required for allowance payments.", icon: <Banknote className="w-6 h-6 text-emerald-600" />, func: generateCoinageStaffAllowanceData, file: "Coinage_Staff_Allowance" },
    { id: 24, title: "Schedule 07(a): Staff Fund Detail", desc: "Monthly employee & employer fund contributions (FY).", icon: <Wallet className="w-6 h-6 text-amber-800" />, func: generateSchedule07aStaffFundDetailData, file: "Schedule_07a_Staff_Fund" },
    { id: 16, title: "Schedule 04: Loan Summary", desc: "All staff loans — principal & interest with totals.", icon: <CreditCard className="w-6 h-6 text-orange-700" />, func: generateSchedule04LoanSummaryData, file: "Schedule_04_Loan_Summary" },
    { id: 17, title: "Schedule 04(a): Staff Loan Detail", desc: "Per-loan monthly deduction history.", icon: <CreditCard className="w-6 h-6 text-orange-600" />, func: generateSchedule04aLoanDetailData, file: "Schedule_04a_Loan_Detail" },
    { id: 14, title: "Schedule 02: Nopay", desc: "Basic, Salary & Allowance nopay sections with summary.", icon: <FileCheck className="w-6 h-6 text-red-700" />, func: generateSchedule02NoPayData, file: "Schedule_02_Nopay" },
    { id: 15, title: "Schedule 07: Staff Fund", desc: "Staff fund contributions & cumulative balance.", icon: <Wallet className="w-6 h-6 text-amber-700" />, func: generateSchedule07StaffFundData, file: "Schedule_07_Staff_Fund" },
    { id: 11, title: "Salary & Allowance (Total)", desc: "Combined salary + allowance view with Schedules 02–08.", icon: <FileBarChart className="w-6 h-6 text-blue-700" />, func: generateSalaryAllowanceTotalData, file: "Salary_Allowance_Total" },
    { id: 12, title: "Salary Details (EPF/ETF)", desc: "Sch 01 earnings, Salary for EPF, Sch 03/04/06 deductions.", icon: <FileText className="w-6 h-6 text-indigo-700" />, func: generateSalaryDetailsData, file: "Salary_Details_EPF_ETF" },
    { id: 13, title: "Allowance Report", desc: "Allowance earnings with related deductions (Sch 02–08).", icon: <Wallet className="w-6 h-6 text-violet-700" />, func: generateAllowanceScheduleData, file: "Allowance_Report" },
    { id: 1, title: "Full Master Payroll", desc: "Complete summary with all additions & deductions.", icon: <FileBarChart className="w-6 h-6 text-indigo-600" />, func: generateMasterData, file: "Full_Master_Payroll" },
    { id: 2, title: "Bank Transfer File", desc: "Exact Bank Net Amount sent to accounts.", icon: <Building2 className="w-6 h-6 text-green-600" />, func: generateBankData, file: "Bank_Transfer" },
    { id: 3, title: "Schedule 06: EPF & ETF", desc: "Member No, Salary for EPF, 12%/8%/3% — printed format.", icon: <FileText className="w-6 h-6 text-blue-600" />, func: generateEPFSchedule06Data, file: "EPF_ETF_Sch06" },
    { id: 4, title: "Overtime Summary", desc: "Morning, Night, and Holiday OT breakdown.", icon: <Clock className="w-6 h-6 text-sky-600" />, func: generateOTData, file: "Overtime_Summary" },
    { id: 5, title: "Dynamic Allowances", desc: "Breakdown of all allowances only.", icon: <Wallet className="w-6 h-6 text-purple-600" />, func: generateAllowancesOnlyData, file: "Allowances_Report" },
    { id: 6, title: "Dynamic Bonuses", desc: "Breakdown of bonuses only.", icon: <Gift className="w-6 h-6 text-teal-600" />, func: generateBonusesOnlyData, file: "Bonuses_Report" },
    { id: 7, title: "Custom Deductions", desc: "Dynamic breakdown of custom deductions.", icon: <Scissors className="w-6 h-6 text-pink-600" />, func: generateDynamicDeductionsData, file: "Custom_Deductions" },
    { id: 8, title: "Staff Loans", desc: "Loan installments, interest and balance.", icon: <CreditCard className="w-6 h-6 text-orange-600" />, func: generateLoanData, file: "Staff_Loans" },
    { id: 9, title: "No Pay Details", desc: "Deductions based on absent days.", icon: <FileCheck className="w-6 h-6 text-red-600" />, func: generateNoPayData, file: "NoPay_Details" },
    { id: 10, title: "Cash Coinage (Edit)", desc: "Interactive note breakdown for allowance payouts.", icon: <Banknote className="w-6 h-6 text-emerald-600" />, isCoinage: true }
  ];

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 bg-gray-50/50">
      <div className="max-w-7xl mx-auto relative">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FileSpreadsheet className="text-blue-600"/> Payroll Documents & Schedules</h1>
            <p className="text-gray-500 text-sm mt-1">Load data first, preview reports, then download Excel or PDF.</p>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Month</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-32 px-3 py-2 border rounded-lg bg-gray-50 outline-none">
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-24 px-3 py-2 border rounded-lg bg-gray-50 outline-none">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={handleFetchData} disabled={isLoading} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-70">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>} Load Data
            </button>
          </div>
        </div>

        <div className="mb-6 bg-white rounded-2xl border border-blue-100 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Salary & Allowance Schedules</h2>
            <p className="text-xs text-gray-500 mt-1">Download all three reports (Total, Salary Details, Allowance) in one PDF — matching the printed payroll format.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openCombinedPreview}
              disabled={reportData.length === 0}
              className="px-4 py-2.5 bg-white text-blue-700 font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 flex items-center gap-2 border border-blue-200"
            >
              <Eye className="w-4 h-4" /> Preview All 3
            </button>
            <button
              onClick={downloadCombinedSchedulesPDF}
              disabled={reportData.length === 0}
              className="px-5 py-2.5 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-50 flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Combined PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {reportCards.map((card) => (
            <div key={card.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-gray-50 rounded-xl">{card.icon}</div>
                  <h3 className="text-md font-bold text-gray-800 leading-tight">{card.title}</h3>
                </div>
                <p className="text-xs text-gray-500 mb-5">{card.desc}</p>
              </div>
              <div className="flex flex-col gap-2">
                {!card.isCoinage && (
                  <button
                    onClick={() => openReportPreview(card)}
                    className="w-full py-2 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                )}
                <div className="flex gap-2">
                  <button onClick={() => card.isCoinage ? openCoinageEditor('csv') : downloadCSV(card.func, card.file)} className="flex-1 py-2 text-xs font-semibold bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200">
                    Excel
                  </button>
                  <button onClick={() => card.isCoinage ? openCoinageEditor('pdf') : downloadPDF(card.func, card.title, card.file)} className="flex-1 py-2 text-xs font-semibold bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-200">
                    PDF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showPreviewModal && previewReport && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[92vh] flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Eye className="text-blue-600" /> {previewReport.title}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {monthLabel} {selectedYear} — Review before downloading
                </p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {previewReport.sections.map((section) => renderPreviewTable(section))}
            </div>
            <div className="p-4 border-t flex flex-wrap justify-end gap-3 bg-gray-50 rounded-b-2xl shrink-0">
              <button onClick={() => setShowPreviewModal(false)} className="px-5 py-2 text-gray-600 font-semibold hover:bg-gray-200 rounded-lg">
                Close
              </button>
              {previewReport.sections.length === 1 && previewReport.func && (
                <>
                  <button
                    onClick={() => downloadCSV(previewReport.func, previewReport.file)}
                    className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Download size={16} /> Download Excel
                  </button>
                  <button
                    onClick={() => downloadPDF(previewReport.func, previewReport.title, previewReport.file)}
                    className="px-5 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <Download size={16} /> Download PDF
                  </button>
                </>
              )}
              {previewReport.sections.length > 1 && (
                <button
                  onClick={downloadCombinedSchedulesPDF}
                  className="px-5 py-2 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800 flex items-center gap-2"
                >
                  <Download size={16} /> Download Combined PDF
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCoinageModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Banknote className="text-emerald-600"/> Edit Coinage Breakdown</h2>
                <p className="text-xs text-gray-500 mt-1">Adjust the note counts manually. Check the 'Row Total' to ensure it matches the 'Cash Amount'.</p>
              </div>
              <button onClick={() => setShowCoinageModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-100 text-gray-700 sticky top-0">
                  <tr>
                    <th className="p-3">Emp No</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Cash Amount</th>
                    {NOTES_ARRAY.map(n => <th key={n} className="p-3 text-center">Rs.{n}</th>)}
                    <th className="p-3 text-right">Row Total</th>
                  </tr>
                </thead>
                <tbody>
                  {editableCoinage.map((emp, empIdx) => {
                    let rowSum = NOTES_ARRAY.reduce((sum, note) => sum + (note * (emp.notes[note] || 0)), 0);
                    let isMismatch = rowSum !== emp.amount;
                    return (
                      <tr key={empIdx} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{emp.emp_no}</td>
                        <td className="p-3">{emp.name}</td>
                        <td className="p-3 font-bold text-gray-700">{emp.amount.toFixed(2)}</td>
                        {NOTES_ARRAY.map(note => (
                          <td key={note} className="p-2">
                            <input 
                              type="number" min="0" 
                              value={emp.notes[note] === 0 ? '' : emp.notes[note]} 
                              placeholder="0"
                              onChange={(e) => handleNoteChange(empIdx, note, e.target.value)}
                              className="w-14 p-1.5 border rounded text-center focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                          </td>
                        ))}
                        <td className={`p-3 text-right font-bold ${isMismatch ? 'text-red-500 bg-red-50' : 'text-emerald-600'}`}>{rowSum.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowCoinageModal(false)} className="px-5 py-2 text-gray-600 font-semibold hover:bg-gray-200 rounded-lg">Cancel</button>
              <button onClick={processAndDownloadCoinage} className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-2">
                <Download size={18}/> Export & Save Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;




/*
import React, { useState } from "react";
import { 
  FileSpreadsheet, Building2, Download, 
  FileText, FileBarChart, Loader2, FileCheck, Wallet, CreditCard, Scissors, Gift, Clock
} from "lucide-react";
import Swal from "sweetalert2";
import ReportService from "../../services/ReportService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const Reports = () => {
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const months = [
    { value: "01", label: "January" }, { value: "02", label: "February" },
    { value: "03", label: "March" }, { value: "04", label: "April" },
    { value: "05", label: "May" }, { value: "06", label: "June" },
    { value: "07", label: "July" }, { value: "08", label: "August" },
    { value: "09", label: "September" }, { value: "10", label: "October" },
    { value: "11", label: "November" }, { value: "12", label: "December" },
  ];
  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  const handleFetchData = async () => {
    try {
      setIsLoading(true);
      const data = await ReportService.getMonthlyReportData(selectedMonth, selectedYear);
      setReportData(data);
      if(data.length === 0) Swal.fire("No Data", "No salaries processed for this month.", "info");
      else Swal.fire({ icon: "success", title: "Data Loaded", text: `Ready to generate reports for ${data.length} employees.`, timer: 1500, showConfirmButton: false });
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      Swal.fire("Error", `Failed: ${JSON.stringify(errorMsg)}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
 
  // =========================================================

  const generateMasterData = () => {
    const uniqueAllowances = new Set();
    const uniqueBonuses = new Set();
    const uniqueDeductions = new Set();

    reportData.forEach(e => {
       (e.raw_allowances || []).forEach(a => uniqueAllowances.add(a.name));
       (e.raw_bonuses || []).forEach(b => uniqueBonuses.add(b.name));
       (e.raw_deductions || []).forEach(d => uniqueDeductions.add(d.name));
    });

    const allowHeaders = Array.from(uniqueAllowances);
    const bonusHeaders = Array.from(uniqueBonuses);
    const dedHeaders = Array.from(uniqueDeductions);

    const headers = [
      "Emp No", "Name", "Basic Salary",
      ...allowHeaders, ...bonusHeaders, "Gross Salary",
      "EPF 8%", "No Pay", "Loan Deductions", ...dedHeaders, "Total Deductions",
      "Net Pay", "Employer EPF 12%", "ETF 3%"
    ];

    let rows = []; let totals = new Array(headers.length).fill(0);

    reportData.forEach(e => {
      let row = [e.emp_no, e.name, e.basic_salary.toFixed(2)]; totals[2] += e.basic_salary;

      allowHeaders.forEach((h, i) => {
        let amt = ((e.raw_allowances || []).find(a => a.name === h) || {}).amount || 0;
        row.push(parseFloat(amt).toFixed(2)); totals[3 + i] += parseFloat(amt);
      });

      let bonusOffset = 3 + allowHeaders.length;
      bonusHeaders.forEach((h, i) => {
        let amt = ((e.raw_bonuses || []).find(b => b.name === h) || {}).amount || 0;
        row.push(parseFloat(amt).toFixed(2)); totals[bonusOffset + i] += parseFloat(amt);
      });

      let grossIdx = bonusOffset + bonusHeaders.length;
      row.push(e.gross_salary.toFixed(2)); totals[grossIdx] += e.gross_salary;

      let epf8 = e.epf_8 || 0; let noPay = e.no_pay_amount || 0; let loan = (e.loan_installment || 0) + (e.loan_interest || 0);
      row.push(epf8.toFixed(2)); totals[grossIdx + 1] += epf8;
      row.push(noPay.toFixed(2)); totals[grossIdx + 2] += noPay;
      row.push(loan.toFixed(2)); totals[grossIdx + 3] += loan;

      let dedOffset = grossIdx + 4;
      dedHeaders.forEach((h, i) => {
        let amt = ((e.raw_deductions || []).find(d => d.name === h) || {}).amount || 0;
        row.push(parseFloat(amt).toFixed(2)); totals[dedOffset + i] += parseFloat(amt);
      });

      let totDedIdx = dedOffset + dedHeaders.length;
      row.push(e.total_deductions.toFixed(2)); totals[totDedIdx] += e.total_deductions;

      let netIdx = totDedIdx + 1;
      row.push(e.net_salary.toFixed(2)); totals[netIdx] += e.net_salary;

      let epf12 = e.epf_12 || 0; let etf3 = e.etf_3 || 0;
      row.push(epf12.toFixed(2)); totals[netIdx + 1] += epf12;
      row.push(etf3.toFixed(2)); totals[netIdx + 2] += etf3;

      rows.push(row);
    });

    let footer = ["", "TOTAL"];
    for (let i = 2; i < totals.length; i++) { footer.push(totals[i].toFixed(2)); }
    return { headers, rows, footer };
  };

  const generateBankData = () => {
    let rows = []; let totalAmount = 0;
    reportData.forEach(e => {
      let allowSum = 0;
      (e.raw_allowances || []).forEach(a => { allowSum += parseFloat(a.amount) || 0; });
      let amount = e.basic_salary + allowSum;
      if (amount > 0) { rows.push([e.emp_no, e.name, e.bank, e.branch, e.account, amount.toFixed(2)]); totalAmount += amount; }
    });
    return { headers: ["Emp No", "Name", "Bank", "Branch", "Account No", "Amount (Basic + Allowances)"], rows, footer: ["", "", "", "", "TOTAL AMOUNT", totalAmount.toFixed(2)] };
  };

  const generateEPFData = () => {
    let rows = []; let tBase = 0, tEmp8 = 0, tEmp12 = 0, tEpf20 = 0, tEtf3 = 0;
    reportData.forEach(e => {
      const epf8 = Number(e.epf_8) || 0;
      const epf12 = Number(e.epf_12) || 0;
      const etf3 = Number(e.etf_3) || 0;
      const epfBase = Number(e.salary_for_epf ?? e.epf_base) || 0;
      if (epf8 + epf12 + etf3 > 0) {
        let totalEpf = epf8 + epf12;
        rows.push([
          e.epf_member_no || e.emp_no,
          e.name,
          epfBase.toFixed(2),
          epf12.toFixed(2),
          epf8.toFixed(2),
          totalEpf.toFixed(2),
          etf3.toFixed(2)
        ]);
        tBase += epfBase; tEmp12 += epf12; tEmp8 += epf8; tEpf20 += totalEpf; tEtf3 += etf3;
      }
    });
    return { headers: ["Member No", "Name", "Salary for EPF", "Employer 12%", "Employee 8%", "Total EPF 20%", "ETF 3%"], rows, footer: ["", "TOTAL", tBase.toFixed(2), tEmp12.toFixed(2), tEmp8.toFixed(2), tEpf20.toFixed(2), tEtf3.toFixed(2)] };
  };

  //  Allowances Report 
  const generateAllowancesOnlyData = () => {
    const uniqueNames = new Set();
    reportData.forEach(e => { (e.raw_allowances || []).forEach(a => uniqueNames.add(a.name)); });
    const dynamicHeaders = Array.from(uniqueNames);
    let rows = []; let columnTotals = new Array(dynamicHeaders.length).fill(0); let tTotal = 0;

    reportData.forEach(e => {
      let row = [e.emp_no, e.name];
      let empTotalAdditions = 0;
      dynamicHeaders.forEach((headerName, index) => {
        let item = (e.raw_allowances || []).find(a => a.name === headerName);
        let amount = item ? parseFloat(item.amount) : 0;
        row.push(amount.toFixed(2)); columnTotals[index] += amount; empTotalAdditions += amount;
      });
      // Allowance
      if(empTotalAdditions > 0) {
        row.push(empTotalAdditions.toFixed(2)); tTotal += empTotalAdditions; rows.push(row);
      }
    });

    if (dynamicHeaders.length === 0) return { headers: ["Emp No", "Name", "No Allowances"], rows: [], footer: [] };
    return { headers: ["Emp No", "Name", ...dynamicHeaders, "Total Allowances"], rows, footer: ["", "TOTAL", ...columnTotals.map(t => t.toFixed(2)), tTotal.toFixed(2)] };
  };

  const generateBonusesOnlyData = () => {
    const uniqueNames = new Set();
    reportData.forEach(e => { (e.raw_bonuses || []).forEach(b => uniqueNames.add(b.name)); });
    const dynamicHeaders = Array.from(uniqueNames);
    let rows = []; let columnTotals = new Array(dynamicHeaders.length).fill(0); let tTotal = 0;

    reportData.forEach(e => {
      let row = [e.emp_no, e.name]; let empTotalBonuses = 0;
      dynamicHeaders.forEach((headerName, index) => {
        let item = (e.raw_bonuses || []).find(b => b.name === headerName);
        let amount = item ? parseFloat(item.amount) : 0;
        row.push(amount.toFixed(2)); columnTotals[index] += amount; empTotalBonuses += amount;
      });
      if (empTotalBonuses > 0) { row.push(empTotalBonuses.toFixed(2)); rows.push(row); tTotal += empTotalBonuses; }
    });

    if (dynamicHeaders.length === 0) return { headers: ["Emp No", "Name", "No Bonuses Found"], rows: [], footer: [] };
    return { headers: ["Emp No", "Name", ...dynamicHeaders, "Total Bonuses"], rows, footer: ["", "TOTAL", ...columnTotals.map(t => t.toFixed(2)), tTotal.toFixed(2)] };
  };

  const generateDynamicDeductionsData = () => {
    const uniqueNames = new Set();
    reportData.forEach(e => { (e.raw_deductions || []).forEach(d => uniqueNames.add(d.name)); });
    const dynamicHeaders = Array.from(uniqueNames);
    let rows = []; let columnTotals = new Array(dynamicHeaders.length).fill(0); let tTotal = 0;

    reportData.forEach(e => {
      let row = [e.emp_no, e.name]; let empTotalDeds = 0;
      dynamicHeaders.forEach((headerName, index) => {
        let item = (e.raw_deductions || []).find(d => d.name === headerName);
        let amount = item ? parseFloat(item.amount) : 0;
        row.push(amount.toFixed(2)); columnTotals[index] += amount; empTotalDeds += amount;
      });
      if (empTotalDeds > 0) { row.push(empTotalDeds.toFixed(2)); rows.push(row); tTotal += empTotalDeds; }
    });
    if (dynamicHeaders.length === 0) return { headers: ["Emp No", "Name", "No Custom Deductions"], rows: [], footer: [] };
    return { headers: ["Emp No", "Name", ...dynamicHeaders, "Total Custom Deductions"], rows, footer: ["", "TOTAL", ...columnTotals.map(t => t.toFixed(2)), tTotal.toFixed(2)] };
  };

  const generateLoanData = () => {
    let rows = []; let tAmount = 0, tInst = 0, tInt = 0, tDed = 0, tOut = 0;
    reportData.forEach(e => {
      if (e.loan_amount > 0) {
        let totDed = e.loan_installment + e.loan_interest; let outStanding = Math.max(0, e.loan_amount - e.loan_installment);
        rows.push([e.emp_no, e.name, e.loan_amount.toFixed(2), e.loan_installment.toFixed(2), e.loan_interest.toFixed(2), totDed.toFixed(2), outStanding.toFixed(2)]);
        tAmount += e.loan_amount; tInst += e.loan_installment; tInt += e.loan_interest; tDed += totDed; tOut += outStanding;
      }
    });
    return { headers: ["Emp No", "Name", "Loan Amount", "Installment", "Interest", "Total Deduction", "Balance Outstanding"], rows, footer: ["", "TOTAL", tAmount.toFixed(2), tInst.toFixed(2), tInt.toFixed(2), tDed.toFixed(2), tOut.toFixed(2)] };
  };

  const generateNoPayData = () => {
    let rows = []; let tDays = 0, tAmount = 0;
    reportData.forEach(e => {
      if (e.no_pay_amount > 0 || e.no_pay_days > 0) {
        rows.push([e.emp_no, e.name, e.no_pay_days.toString(), e.no_pay_amount.toFixed(2)]);
        tDays += e.no_pay_days; tAmount += e.no_pay_amount;
      }
    });
    return { headers: ["Emp No", "Name", "No Pay Days", "Deduction Amount"], rows, footer: ["", "TOTAL", tDays.toString(), tAmount.toFixed(2)] };
  };

  //  OT Report 
  const generateOTData = () => {
    let rows = [];
    let tMornHrs = 0, tMornFees = 0, tNightHrs = 0, tNightFees = 0, tHolHrs = 0, tHolFees = 0, tTotFees = 0;

    reportData.forEach(e => {
      let totFees = (e.ot_morning_fees || 0) + (e.ot_night_fees || 0) + (e.holiday_ot_fees || 0);
      
      if (totFees > 0) {
        rows.push([
          e.emp_no, e.name,
          (e.ot_morning_hours || 0).toFixed(2), (e.ot_morning_fees || 0).toFixed(2),
          (e.ot_night_hours || 0).toFixed(2), (e.ot_night_fees || 0).toFixed(2),
          (e.holiday_ot_hours || 0).toFixed(2), (e.holiday_ot_fees || 0).toFixed(2),
          totFees.toFixed(2)
        ]);
        tMornHrs += (e.ot_morning_hours || 0); tMornFees += (e.ot_morning_fees || 0);
        tNightHrs += (e.ot_night_hours || 0); tNightFees += (e.ot_night_fees || 0);
        tHolHrs += (e.holiday_ot_hours || 0); tHolFees += (e.holiday_ot_fees || 0);
        tTotFees += totFees;
      }
    });

    const headers = ["Emp No", "Name", "Morning OT (Hrs)", "Morning OT (Rs)", "Night OT (Hrs)", "Night OT (Rs)", "Holiday OT (Hrs)", "Holiday OT (Rs)", "Total OT (Rs)"];
    const footer = ["", "TOTAL", tMornHrs.toFixed(2), tMornFees.toFixed(2), tNightHrs.toFixed(2), tNightFees.toFixed(2), tHolHrs.toFixed(2), tHolFees.toFixed(2), tTotFees.toFixed(2)];
    
    if (rows.length === 0) return { headers: ["Emp No", "Name", "No Overtime Recorded"], rows: [], footer: [] };
    return { headers, rows, footer };
  };

  // =========================================================
  // Export Functions
  // =========================================================
  const downloadCSV = (dataFunc, filename) => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    const { headers, rows, footer } = dataFunc();
    if (rows.length === 0) return Swal.fire("Empty", "No data available for this report.", "info");

    let csvContent = "\uFEFF" + headers.join(",") + "\n";
    rows.forEach(r => { csvContent += r.map(v => `"${v}"`).join(",") + "\n"; });
    if (footer && footer.length > 0) csvContent += footer.map(v => `"${v}"`).join(",") + "\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); 
    link.setAttribute("download", `${filename}_${selectedYear}_${selectedMonth}.csv`);
    document.body.appendChild(link); link.click(); link.remove();
  };

  const downloadPDF = (dataFunc, title, filename) => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    const { headers, rows, footer } = dataFunc();
    if (rows.length === 0) return Swal.fire("Empty", "No data available for this report.", "info");
    
    const isWideTable = headers.length > 9;
    const doc = new jsPDF("landscape", "mm", isWideTable ? "a3" : "a4");
    
    doc.setFontSize(isWideTable ? 18 : 16);
    doc.text(`${title} - ${selectedMonth}/${selectedYear}`, 14, 15);
    
    autoTable(doc, {
      startY: 25, head: [headers], body: rows, foot: footer.length > 0 ? [footer] : [],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
      styles: { fontSize: isWideTable ? 7 : 9, cellPadding: 2 }
    });
    doc.save(`${filename}_${selectedYear}_${selectedMonth}.pdf`);
  };

  // --- Reports List ---
  const reportCards = [
    { id: 1, title: "Full Master Payroll", desc: "Complete summary with all additions & deductions.", icon: <FileBarChart className="w-6 h-6 text-indigo-600" />, func: generateMasterData, file: "Full_Master_Payroll" },
    { id: 2, title: "Bank Transfer File", desc: "Basic Salary + Allowances sent to bank.", icon: <Building2 className="w-6 h-6 text-green-600" />, func: generateBankData, file: "Bank_Transfer" },
    { id: 3, title: "Schedule 06: EPF & ETF", desc: "8%, 12% and 3% contributions.", icon: <FileText className="w-6 h-6 text-blue-600" />, func: generateEPFData, file: "EPF_ETF_Sch06" },
    { id: 4, title: "Overtime Summary", desc: "Morning, Night, and Holiday OT breakdown.", icon: <Clock className="w-6 h-6 text-sky-600" />, func: generateOTData, file: "Overtime_Summary" },
    { id: 5, title: "Dynamic Allowances", desc: "Breakdown of all allowances only.", icon: <Wallet className="w-6 h-6 text-purple-600" />, func: generateAllowancesOnlyData, file: "Allowances_Report" },
    { id: 6, title: "Dynamic Bonuses", desc: "Breakdown of bonuses only.", icon: <Gift className="w-6 h-6 text-teal-600" />, func: generateBonusesOnlyData, file: "Bonuses_Report" },
    { id: 7, title: "Custom Deductions", desc: "Dynamic breakdown of custom deductions.", icon: <Scissors className="w-6 h-6 text-pink-600" />, func: generateDynamicDeductionsData, file: "Custom_Deductions" },
    { id: 8, title: "Staff Loans", desc: "Loan installments, interest and balance.", icon: <CreditCard className="w-6 h-6 text-orange-600" />, func: generateLoanData, file: "Staff_Loans" },
    { id: 9, title: "No Pay Details", desc: "Deductions based on absent days.", icon: <FileCheck className="w-6 h-6 text-red-600" />, func: generateNoPayData, file: "NoPay_Details" },
  ];

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 bg-gray-50/50">
      <div className="max-w-7xl mx-auto">
        
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FileSpreadsheet className="text-blue-600"/> Payroll Documents & Schedules</h1>
            <p className="text-gray-500 text-sm mt-1">Load data first, then download Excel or PDF with Totals.</p>
          </div>
          
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Month</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-32 px-3 py-2 border rounded-lg bg-gray-50 outline-none">
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-24 px-3 py-2 border rounded-lg bg-gray-50 outline-none">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={handleFetchData} disabled={isLoading} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-70">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>} Load Data
            </button>
          </div>
        </div>

        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {reportCards.map((card) => (
            <div key={card.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-gray-50 rounded-xl">{card.icon}</div>
                  <h3 className="text-md font-bold text-gray-800 leading-tight">{card.title}</h3>
                </div>
                <p className="text-xs text-gray-500 mb-5">{card.desc}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => downloadCSV(card.func, card.file)} className="flex-1 py-2 text-xs font-semibold bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200">
                  Excel
                </button>
                <button onClick={() => downloadPDF(card.func, card.title, card.file)} className="flex-1 py-2 text-xs font-semibold bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-200">
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default Reports;
*/