(() => {
    "use strict";

    const api = window.BreadOfHope;
    if (!api) {
        console.error("Bread of Hope core script failed to load.");
        return;
    }

    const SESSION_KEY = "breadOfHopeAdminSession";
    const VALID_STATUSES = ["Pending", "Preparing", "Ready", "Completed", "Cancelled"];

    const loginScreen = document.getElementById("adminLoginScreen");
    const loginForm = document.getElementById("adminLoginForm");
    const emailInput = document.getElementById("adminEmail");
    const passwordInput = document.getElementById("adminPassword");
    const loginError = document.getElementById("adminLoginError");
    const passwordToggle = document.getElementById("passwordToggle");
    const dashboard = document.getElementById("adminDashboard");
    const toast = document.getElementById("adminToast");
    const toastMessage = document.getElementById("adminToastMessage");

    let orders = [];
    let products = [];
    let toastTimer;

    const byId = (id) => document.getElementById(id);

    function safeDate(value) {
        const date = value ? new Date(value) : new Date();
        return Number.isNaN(date.getTime()) ? new Date() : date;
    }

    function formatDate(value, includeTime = true) {
        const options = includeTime
            ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
            : { month: "short", day: "numeric", year: "numeric" };
        return new Intl.DateTimeFormat("en-PH", options).format(safeDate(value));
    }

    function statusClass(status) {
        return `status-${String(status || "Pending").toLowerCase()}`;
    }

    function showToast(message, icon = "✓") {
        if (!toast || !toastMessage) return;
        window.clearTimeout(toastTimer);
        const iconElement = toast.querySelector(".toast-icon");
        if (iconElement) iconElement.textContent = icon;
        toastMessage.textContent = message;
        toast.classList.add("is-visible");
        toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2500);
    }

    async function loadData() {
        const [fetchedOrders, fetchedProducts] = await Promise.all([
            api.readOrders(),
            api.readProducts()
        ]);
        orders = fetchedOrders.sort((a, b) => safeDate(b.createdAt) - safeDate(a.createdAt));
        products = fetchedProducts;
        renderAll();
    }

    async function showDashboard() {
        if (loginScreen) loginScreen.hidden = true;
        if (dashboard) dashboard.hidden = false;
        document.body.classList.add("admin-authenticated");
        await loadData();
        switchView("overview");

        const dateLabel = byId("adminTodayLabel");
        if (dateLabel) {
            dateLabel.textContent = new Intl.DateTimeFormat("en-PH", {
                month: "short",
                day: "numeric",
                year: "numeric"
            }).format(new Date());
        }
    }

    function logout(message = "") {
        sessionStorage.removeItem(SESSION_KEY);
        api.supabase.auth.signOut();
        if (dashboard) dashboard.hidden = true;
        if (loginScreen) loginScreen.hidden = false;
        document.body.classList.remove("admin-authenticated", "admin-sidebar-open", "modal-open");
        closeAllModals();
        loginForm?.reset();
        if (loginError) loginError.textContent = message;
        emailInput?.focus();
    }

    async function handleLogin(event) {
        event.preventDefault();
        const email = emailInput?.value.trim() || "";
        const password = passwordInput?.value || "";

        const { data, error } = await api.supabase.auth.signInWithPassword({ email, password });

        if (error) {
            if (loginError) loginError.textContent = "Incorrect email or password.";
            if (passwordInput) {
                passwordInput.value = "";
                passwordInput.focus();
            }
            return;
        }

        if (loginError) loginError.textContent = "";
        sessionStorage.setItem(SESSION_KEY, "true");
        await showDashboard();
    }

    function renderMetrics() {
        const totalOrders = orders.length;
        const pendingOrders = orders.filter((order) => order.status === "Pending").length;
        const activeProducts = products.filter((product) => product.available).length;
        const revenue = orders
            .filter((order) => order.status !== "Cancelled")
            .reduce((sum, order) => sum + Number(order.total || 0), 0);

        if (byId("metricTotalOrders")) byId("metricTotalOrders").textContent = String(totalOrders);
        if (byId("metricPendingOrders")) byId("metricPendingOrders").textContent = String(pendingOrders);
        if (byId("metricRevenue")) byId("metricRevenue").textContent = api.formatMoney(revenue);
        if (byId("metricProducts")) byId("metricProducts").textContent = String(activeProducts);
        if (byId("sidebarOrderCount")) byId("sidebarOrderCount").textContent = String(pendingOrders);
    }

    function renderRecentOrders() {
        const container = byId("recentOrdersList");
        if (!container) return;
        const recentOrders = orders.slice(0, 5);

        if (!recentOrders.length) {
            container.innerHTML = '<div class="admin-empty-mini"><span>○</span><p>No orders have been submitted yet.</p></div>';
            return;
        }

        container.innerHTML = recentOrders.map((order) => `
            <button type="button" class="admin-recent-order" data-order-action="details" data-order-id="${api.escapeHTML(order.id)}">
                <span class="admin-order-avatar">${api.escapeHTML(order.customerName.charAt(0).toUpperCase())}</span>
                <span class="admin-recent-copy"><strong>${api.escapeHTML(order.customerName)}</strong><small>${api.escapeHTML(order.reference)} · ${formatDate(order.createdAt, false)}</small></span>
                <strong class="admin-recent-total">${api.formatMoney(order.total)}</strong>
                <span class="admin-status-pill ${statusClass(order.status)}">${api.escapeHTML(order.status)}</span>
            </button>`).join("");
    }

    function renderStatusBreakdown() {
        const container = byId("statusBreakdown");
        if (!container) return;
        const total = orders.length || 1;

        container.innerHTML = VALID_STATUSES.map((status) => {
            const count = orders.filter((order) => order.status === status).length;
            const percentage = Math.round((count / total) * 100);
            return `
                <article class="admin-status-stat">
                    <div><span class="admin-status-dot ${statusClass(status)}"></span><div><strong>${status}</strong><small>${count} order${count === 1 ? "" : "s"}</small></div></div>
                    <div class="admin-status-progress"><span style="width:${percentage}%"></span></div>
                    <b>${percentage}%</b>
                </article>`;
        }).join("");
    }

    function getFilteredOrders() {
        const search = byId("adminOrderSearch")?.value.trim().toLowerCase() || "";
        const selectedStatus = byId("adminStatusFilter")?.value || "all";

        return orders.filter((order) => {
            const searchable = `${order.reference} ${order.customerName} ${order.contact} ${order.section}`.toLowerCase();
            const matchesSearch = !search || searchable.includes(search);
            const matchesStatus = selectedStatus === "all" || order.status === selectedStatus;
            return matchesSearch && matchesStatus;
        });
    }

    function renderOrdersTable() {
        const tableBody = byId("adminOrdersTableBody");
        const emptyState = byId("adminOrdersEmpty");
        const resultCount = byId("adminOrderResultCount");
        if (!tableBody) return;

        const results = getFilteredOrders();
        if (resultCount) resultCount.textContent = `${results.length} order${results.length === 1 ? "" : "s"}`;
        if (emptyState) emptyState.hidden = results.length !== 0;

        tableBody.innerHTML = results.map((order) => {
            const quantity = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
            const itemNames = order.items.slice(0, 2).map((item) => item.name).join(", ");
            const time = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(safeDate(order.createdAt));

            return `
                <tr>
                    <td><button class="admin-order-reference" type="button" data-order-action="details" data-order-id="${api.escapeHTML(order.id)}">${api.escapeHTML(order.reference)}</button></td>
                    <td><div class="admin-customer-cell"><span>${api.escapeHTML(order.customerName.charAt(0).toUpperCase())}</span><div><strong>${api.escapeHTML(order.customerName)}</strong><small>${api.escapeHTML(order.section)}</small></div></div></td>
                    <td><strong>${quantity} item${quantity === 1 ? "" : "s"}</strong><small class="admin-item-names">${api.escapeHTML(itemNames || "No item details")}</small></td>
                    <td><strong>${api.formatMoney(order.total)}</strong></td>
                    <td>
                        <select class="admin-status-select ${statusClass(order.status)}" data-order-id="${api.escapeHTML(order.id)}" aria-label="Status for ${api.escapeHTML(order.reference)}">
                            ${VALID_STATUSES.map((status) => `<option value="${status}" ${status === order.status ? "selected" : ""}>${status}</option>`).join("")}
                        </select>
                    </td>
                    <td><strong>${formatDate(order.createdAt, false)}</strong><small>${time}</small></td>
                    <td><div class="admin-row-actions"><button type="button" data-order-action="details" data-order-id="${api.escapeHTML(order.id)}">View</button><button class="is-danger" type="button" data-order-action="delete" data-order-id="${api.escapeHTML(order.id)}">Delete</button></div></td>
                </tr>`;
        }).join("");
    }

    function renderProductsView() {
        const grid = byId("adminProductsGrid");
        if (byId("productSummaryTotal")) byId("productSummaryTotal").textContent = String(products.length);
        if (byId("productSummaryActive")) byId("productSummaryActive").textContent = String(products.filter((product) => product.available).length);
        if (byId("productSummaryHidden")) byId("productSummaryHidden").textContent = String(products.filter((product) => !product.available).length);
        if (byId("sidebarProductCount")) byId("sidebarProductCount").textContent = String(products.length);
        if (!grid) return;

        if (!products.length) {
            grid.innerHTML = '<div class="admin-products-empty"><span>＋</span><h3>No products yet</h3><p>Add the first product to begin building the catalog.</p></div>';
            return;
        }

        grid.innerHTML = products.map((product) => `
            <article class="admin-product-card ${product.available ? "" : "is-hidden-product"}">
                <div class="admin-product-image">
                    <img src="${api.escapeHTML(product.image_url)}" alt="${api.escapeHTML(product.name)}">
                    <span class="admin-product-availability">${product.available ? "Active" : "Hidden"}</span>
                </div>
                <div class="admin-product-card-body">
                    <div class="admin-product-title"><div><span>${api.escapeHTML(product.badge || "Freshly baked")}</span><h3>${api.escapeHTML(product.name)}</h3></div><strong>${api.formatMoney(product.price)}</strong></div>
                    <p>${api.escapeHTML(product.description)}</p>
                    <p style="margin-top:6px; font-size:0.8rem; color:var(--muted);"><strong>Stock:</strong> ${product.stock || 0}</p>
                    <div class="admin-product-actions"><button type="button" data-product-action="edit" data-product-id="${api.escapeHTML(product.id)}">Edit</button><button class="is-danger" type="button" data-product-action="delete" data-product-id="${api.escapeHTML(product.id)}">Delete</button></div>
                </div>
            </article>`).join("");

        api.initializeImageFallbacks(grid);
    }

    function renderAll() {
        renderMetrics();
        renderRecentOrders();
        renderStatusBreakdown();
        renderOrdersTable();
        renderProductsView();
    }

    function getOrder(orderId) {
        return orders.find((order) => order.id === orderId);
    }

    function openOrderDetails(orderId) {
        const order = getOrder(orderId);
        const modal = byId("orderDetailsModal");
        const content = byId("orderModalContent");
        if (!order || !modal || !content) return;

        content.innerHTML = `
            <div class="admin-order-modal-heading">
                <div><span class="eyebrow">Order details</span><h2>${api.escapeHTML(order.reference)}</h2><p>Submitted ${formatDate(order.createdAt)}</p></div>
                <span class="admin-status-pill ${statusClass(order.status)}">${api.escapeHTML(order.status)}</span>
            </div>
            <div class="admin-order-customer-grid">
                <div><span>Customer</span><strong>${api.escapeHTML(order.customerName)}</strong></div>
                <div><span>Section or room</span><strong>${api.escapeHTML(order.section)}</strong></div>
                <div><span>Contact</span><strong>${api.escapeHTML(order.contact)}</strong></div>
                <div><span>Total items</span><strong>${order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</strong></div>
            </div>
            <div class="admin-modal-items">
                <h3>Products ordered</h3>
                ${order.items.length ? order.items.map((item) => `
                    <article><img src="${api.escapeHTML(item.image)}" alt="${api.escapeHTML(item.name)}"><div><strong>${api.escapeHTML(item.name)}</strong><small>${item.quantity} × ${api.formatMoney(item.price)}</small></div><b>${api.formatMoney(item.price * item.quantity)}</b></article>`).join("") : "<p>No products listed.</p>"}
            </div>
            <div class="admin-order-notes"><span>Customer notes</span><p>${api.escapeHTML(order.notes || "No additional notes were provided.")}</p></div>
            <div class="admin-order-total"><span>Order total</span><strong>${api.formatMoney(order.total)}</strong></div>
            <div class="admin-modal-actions"><button class="btn btn-secondary" type="button" data-close-modal="orderDetailsModal">Close</button></div>`;

        api.initializeImageFallbacks(content);
        openModal(modal);
    }

    function openProductEditor(productId = null) {
        const modal = byId("productEditorModal");
        const form = byId("productEditorForm");
        const title = byId("productModalTitle");
        if (!modal || !form || !title) return;

        form.reset();
        if (byId("productEditorError")) byId("productEditorError").textContent = "";
        byId("productEditId").value = "";
        byId("productEditAvailable").checked = true;
        byId("productEditImage").required = true; // required for new product

        if (productId) {
            const product = products.find((item) => item.id === productId);
            if (!product) return;
            title.textContent = "Edit Product";
            byId("productEditId").value = product.id;
            byId("productEditName").value = product.name;
            byId("productEditPrice").value = product.price;
            byId("productEditStock").value = product.stock || 0; // Load Stock
            byId("productEditBadge").value = product.badge || "";
            byId("productEditImage").required = false; // not required for edit
            byId("productEditDescription").value = product.description || "";
            byId("productEditAvailable").checked = product.available;
        } else {
            title.textContent = "Add New Product";
        }

        openModal(modal);
    }

    async function handleProductFormSubmit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const errorElement = byId("productEditorError");

        if (!form.checkValidity()) {
            if (errorElement) errorElement.textContent = "Complete all required product fields.";
            form.reportValidity();
            return;
        }

        const id = byId("productEditId").value;
        const price = Number(byId("productEditPrice").value);
        if (!Number.isFinite(price) || price < 0) {
            if (errorElement) errorElement.textContent = "Enter a valid product price.";
            byId("productEditPrice").focus();
            return;
        }

        const fileInput = byId("productEditImage");
        const file = fileInput.files[0];
        let imageUrl = "";
        
        // If editing and no new file, we keep the existing image (will be sent in productData)
        if (file) {
            try {
                const filePath = `products/${Date.now()}_${file.name}`;
                const { error: uploadError } = await api.supabase.storage
                    .from('product-images')
                    .upload(filePath, file);
                if (uploadError) throw uploadError;
                const { data: publicUrlData } = api.supabase.storage
                    .from('product-images')
                    .getPublicUrl(filePath);
                imageUrl = publicUrlData.publicUrl;
            } catch (uploadError) {
                if (errorElement) errorElement.textContent = `Image upload failed: ${uploadError.message}`;
                return;
            }
        }

        // If editing, we might keep old image. If new product, we need imageUrl.
        let existingProduct = null;
        if (id) existingProduct = products.find((p) => p.id === id);
        
        if (!imageUrl && !existingProduct) {
            if (errorElement) errorElement.textContent = "Please select an image for the product.";
            return;
        }

        const product = {
            ...(id && { id: id }),
            name: byId("productEditName").value.trim(),
            price,
            badge: byId("productEditBadge").value.trim() || "Freshly baked",
            image_url: imageUrl || (existingProduct ? existingProduct.image_url : ""),
            description: byId("productEditDescription").value.trim(),
            available: byId("productEditAvailable").checked,
            stock: Number(byId("productEditStock").value) || 0 // Save Stock
        };

        try {
            await api.saveProducts([product]);
            closeModal(byId("productEditorModal"));
            await loadData();
            renderProductsView();
            renderMetrics();
            showToast(id ? "Product updated successfully." : "Product added successfully.");
        } catch (saveError) {
            if (errorElement) errorElement.textContent = saveError.message;
        }
    }

    function openModal(modal) {
        if (!modal) return;
        modal.hidden = false;
        document.body.classList.add("modal-open");
        modal.querySelector("button, input, select, textarea")?.focus();
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.hidden = true;
        const anotherModalIsOpen = [...document.querySelectorAll(".admin-modal-backdrop")].some((item) => !item.hidden);
        if (!anotherModalIsOpen) document.body.classList.remove("modal-open");
    }

    function closeAllModals() {
        document.querySelectorAll(".admin-modal-backdrop").forEach((modal) => {
            modal.hidden = true;
        });
        document.body.classList.remove("modal-open");
    }

    function switchView(viewName) {
        const titles = {
            overview: "Dashboard Overview",
            orders: "Order Management",
            products: "Product Catalog"
        };

        document.querySelectorAll("[data-view-panel]").forEach((panel) => {
            const isActive = panel.dataset.viewPanel === viewName;
            panel.hidden = !isActive;
            panel.classList.toggle("is-active", isActive);
        });

        document.querySelectorAll(".admin-nav-link[data-admin-view]").forEach((button) => {
            button.classList.toggle("is-active", button.dataset.adminView === viewName);
        });

        if (byId("adminPageTitle")) byId("adminPageTitle").textContent = titles[viewName] || "Admin Dashboard";
        document.body.classList.remove("admin-sidebar-open");
        if (viewName === "orders") renderOrdersTable();
        if (viewName === "products") renderProductsView();
    }

    loginForm?.addEventListener("submit", handleLogin);

    passwordToggle?.addEventListener("click", () => {
        if (!passwordInput) return;
        const isVisible = passwordInput.type === "text";
        passwordInput.type = isVisible ? "password" : "text";
        passwordToggle.textContent = isVisible ? "Show" : "Hide";
    });

    byId("adminLogoutButton")?.addEventListener("click", () => logout("You have been logged out."));
    byId("adminMenuButton")?.addEventListener("click", () => document.body.classList.add("admin-sidebar-open"));
    byId("adminSidebarClose")?.addEventListener("click", () => document.body.classList.remove("admin-sidebar-open"));
    byId("addProductButton")?.addEventListener("click", () => openProductEditor());
    byId("productEditorForm")?.addEventListener("submit", handleProductFormSubmit);
    byId("adminOrderSearch")?.addEventListener("input", renderOrdersTable);
    byId("adminStatusFilter")?.addEventListener("change", renderOrdersTable);

    document.addEventListener("change", async (event) => {
        const select = event.target.closest(".admin-status-select");
        if (!select) return;

        const updated = await api.updateOrder(select.dataset.orderId, { status: select.value });
        if (!updated) {
            showToast("The order status could not be updated.", "!");
            await loadData();
            return;
        }

        showToast(`Order marked as ${select.value}.`);
        await loadData();
    });

    document.addEventListener("click", async (event) => {
        const viewButton = event.target.closest("[data-admin-view]");
        if (viewButton) switchView(viewButton.dataset.adminView);

        const orderButton = event.target.closest("[data-order-action]");
        if (orderButton) {
            const orderId = orderButton.dataset.orderId;
            if (orderButton.dataset.orderAction === "details") openOrderDetails(orderId);
            if (orderButton.dataset.orderAction === "delete" && window.confirm("Delete this order permanently?")) {
                const success = await api.deleteOrder(orderId);
                if (success) {
                    showToast("Order deleted.");
                    await loadData();
                } else {
                    showToast("The order could not be deleted.", "!");
                }
            }
        }

        const productButton = event.target.closest("[data-product-action]");
        if (productButton) {
            const productId = productButton.dataset.productId;
            if (productButton.dataset.productAction === "edit") openProductEditor(productId);
            if (productButton.dataset.productAction === "delete" && window.confirm("Delete this product from the catalog?")) {
                const { error } = await api.supabase.from('products').delete().eq('id', productId);
                if (!error) {
                    await loadData();
                    showToast("Product deleted.");
                } else {
                    showToast("Failed to delete product.", "!");
                }
            }
        }

        const closeButton = event.target.closest("[data-close-modal]");
        if (closeButton) closeModal(byId(closeButton.dataset.closeModal));
        if (event.target.classList.contains("admin-modal-backdrop")) closeModal(event.target);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        document.body.classList.remove("admin-sidebar-open");
        const openModalElement = [...document.querySelectorAll(".admin-modal-backdrop")].find((modal) => !modal.hidden);
        if (openModalElement) closeModal(openModalElement);
    });

    api.supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            if (sessionStorage.getItem(SESSION_KEY) !== "true") {
                sessionStorage.setItem(SESSION_KEY, "true");
                showDashboard();
            }
        } else if (event === 'SIGNED_OUT') {
            sessionStorage.removeItem(SESSION_KEY);
            if (loginScreen) loginScreen.hidden = false;
            if (dashboard) dashboard.hidden = true;
        }
    });

    if (sessionStorage.getItem(SESSION_KEY) === "true") {
        showDashboard();
    } else {
        if (loginScreen) loginScreen.hidden = false;
        if (dashboard) dashboard.hidden = true;
        emailInput?.focus();
    }
})();