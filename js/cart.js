document.addEventListener("DOMContentLoaded", () => {
    "use strict";
    if (!window.BreadOfHope) return;

    const { readCart, saveCart, formatMoney, escapeHTML, initializeImageFallbacks } = window.BreadOfHope;
    const cartContainer = document.getElementById("cartItems");
    const totalItems = document.getElementById("totalItems");
    const subtotal = document.getElementById("subtotal");
    const grandTotal = document.getElementById("grandTotal");
    const clearCartButton = document.getElementById("clearCart");
    const checkoutButton = document.getElementById("checkoutButton");
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");
    let toastTimer;

    function showToast(message) {
        if (!toast || !toastMessage) return;
        window.clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toast.classList.add("is-visible");
        toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
    }

    function normalizeCart() {
        return readCart().map((item, index) => ({
            id: String(item?.id || `cart-item-${index}`),
            name: String(item?.name || "Bakery product"),
            price: Math.max(0, Number(item?.price) || 0),
            image: String(item?.image || "images/logo.jpg"),
            quantity: Math.max(1, Number(item?.quantity) || 1)
        }));
    }

    function setCheckoutState(enabled) {
        if (!checkoutButton) return;
        checkoutButton.classList.toggle("is-disabled", !enabled);
        checkoutButton.setAttribute("aria-disabled", String(!enabled));
        checkoutButton.tabIndex = enabled ? 0 : -1;
    }

    function renderCart() {
        if (!cartContainer) return;
        const cart = normalizeCart();
        saveCart(cart);

        if (!cart.length) {
            cartContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">♡</div><h2>Your cart is empty</h2><p>Add products from the menu before continuing to checkout.</p><a class="btn btn-primary" href="products.html">Browse products</a></div>';
            if (totalItems) totalItems.textContent = "0";
            if (subtotal) subtotal.textContent = formatMoney(0);
            if (grandTotal) grandTotal.textContent = formatMoney(0);
            setCheckoutState(false);
            if (clearCartButton) clearCartButton.disabled = true;
            return;
        }

        if (clearCartButton) clearCartButton.disabled = false;
        setCheckoutState(true);
        let totalQuantity = 0;
        let totalPrice = 0;

        cartContainer.innerHTML = cart.map((item, index) => {
            const itemTotal = item.price * item.quantity;
            totalQuantity += item.quantity;
            totalPrice += itemTotal;
            return `
                <article class="cart-item" data-cart-index="${index}">
                    <div class="cart-item-image"><img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}"></div>
                    <div class="cart-item-info"><span class="cart-item-label">Bread of Hope product</span><h3>${escapeHTML(item.name)}</h3><p>${formatMoney(item.price)} each</p><button class="remove-item" type="button" data-cart-action="remove">Remove</button></div>
                    <div class="quantity-control" aria-label="Quantity for ${escapeHTML(item.name)}"><button type="button" data-cart-action="decrease" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-cart-action="increase" aria-label="Increase quantity">+</button></div>
                    <strong class="cart-item-subtotal">${formatMoney(itemTotal)}</strong>
                </article>`;
        }).join("");

        initializeImageFallbacks(cartContainer);
        if (totalItems) totalItems.textContent = String(totalQuantity);
        if (subtotal) subtotal.textContent = formatMoney(totalPrice);
        if (grandTotal) grandTotal.textContent = formatMoney(totalPrice);
    }

    cartContainer?.addEventListener("click", (event) => {
        const actionButton = event.target.closest("[data-cart-action]");
        const itemElement = event.target.closest("[data-cart-index]");
        if (!actionButton || !itemElement) return;
        const index = Number(itemElement.dataset.cartIndex);
        const cart = normalizeCart();
        if (!cart[index]) return;

        const action = actionButton.dataset.cartAction;
        if (action === "increase") cart[index].quantity += 1;
        if (action === "decrease") {
            if (cart[index].quantity > 1) cart[index].quantity -= 1;
            else cart.splice(index, 1);
        }
        if (action === "remove") cart.splice(index, 1);
        saveCart(cart);
        renderCart();
        showToast(action === "remove" ? "Product removed from your cart." : "Cart quantity updated.");
    });

    clearCartButton?.addEventListener("click", () => {
        if (!readCart().length) return;
        if (!window.confirm("Remove all products from your cart?")) return;
        saveCart([]);
        renderCart();
        showToast("Your cart has been cleared.");
    });

    checkoutButton?.addEventListener("click", (event) => {
        if (checkoutButton.getAttribute("aria-disabled") === "true") event.preventDefault();
    });

    window.addEventListener("breadOfHopeCartUpdated", () => {});
    window.addEventListener("storage", (event) => { if (event.key === window.BreadOfHope.CART_KEY) renderCart(); });
    renderCart();
});