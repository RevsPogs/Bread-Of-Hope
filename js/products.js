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

    // ============================================================
    // Handwritten Ingredients Map
    // ============================================================
    const INGREDIENTS_DATA = {
        "Cheesy Ensaymada": {
            groups: [
                { name: "Dough", items: ["Bread flour 3 cups (450g)", "All-purpose flour 1 cup (120g)", "Warm milk 1 cup (250ml)", "Sugar 1/4 cup (50g)", "Dry Yeast 2 1/4 tsp", "Egg yolks 6 large", "Salt 1 1/2 tsp", "Softened Butter 60g"] },
                { name: "Buttercream", items: ["Unsalted Butter 120g", "Vanilla Extract 1 tsp", "Grated Cheese 1 1/2 to 2 cups", "Granulated Sugar 1/4 cup", "Egg wash (1 egg with 2 tbsp milk)"] },
                { name: "Packaging", items: ["Plastic Wrap with box"] }
            ]
        },
        "Brownies": {
            groups: [
                { name: "Brownie Batter", items: ["Butter 1/2 cup", "Sugar 1 cup", "Eggs 2 large", "Vanilla Extract 2 tsp", "Cocoa Powder 2/3 cup", "Flour 3/4 cup", "Salt 1/2 tsp", "Chocolate Chips 1/2 to 1 cup"] },
                { name: "Packaging", items: ["Plastic Container with lid"] }
            ]
        },
        "Scoopable Cookies": {
            groups: [
                { name: "Cookie Dough", items: ["Unsalted Butter 1/2 cup (113g)", "Dark Brown Sugar 1/2 cup (100g)", "Granulated Sugar 1/4 cup (50g)", "1 Large Egg", "Vanilla Extract 1 tsp", "All-purpose Flour 1 1/2 cups", "Baking Soda 1 tsp", "Salt 1/2 tsp", "Chocolate Chips 1/2 cup"] },
                { name: "Packaging", items: ["Aluminum foil cake mold with lid", "Wooden spoon"] }
            ]
        }
    };
    // ============================================================

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
                    
                    <p style="margin-top:6px; font-size:0.8rem; color:var(--muted);"><strong>Stock:</strong> ${product.stock || 0}</p>
                    
                    <div class="product-actions">
                        ${buttonHtml}
                        <button class="icon-btn" data-view="${escapeHTML(product.id)}" aria-label="View ${escapeHTML(product.name)} details">ⓘ</button>
                    </div>
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

    // ============================================================
    // FIXED: Catalog Add to Cart (Forces a visual disabled state)
    // ============================================================
    function addToCart(productId, button) {
        if (button) {
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
        }

        const product = products.find((item) => item.id === productId);
        if (!product) {
            if (button) setTimeout(() => { button.disabled = false; button.removeAttribute('aria-disabled'); }, 150);
            return;
        }

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

        // Force a small delay before re-enabling so the disabled state renders on screen
        setTimeout(() => {
            if (button) {
                button.disabled = false;
                button.removeAttribute('aria-disabled');
            }
        }, 200);
    }
    // ============================================================

    function showProductDetails(productId) {
        const product = products.find((item) => item.id === productId);
        if (!product) return;

        const modal = document.getElementById("productViewModal");
        const content = document.getElementById("productViewContent");
        if (!modal || !content) return;

        const ingredientsHtml = renderIngredients(product.name);

        content.innerHTML = `
            <div class="product-detail-view">
                <div class="product-detail-image">
                    <img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy">
                </div>
                <div class="product-detail-info">
                    <span class="product-detail-badge">${escapeHTML(product.badge)}</span>
                    <h2>${escapeHTML(product.name)}</h2>
                    <p class="product-detail-price">${window.BreadOfHope.formatMoney(product.price)}</p>
                    <p class="product-detail-desc">${escapeHTML(product.description)}</p>
                    <p class="product-detail-stock"><strong>Stock:</strong> ${product.stock || 0}</p>
                    
                    ${ingredientsHtml}
                    
                    <button class="btn btn-primary btn-block add-cart" data-product-id="${escapeHTML(product.id)}">
                        Add to Cart
                    </button>
                </div>
            </div>
        `;
        modal.hidden = false;
        document.body.classList.add("modal-open");
    }

    function renderIngredients(productName) {
        const recipe = INGREDIENTS_DATA[productName];
        if (!recipe) return '';

        return `
            <div class="product-ingredients" style="margin-top:20px; padding:15px; background:var(--cream-soft); border-radius:16px; border:1px solid var(--border);">
                <h4 style="font-size:1rem; margin-bottom:12px; color:var(--coffee-dark);">📝 Handwritten Recipe</h4>
                ${recipe.groups.map(group => `
                    <div style="margin-bottom:12px;">
                        <strong style="font-size:0.85rem; color:var(--taupe); display:block;">${escapeHTML(group.name)}</strong>
                        <ul style="padding-left:18px; margin-top:4px; list-style-type:disc; color:var(--text); font-size:0.85rem; line-height:1.6;">
                            ${group.items.map(item => `<li>${escapeHTML(item)}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        `;
    }

    productContainer.addEventListener("click", (event) => {
        const addBtn = event.target.closest(".add-cart");
        const viewBtn = event.target.closest("[data-view]");
        
        if (addBtn) addToCart(addBtn.dataset.productId, addBtn);
        if (viewBtn) showProductDetails(viewBtn.dataset.view);
    });

    document.addEventListener("click", (event) => {
        const closeBtn = event.target.closest("[data-close-view]");
        if (closeBtn) {
            const modal = document.getElementById("productViewModal");
            if (modal) { modal.hidden = true; document.body.classList.remove("modal-open"); }
        }
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

    (async () => {
        await loadProducts();
        renderProducts();
    })();
})();