(() => {
    "use strict";
    document.documentElement.classList.add("js");

    const SUPABASE_URL = "https://huepdjpisfokeglqyxjf.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1ZXBkanBpc2Zva2VnbHF5eGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMjM5MDIsImV4cCI6MjEwMDg5OTkwMn0.fNECSG0vPc0ssXZ3JTjJX5XVNz4yVvylaBlGadNRYFo";
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- Realtime Setup ---
    // Subscribe to product updates so stock numbers stay live across all devices
    supabase.channel('products-channel')
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'products' }, 
            (payload) => {
                // Dispatch an event to tell the pages (Home, Products) to refresh their UI
                window.dispatchEvent(new CustomEvent('breadOfHopeProductsUpdated', { detail: [payload.new] }));
            }
        )
        .subscribe();

    const CART_KEY = "breadOfHopeCart";
    const LEGACY_CART_KEY = "cart";

    const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
    })[character]);

    const safeJSONParse = (value, fallback) => {
        try { return JSON.parse(value); } catch { return fallback; }
    };

    const normalizeCartItem = (item, index = 0) => {
        const price = Number(item?.price);
        const quantity = Number(item?.quantity);
        return {
            id: String(item?.id || `cart-item-${index}`),
            name: String(item?.name || "Bakery product"),
            price: Number.isFinite(price) && price >= 0 ? price : 0,
            image: String(item?.image || "images/logo.jpg"),
            quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1
        };
    };

    const migrateLegacyCart = () => {
        const modernCart = safeJSONParse(localStorage.getItem(CART_KEY), null);
        if (Array.isArray(modernCart)) return modernCart.map(normalizeCartItem);
        const legacyCart = safeJSONParse(localStorage.getItem(LEGACY_CART_KEY), []);
        const migrated = Array.isArray(legacyCart) ? legacyCart.map(normalizeCartItem) : [];
        localStorage.setItem(CART_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_CART_KEY);
        return migrated;
    };

    const readCart = () => migrateLegacyCart();

    const saveCart = (cart) => {
        const normalized = Array.isArray(cart) ? cart.map(normalizeCartItem) : [];
        localStorage.setItem(CART_KEY, JSON.stringify(normalized));
        localStorage.removeItem(LEGACY_CART_KEY);
        updateCartCount(normalized);
        window.dispatchEvent(new CustomEvent("breadOfHopeCartUpdated", { detail: normalized }));
        return normalized;
    };

    const getCartQuantity = (cart = readCart()) => {
        return cart.reduce((total, item) => total + Number(item.quantity || 0), 0);
    };

    const updateCartCount = (cart = readCart()) => {
        const count = getCartQuantity(cart);
        document.querySelectorAll("[data-cart-count]").forEach((badge) => {
            badge.textContent = String(count);
            badge.classList.toggle("has-items", count > 0);
            badge.setAttribute("aria-label", `${count} item${count === 1 ? "" : "s"} in cart`);
        });
    };

    const readProducts = async () => {
        const { data, error } = await supabase.from('products').select('*').order('name');
        if (error) {
            console.error("Supabase readProducts error:", error);
            return [];
        }
        return data;
    };

    const saveProducts = async (products) => {
        const { data, error } = await supabase.from('products').upsert(products, { onConflict: 'id' }).select();
        if (error) throw new Error(`Failed to save products: ${error.message}`);
        window.dispatchEvent(new CustomEvent("breadOfHopeProductsUpdated", { detail: data }));
        return data;
    };

    const readOrders = async () => {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id, reference, customer_name, section, contact, notes, total, status, created_at, updated_at,
                order_items ( id, product_id, name, price, quantity, image_url )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Supabase readOrders error:", error);
            return [];
        }

        return orders.map(order => ({
            id: order.id,
            reference: order.reference,
            customerName: order.customer_name,
            section: order.section,
            contact: order.contact,
            notes: order.notes,
            total: order.total,
            status: order.status,
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            items: order.order_items.map(item => ({
                id: item.product_id || `item-${item.id}`,
                name: item.name,
                price: item.price,
                image: item.image_url,
                quantity: item.quantity
            }))
        }));
    };

    const addOrder = async (order) => {
        // Call the Supabase SQL RPC function
        const { data, error } = await supabase
            .rpc('place_order_with_stock', {
                p_reference: order.reference,
                p_customer_name: order.customerName,
                p_section: order.section,
                p_contact: order.contact,
                p_notes: order.notes,
                p_total: order.total,
                p_items: order.items
            });
        
        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.message);
        
        // Fetch the newly created order to return it
        const { data: newOrder } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', data.order_id)
            .single();

        window.dispatchEvent(new CustomEvent("breadOfHopeOrdersUpdated", { detail: [newOrder] }));
        return newOrder;
    };

    const updateOrder = async (orderId, updates) => {
        const { data, error } = await supabase
            .from('orders')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', orderId)
            .select()
            .single();
        if (error) return null;
        window.dispatchEvent(new CustomEvent("breadOfHopeOrdersUpdated", { detail: [data] }));
        return data;
    };

    const deleteOrder = async (orderId) => {
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) return false;
        window.dispatchEvent(new CustomEvent("breadOfHopeOrdersUpdated"));
        return true;
    };

    const formatMoney = (value) => {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Number(value) || 0);
    };

    const initializeImageFallbacks = (root = document) => {
        root.querySelectorAll("img").forEach((image) => {
            if (image.dataset.fallbackBound === "true") return;
            image.dataset.fallbackBound = "true";
            image.addEventListener("error", () => {
                if (!image.src.endsWith("images/logo.jpg")) image.src = "images/logo.jpg";
                image.classList.add("image-missing");
            }, { once: true });
        });
    };

    function initializeWelcomeScreen() {
        const screen = document.getElementById("welcomeScreen");
        const button = document.getElementById("enterWebsite");
        // If the user has already clicked "Enter" in this session, instantly hide the screen
        if (sessionStorage.getItem("breadOfHopeEntered") === "true") {
            document.body.classList.remove("welcome-open");
            if (screen) screen.hidden = true;
            return;
        }
        if (!screen || !button) {
            document.body.classList.remove("welcome-open");
            return;
        }
        const enter = () => {
            if (screen.classList.contains("is-leaving")) return;
            sessionStorage.setItem("breadOfHopeEntered", "true");
            screen.classList.add("is-leaving");
            document.body.classList.remove("welcome-open");
            window.setTimeout(() => {
                screen.hidden = true;
                document.querySelector(".site-header a, main a, main button")?.focus({ preventScroll: true });
            }, 650);
        };
        button.addEventListener("click", enter);
        document.addEventListener("keydown", (event) => {
            if (!screen.hidden && (event.key === "Enter" || event.key === "Escape")) enter();
        });
        window.setTimeout(() => button.focus({ preventScroll: true }), 650);
    }

    function initializeNavigation() {
        const toggle = document.querySelector(".nav-toggle");
        const panel = document.querySelector(".nav-panel");
        if (!toggle || !panel) return;
        const closeNavigation = () => {
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Open navigation menu");
            panel.classList.remove("is-open");
            document.body.classList.remove("menu-open");
        };
        toggle.addEventListener("click", () => {
            const shouldOpen = toggle.getAttribute("aria-expanded") !== "true";
            toggle.setAttribute("aria-expanded", String(shouldOpen));
            toggle.setAttribute("aria-label", shouldOpen ? "Close navigation menu" : "Open navigation menu");
            panel.classList.toggle("is-open", shouldOpen);
            document.body.classList.toggle("menu-open", shouldOpen);
        });
        panel.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNavigation));
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeNavigation();
        });
        window.addEventListener("resize", () => {
            if (window.innerWidth > 900) closeNavigation();
        });
    }

    function initializeHeader() {
        const header = document.querySelector(".site-header");
        if (!header) return;
        const updateHeader = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
        updateHeader();
        window.addEventListener("scroll", updateHeader, { passive: true });
    }

    function initializeRevealAnimations() {
        const elements = document.querySelectorAll(".reveal");
        if (!elements.length) return;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion || !("IntersectionObserver" in window)) {
            elements.forEach((element) => element.classList.add("is-visible"));
            return;
        }
        const observer = new IntersectionObserver((entries, activeObserver) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                activeObserver.unobserve(entry.target);
            });
        }, { threshold: 0.1, rootMargin: "0px 0px -35px" });
        elements.forEach((element, index) => {
            element.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 70}ms`);
            observer.observe(element);
        });
    }

    function initializeYear() {
        document.querySelectorAll("[data-current-year]").forEach((element) => {
            element.textContent = String(new Date().getFullYear());
        });
    }

    const renderHomeProducts = async () => {
        const grid = document.getElementById("homeProductGrid");
        if (!grid) return;
        const products = (await readProducts()).filter((product) => product.available !== false).slice(0, 3);

        if (!products.length) {
            grid.innerHTML = '<div class="empty-state"><h2>No products are available yet</h2><p>Please check the menu again later.</p></div>';
            return;
        }

        grid.innerHTML = products.map((product) => {
            const isOutOfStock = product.stock <= 0;
            const buttonHtml = isOutOfStock 
                ? `<button class="btn btn-secondary btn-block" disabled>Out of Stock</button>`
                : `<button class="btn btn-primary btn-block home-add-cart" type="button" data-product-id="${escapeHTML(product.id)}">Add to cart <span>+</span></button>`;

            return `
                <article class="product-card reveal is-visible">
                    <div class="product-image-wrap">
                        <img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy">
                        <span class="product-badge">${escapeHTML(product.badge)}</span>
                    </div>
                    <div class="product-card-body">
                        <div class="product-title-row"><h3>${escapeHTML(product.name)}</h3><span>${formatMoney(product.price)}</span></div>
                        <p>${escapeHTML(product.description)}</p>
                        <p style="margin-top:6px; font-size:0.8rem; color:var(--muted);"><strong>Stock:</strong> ${product.stock || 0}</p>
                        ${buttonHtml}
                    </div>
                </article>`;
        }).join("");

        initializeImageFallbacks(grid);
    };

    const addHomeProductToCart = (productId) => {
        (async () => {
            const products = await readProducts();
            const product = products.find((item) => item.id === productId && item.available !== false);
            if (!product) return;
            const cart = readCart();
            const existing = cart.find((item) => item.id === product.id);
            if (existing) existing.quantity += 1;
            else cart.push({ id: product.id, name: product.name, price: product.price, image: product.image_url, quantity: 1 });
            saveCart(cart);
            const toast = document.getElementById("toast");
            const toastMessage = document.getElementById("toastMessage");
            if (toast && toastMessage) {
                toastMessage.textContent = `${product.name} added to cart successfully!`;
                toast.classList.add("is-visible");
                setTimeout(() => toast.classList.remove("is-visible"), 2400);
            }
        })();
    };

    document.addEventListener("DOMContentLoaded", () => {
        initializeWelcomeScreen();
        initializeNavigation();
        initializeHeader();
        initializeRevealAnimations();
        initializeImageFallbacks();
        initializeYear();
        updateCartCount();
        renderHomeProducts();
        document.getElementById("homeProductGrid")?.addEventListener("click", (event) => {
            const button = event.target.closest(".home-add-cart");
            if (button) addHomeProductToCart(button.dataset.productId);
        });
    });

    window.BreadOfHope = {
        supabase,
        escapeHTML,
        readProducts,
        saveProducts,
        readCart,
        saveCart,
        getCartQuantity,
        updateCartCount,
        readOrders,
        addOrder,
        updateOrder,
        deleteOrder,
        formatMoney,
        initializeImageFallbacks
    };
})();