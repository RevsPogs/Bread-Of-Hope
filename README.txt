BREAD OF HOPE WEBSITE

QUICK START
1. Extract the ZIP file.
2. Keep the HTML files, css folder, js folder, and images folder together.
3. Open index.html in a modern browser.
4. The website now works even when opened directly without a local web server.

ADMIN LOGIN
Username: admin
Password: admin

HOW ORDER DATA WORKS
- Products, cart items, submitted orders, and admin changes are saved in the browser through localStorage.
- Checkout orders appear in the Admin dashboard on the same browser and device.
- Clearing browser site data also clears the saved cart, products, and orders.
- This setup is suitable for a school presentation or offline demonstration.

FILES
- index.html: Homepage and opening screen
- products.html: Complete product catalog
- cart.html: Shopping cart
- checkout.html: Customer details and order submission
- admin.html: Login, orders, and product management
- css/style.css: Complete responsive design
- js/app.js: Shared data, navigation, opening screen, cart count, and product migration
- js/products.js: Product search and add-to-cart controls
- js/cart.js: Quantity, removal, totals, and clear-cart controls
- js/checkout.js: Validation, local order saving, and success message
- js/admin.js: Login, order management, status updates, and product management
- images/: Logo and three product images

IMPORTANT SECURITY NOTE
The admin login is stored in JavaScript and is intended only for a school demonstration. A public production website requires server-side authentication, secure database rules, and protected admin permissions.
