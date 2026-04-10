// ═══════════════════════════════════════════════
// Cash-Flow — Salary & Expense Tracker
// JavaScript: DOM Manipulation & Data Persistence
// ═══════════════════════════════════════════════

(function () {
  "use strict";

  // ──── DOM References ────
  const salaryForm = document.getElementById("salary-form");
  const salaryInput = document.getElementById("salary-input");
  const expenseForm = document.getElementById("expense-form");
  const expenseName = document.getElementById("expense-name");
  const expenseAmount = document.getElementById("expense-amount");
  const expenseList = document.getElementById("expense-list");
  const emptyState = document.getElementById("empty-state");
  const clearAllBtn = document.getElementById("clear-all-btn");
  const toast = document.getElementById("toast");
  const cursorGlow = document.getElementById("cursor-glow");

  const displaySalary = document.getElementById("display-salary");
  const displayExpenses = document.getElementById("display-expenses");
  const displayBalance = document.getElementById("display-balance");

  const currencySelector = document.getElementById("currency-selector");
  const downloadReportBtn = document.getElementById("download-report-btn");

  // ──── State ────
  let salary = 0;
  let expenses = []; // { id, name, amount }
  let currentCurrency = "INR";
  let exchangeRates = { INR: 1 };
  const currencySymbols = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  let isBalanceAlertShown = false;

  // ──── Helpers ────

  /** Fetch exchange rates */
  async function fetchExchangeRates() {
    try {
      const res = await fetch("https://api.frankfurter.app/latest?from=INR");
      const data = await res.json();
      exchangeRates = { INR: 1, ...data.rates };
    } catch (e) {
      console.error("Failed to fetch exchange rates", e);
    }
  }

  /** Format number to correct currency style */
  function formatCurrency(value) {
    const rate = exchangeRates[currentCurrency] || 1;
    const converted = value * rate;
    const sym = currencySymbols[currentCurrency] || "₹";
    return sym + Number(converted).toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  /** Generate a simple unique ID */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /** Show a toast notification */
  let toastTimer = null;
  function showToast(message, type = "success") {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = "toast " + type + " show";
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  /** Add a quick pop animation to a card value */
  function animateValue(element) {
    element.classList.remove("value-pop");
    // Force reflow so the animation restarts
    void element.offsetWidth;
    element.classList.add("value-pop");
  }

  /** Highlight an input as having an error */
  function flashError(input) {
    input.classList.add("error");
    input.focus();
    setTimeout(() => input.classList.remove("error"), 600);
  }

  // ──── Persistence (localStorage) ────

  function saveState() {
    localStorage.setItem(
      "cashflow_data",
      JSON.stringify({ salary, expenses })
    );
  }

  function loadState() {
    try {
      const data = JSON.parse(localStorage.getItem("cashflow_data"));
      if (data) {
        salary = data.salary || 0;
        expenses = data.expenses || [];
      }
    } catch {
      // Corrupted data — start fresh
      salary = 0;
      expenses = [];
    }
  }

  // ──── Chart Setup ────
  const chartCanvas = document.getElementById("balance-chart");
  let balanceChart;

  function initChart() {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext("2d");
    
    Chart.defaults.color = "#8b90a0";
    Chart.defaults.font.family = '"Inter", system-ui, sans-serif';

    balanceChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Remaining Balance", "Total Expenses"],
        datasets: [{
          data: [0, 0],
          backgroundColor: [
            "#6c5ce7", // Balance color (purple)
            "#ff6b6b"  // Expense color (red)
          ],
          borderColor: "#0b0e17",
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 20,
              font: {
                size: 14
              }
            }
          }
        }
      }
    });
  }

  function updateChart(balance, expensesTotal) {
    if (!balanceChart) return;
    const displayBalance = Math.max(0, balance);
    balanceChart.data.datasets[0].data = [displayBalance, expensesTotal];
    balanceChart.update();
  }

  // ──── Rendering ────

  function updateSummary() {
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const balance = salary - totalExpenses;

    displaySalary.textContent = formatCurrency(salary);
    displayExpenses.textContent = formatCurrency(totalExpenses);
    displayBalance.textContent = formatCurrency(balance);

    // Colour the balance and handle Budget alert
    displayBalance.classList.remove("balance-positive", "balance-negative");
    if (balance > 0) {
      if (salary > 0 && balance < 0.1 * salary) {
        displayBalance.classList.add("balance-negative");
        if (!isBalanceAlertShown) {
          showToast("Warning: Remaining balance dropped below 10% of salary!", "error");
          isBalanceAlertShown = true;
        }
      } else {
        displayBalance.classList.add("balance-positive");
        isBalanceAlertShown = false;
      }
    } else if (balance <= 0 && salary > 0) {
      displayBalance.classList.add("balance-negative");
      if (!isBalanceAlertShown) {
         showToast("Warning: Remaining balance is empty or negative!", "error");
         isBalanceAlertShown = true;
      }
    } else if (balance < 0) {
      displayBalance.classList.add("balance-negative");
    }

    animateValue(displaySalary);
    animateValue(displayExpenses);
    animateValue(displayBalance);

    // Update chart
    if (typeof updateChart === "function") {
      updateChart(balance, totalExpenses);
    }
  }

  function renderExpenses() {
    expenseList.innerHTML = "";

    if (expenses.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    expenses.forEach((exp) => {
      const li = document.createElement("li");
      li.className = "expense-item";
      li.dataset.id = exp.id;

      li.innerHTML = `
        <div class="expense-item-info">
          <span class="expense-item-name">${escapeHTML(exp.name)}</span>
          <span class="expense-item-amount">${formatCurrency(exp.amount)}</span>
        </div>
        <button class="btn btn-delete" title="Remove expense" aria-label="Remove ${escapeHTML(exp.name)}">🗑️</button>
      `;

      // Delete handler
      li.querySelector(".btn-delete").addEventListener("click", () => {
        removeExpense(exp.id, li);
      });

      expenseList.appendChild(li);
    });
  }

  /** Escape HTML to prevent XSS from user input */
  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ──── Actions ────

  function setSalary(value) {
    salary = value;
    salaryInput.value = "";
    saveState();
    updateSummary();
    showToast("Salary updated to " + formatCurrency(value), "success");
  }

  function addExpense(name, amount) {
    const newExp = { id: uid(), name: name.trim(), amount };
    expenses.push(newExp);
    saveState();
    updateSummary();
    renderExpenses();
    showToast(`"${name.trim()}" added`, "success");
    expenseName.value = "";
    expenseAmount.value = "";
    expenseName.focus();
  }

  function removeExpense(id, liElement) {
    // Immediate state update
    expenses = expenses.filter((e) => e.id !== id);
    saveState();
    updateSummary();

    // Visual removal
    liElement.classList.add("removing");
    liElement.addEventListener("animationend", () => {
      renderExpenses();
      showToast("Expense removed", "success");
    });
  }

  function clearAll() {
    if (expenses.length === 0) return;
    expenses = [];
    saveState();
    updateSummary();
    renderExpenses();
    showToast("All expenses cleared", "success");
  }

  // ──── Event Listeners ────

  salaryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = parseFloat(salaryInput.value);

    if (isNaN(value) || value < 0) {
      flashError(salaryInput);
      showToast("Please enter a valid salary (0 or more)", "error");
      return;
    }

    setSalary(value);
  });

  expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = expenseName.value.trim();
    const amount = parseFloat(expenseAmount.value);

    // Validation: empty name
    if (!name) {
      flashError(expenseName);
      showToast("Expense name cannot be empty", "error");
      return;
    }

    // Validation: empty or negative amount
    if (isNaN(amount) || amount <= 0) {
      flashError(expenseAmount);
      showToast("Amount must be a positive number", "error");
      return;
    }

    addExpense(name, amount);
  });

  clearAllBtn.addEventListener("click", clearAll);

  if (currencySelector) {
    currencySelector.addEventListener("change", (e) => {
      currentCurrency = e.target.value;
      updateSummary();
      renderExpenses();
    });
  }

  if (downloadReportBtn) {
    downloadReportBtn.addEventListener("click", () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      doc.setFontSize(22);
      doc.text("Cash-Flow Budget Report", 20, 20);
      
      doc.setFontSize(14);
      doc.text(`Total Salary: ${formatCurrency(salary)}`, 20, 35);
      
      const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
      doc.text(`Total Expenses: ${formatCurrency(totalExp)}`, 20, 45);
      
      const bal = salary - totalExp;
      doc.text(`Remaining Balance: ${formatCurrency(bal)}`, 20, 55);
      
      doc.text("Expenses List:", 20, 70);
      
      let yPos = 80;
      doc.setFontSize(12);
      if (expenses.length === 0) {
        doc.text("No expenses recorded.", 20, yPos);
      } else {
        expenses.forEach((e, i) => {
          doc.text(`${i + 1}. ${e.name} - ${formatCurrency(e.amount)}`, 20, yPos);
          yPos += 10;
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
        });
      }
      
      doc.save("CashFlow_Report.pdf");
      showToast("Report downloaded successfully!", "success");
    });
  }

  // Spotlight glow effect
  document.addEventListener("mousemove", (e) => {
    if (cursorGlow) {
      // We use pageX/pageY if we want it relative to the document, but since it's 'position: fixed', 
      // we should use clientX/clientY to position it on the viewport.
      cursorGlow.style.left = `${e.clientX}px`;
      cursorGlow.style.top = `${e.clientY}px`;
    }
  });

  // ──── Initialise ────
  loadState();
  initChart();
  updateSummary();
  renderExpenses();
  fetchExchangeRates().then(() => {
    updateSummary();
    renderExpenses();
  });

  // Pre-fill the salary input if we have one saved
  if (salary > 0) {
    salaryInput.placeholder = "Current: " + formatCurrency(salary);
  }
})();
