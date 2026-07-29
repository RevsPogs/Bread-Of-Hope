(() => {
    "use strict";
    const api = window.BreadOfHope;
    if (!api) return;

    const form = document.getElementById("checkoutForm");
    const summaryContainer = document.getElementById("orderSummary");
    const subtotalElement = document.getElementById("checkoutSubtotal");
    const totalElement = document.getElementById("checkoutTotal");
    const successOverlay = document.getElementById("successOverlay");
    const referenceElement = document.getElementById("orderReference");

    function normalizedCart() {
        return api.readCart();
    }

    function renderSummary() {
        const cart = normalizedCart();
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        if (summaryContainer) {
            if (!cart.length) {
                summaryContainer.innerHTML = '<div class="checkout-empty"><span>♡</span><h3>Your cart is empty</h3><p>Add products before submitting an order.</p><a href="products.html">Browse products →</a></div>';
            } else {
                summaryContainer.innerHTML = cart.map((item) => `
                    <article class="checkout-item">
                        <div class="checkout-item-image"><img src="${api.escapeHTML(item.image)}" alt="${api.escapeHTML(item.name)}"></div>
                        <div><h3>${api.escapeHTML(item.name)}</h3><p>${item.quantity} × ${api.formatMoney(item.price)}</p></div>
                        <strong>${api.formatMoney(item.price * item.quantity)}</strong>
                    </article>`).join("");
                api.initializeImageFallbacks(summaryContainer);
            }
        }

        if (subtotalElement) subtotalElement.textContent = api.formatMoney(total);
        if (totalElement) totalElement.textContent = api.formatMoney(total);
    }

    function generateReference() {
        const date = new Date();
        const dateCode = `${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
        const random = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `BOH-${dateCode}-${random}`;
    }

    function showFieldErrors() {
        form?.querySelectorAll("input, textarea").forEach((field) => {
            field.classList.toggle("has-error", !field.checkValidity());
        });
    }

    form?.addEventListener("input", (event) => {
        if (event.target.matches("input, textarea")) event.target.classList.remove("has-error");
    });

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const cart = normalizedCart();

        if (!cart.length) {
            window.alert("Your cart is empty. Add products before checkout.");
            return;
        }

        if (!form.checkValidity()) {
            showFieldErrors();
            form.reportValidity();
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const originalContent = submitButton?.innerHTML || "Place order";
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Submitting order...";
        }

        try {
            const reference = generateReference();
            const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
            await api.addOrder({
                reference,
                customerName: form.elements.customerName.value.trim(),
                section: form.elements.section.value.trim(),
                contact: form.elements.contact.value.trim(),
                notes: form.elements.notes.value.trim(),
                items: cart,
                total,
                status: "Pending",
                createdAt: new Date().toISOString()
            });

            api.saveCart([]);
            if (referenceElement) referenceElement.textContent = reference;
            if (successOverlay) successOverlay.hidden = false;
            form.reset();
            renderSummary();
        } catch (error) {
            console.error("Order submission failed:", error);
            window.alert(`Order failed: ${error.message}`);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalContent;
            }
        }
    });

    window.addEventListener("breadOfHopeCartUpdated", renderSummary);
    window.addEventListener("storage", (event) => {
        if (event.key === api.CART_KEY) renderSummary();
    });

    renderSummary();
})();