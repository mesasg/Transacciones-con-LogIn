const API = "/api";

const alertBox = document.getElementById("alert");
const views = {
    customers: document.getElementById("view-customers"),
    transfer: document.getElementById("view-transfer"),
    history: document.getElementById("view-history"),
};

let customersCache = [];

function showAlert(message, type = "ok") {
    alertBox.hidden = false;
    alertBox.className = `alert ${type}`;
    alertBox.textContent = message;
}

function hideAlert() {
    alertBox.hidden = true;
}

async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
    });

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!response.ok) {
        const message = typeof data === "string" ? data : "Ocurrió un error en la petición.";
        throw new Error(message);
    }
    return data;
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
    });
}

function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("es-CO");
}

function fillAccountSelects() {
    const sender = document.getElementById("senderAccount");
    const receiver = document.getElementById("receiverAccount");
    const history = document.getElementById("history-customer");
    const options = customersCache
        .map((c) => `<option value="${c.accountNumber}">${c.firstName} ${c.lastName} — ${c.accountNumber}</option>`)
        .join("");

    sender.innerHTML = options;
    receiver.innerHTML = options;
    history.innerHTML = options;
}

function renderCustomers() {
    const body = document.getElementById("customers-body");
    if (!customersCache.length) {
        body.innerHTML = `<tr><td colspan="5">No hay clientes registrados.</td></tr>`;
        return;
    }

    body.innerHTML = customersCache
        .map(
            (c) => `
            <tr>
                <td>${c.id}</td>
                <td>${c.firstName} ${c.lastName}</td>
                <td>${c.accountNumber}</td>
                <td>${formatMoney(c.balance)}</td>
                <td class="row-actions">
                    <button class="btn ghost" data-edit="${c.id}">Editar</button>
                    <button class="btn danger" data-delete="${c.id}">Borrar</button>
                    <button class="btn ghost" data-history="${c.accountNumber}">Histórico</button>
                </td>
            </tr>`
        )
        .join("");
}

async function loadCustomers() {
    customersCache = await request("/customers");
    renderCustomers();
    fillAccountSelects();
}

function resetCustomerForm() {
    document.getElementById("customer-form").reset();
    document.getElementById("customer-id").value = "";
    document.getElementById("customer-form-title").textContent = "Nuevo cliente";
    document.getElementById("cancel-edit").hidden = true;
}

function startEdit(id) {
    const customer = customersCache.find((c) => String(c.id) === String(id));
    if (!customer) return;
    document.getElementById("customer-id").value = customer.id;
    document.getElementById("firstName").value = customer.firstName;
    document.getElementById("lastName").value = customer.lastName;
    document.getElementById("accountNumber").value = customer.accountNumber;
    document.getElementById("balance").value = customer.balance;
    document.getElementById("customer-form-title").textContent = `Editar cliente #${customer.id}`;
    document.getElementById("cancel-edit").hidden = false;
}

async function renderHistory(accountNumber) {
    const transactions = await request(`/transactions/${encodeURIComponent(accountNumber)}`);
    const body = document.getElementById("history-body");
    document.getElementById("history-subtitle").textContent = `Cuenta ${accountNumber}`;
    document.getElementById("history-customer").value = accountNumber;

    if (!transactions.length) {
        body.innerHTML = `<tr><td colspan="6">Este cliente no tiene transacciones.</td></tr>`;
        return;
    }

    body.innerHTML = transactions
        .map((t) => {
            const type = t.senderAccountNumber === accountNumber ? "Enviada" : "Recibida";
            return `
                <tr>
                    <td>${t.id}</td>
                    <td>${formatDate(t.timestamp)}</td>
                    <td>${t.senderAccountNumber}</td>
                    <td>${t.receiverAccountNumber}</td>
                    <td>${formatMoney(t.amount)}</td>
                    <td>${type}</td>
                </tr>`;
        })
        .join("");
}

function showView(name) {
    Object.entries(views).forEach(([key, el]) => {
        el.hidden = key !== name;
    });
    document.querySelectorAll(".nav-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.view === name);
    });
    hideAlert();
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
});

document.getElementById("reload-customers").addEventListener("click", async () => {
    try {
        await loadCustomers();
        showAlert("Lista de clientes actualizada.");
    } catch (error) {
        showAlert(error.message, "error");
    }
});

document.getElementById("cancel-edit").addEventListener("click", resetCustomerForm);

document.getElementById("customer-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = document.getElementById("customer-id").value;
    const payload = {
        firstName: document.getElementById("firstName").value.trim(),
        lastName: document.getElementById("lastName").value.trim(),
        accountNumber: document.getElementById("accountNumber").value.trim(),
        balance: Number(document.getElementById("balance").value),
    };

    try {
        if (id) {
            await request(`/customers/${id}`, { method: "PUT", body: JSON.stringify(payload) });
            showAlert("Cliente actualizado.");
        } else {
            await request("/customers", { method: "POST", body: JSON.stringify(payload) });
            showAlert("Cliente creado.");
        }
        resetCustomerForm();
        await loadCustomers();
    } catch (error) {
        showAlert(error.message, "error");
    }
});

document.getElementById("customers-body").addEventListener("click", async (event) => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    const historyAccount = event.target.dataset.history;

    if (editId) {
        startEdit(editId);
        return;
    }

    if (deleteId) {
        if (!confirm("¿Eliminar este cliente?")) return;
        try {
            await request(`/customers/${deleteId}`, { method: "DELETE" });
            showAlert("Cliente eliminado.");
            resetCustomerForm();
            await loadCustomers();
        } catch (error) {
            showAlert(error.message, "error");
        }
        return;
    }

    if (historyAccount) {
        showView("history");
        try {
            await renderHistory(historyAccount);
        } catch (error) {
            showAlert(error.message, "error");
        }
    }
});

document.getElementById("transfer-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const senderAccountNumber = document.getElementById("senderAccount").value;
    const receiverAccountNumber = document.getElementById("receiverAccount").value;
    const amount = Number(document.getElementById("amount").value);

    if (senderAccountNumber === receiverAccountNumber) {
        showAlert("La cuenta origen y destino deben ser distintas.", "error");
        return;
    }

    try {
        await request("/transactions", {
            method: "POST",
            body: JSON.stringify({ senderAccountNumber, receiverAccountNumber, amount }),
        });
        showAlert("Transferencia realizada.");
        event.target.reset();
        await loadCustomers();
        fillAccountSelects();
        document.getElementById("senderAccount").value = senderAccountNumber;
        document.getElementById("receiverAccount").value = receiverAccountNumber;
    } catch (error) {
        showAlert(error.message, "error");
    }
});

document.getElementById("history-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await renderHistory(document.getElementById("history-customer").value);
    } catch (error) {
        showAlert(error.message, "error");
    }
});

loadCustomers().catch((error) => showAlert(error.message, "error"));
