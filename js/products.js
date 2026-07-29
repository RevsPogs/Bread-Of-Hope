(() => {
    "use strict";

    const productContainer = document.getElementById("productContainer");
    const searchInput = document.getElementById("searchInput");
    const productCount = document.getElementById("productCount");
    const noProducts = document.getElementById("noProducts");
    const clearSearch = document.getElementById("clearSearch");
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");
    let products = [];
    let toastTimer;

    if (!productContainer || !window.BreadOfHope) return;

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        })[character]);
    }

    async function loadProducts() {
        const allProducts = await window.BreadOfHope.readProducts();
        products = allProducts.filter((product) => product.available !== false);
    }

    function createProductCard(product) {
        const isOutOfStock = product.stock <= 0;
        const buttonHtml = isOutOfStock 
            ? `<button class="btn btn-secondary btn-block" disabled>Out of Stock</button>`
            : `<button class="btn btn-primary btn-block add-cart" type="button" data-product-id="${escapeHTML(product.id)}">
                <span>Add to cart</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h15l-2 8H8L6 4H3M9 20h.01M18 20h.01"/></svg>
               </button>`;

        return `
            <article class="product-card catalog-card reveal is-visible" data-product-id="${escapeHTML(product.id)}">
                <div class="product-image-wrap">
                    <img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy">
                    <span class="product-badge">${escapeHTML(product.badge)}</span>
                </div>
                <div class="product-card-body">
                    <div class="product-title-row">
                        <h2>${escapeHTML(product.name)}</h2>
                        <span>${window.BreadOfHope.formatMoney(product.price)}</span>
                    </div>
                    <p>${escapeHTML(product.description)}</p>
                    ${buttonHtml}
                </div>
            </article>
        `;
    }

    function renderProducts(query = "") {
        const normalizedQuery = query.trim().toLowerCase();
        const filteredProducts = products.filter((product) => {
            const searchableText = `${product.name} ${product.description} ${product.badge}`.toLowerCase();
            return searchableText.includes(normalizedQuery);
        });

        productContainer.innerHTML = filteredProducts.map(createProductCard).join("");
        if (productCount) productCount.textContent = `${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"}`;
        if (noProducts) noProducts.hidden = filteredProducts.length !== 0;
        productContainer.hidden = filteredProducts.length === 0;

        window.BreadOfHope.initializeImageFallbacks(productContainer);
    }

    function showToast(message) {
        if (!toast || !toastMessage) return;
        window.clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toast.classList.add("is-visible");
        toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
    }

    function addToCart(productId) {
        const product = products.find((item) => item.id === productId);
        if (!product) return;

        const cart = window.BreadOfHope.readCart();
        const existingItem = cart.find((item) => item.id === product.id || item.name === product.name);

        if (existingItem) {
            existingItem.quantity = Number(existingItem.quantity || 0) + 1;
            existingItem.id = product.id;
            existingItem.name = product.name;
            existingItem.price = product.price;
            existingItem.image = product.image_url;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image_url,
                quantity: 1
            });
        }

        window.BreadOfHope.saveCart(cart);
        showToast(`${product.name} added to cart successfully!`);
    }

    productContainer.addEventListener("click", (event) => {
        const button = event.target.closest(".add-cart");
        if (!button) return;
        addToCart(button.dataset.productId);
    });

    searchInput?.addEventListener("input", (event) => renderProducts(event.target.value));
    clearSearch?.addEventListener("click", () => {
        if (!searchInput) return;
        searchInput.value = "";
        searchInput.focus();
        renderProducts();
    });

    window.addEventListener("storage", (event) => {
        if (event.key === window.BreadOfHope.PRODUCT_KEY) {
            loadProducts();
            renderProducts(searchInput?.value || "");
        }
    });

    window.addEventListener("breadOfHopeProductsUpdated", () => {
        loadProducts();
        renderProducts(searchInput?.value || "");
    });

    loadProducts();
    renderProducts();
})();