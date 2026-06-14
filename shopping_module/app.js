// --- State Management ---
let cart = [];

// --- Config / DOM Nodes ---
const DOM = {
    cartBtn: document.getElementById('cart-btn'),
    cartDrawer: document.getElementById('cart-drawer'),
    cartOverlay: document.getElementById('cart-overlay'),
    closeCartBtn: document.getElementById('close-cart-btn'),
    cartCount: document.getElementById('cart-count'),
    cartItems: document.getElementById('cart-items'),
    cartTotalVal: document.getElementById('cart-total-val'),
    addToCartBtns: document.querySelectorAll('.add-to-cart-btn'),
    
    // Checkout Portal Nodes
    checkoutForm: document.getElementById('checkout-form'),
    summaryItemsList: document.getElementById('summary-items-list'),
    summarySubtotal: document.getElementById('summary-subtotal'),
    summaryTotal: document.getElementById('summary-total'),
    codStamp: document.getElementById('cod-stamp'),
    submitBtn: document.getElementById('submit-btn'),
    
    // Multi-Step Screen Elements
    stepScreen1: document.getElementById('step-screen-1'),
    stepScreen2: document.getElementById('checkout-form'), // form serves as screen 2
    stepScreen3: document.getElementById('step-screen-3'),
    stepInd1: document.getElementById('step-ind-1'),
    stepInd2: document.getElementById('step-ind-2'),
    stepInd3: document.getElementById('step-ind-3'),
    stepCartList: document.getElementById('step-cart-list'),
    
    // Navigation Buttons
    proceedToShippingBtn: document.getElementById('proceed-to-shipping-btn'),
    backToCartBtn: document.getElementById('back-to-cart-btn'),
    newOrderBtn: document.getElementById('new-order-btn'),

    // Countdown clock elements
    days: document.getElementById('days'),
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),

    // Parallax layers
    deepSpace: document.querySelector('.deep-space'),
    cyberGrid: document.querySelector('.cyber-grid'),
    glowingDust: document.querySelector('.glowing-dust')
};

// --- Clickstream Telemetry Moments Dispatch ---
async function dispatchMoment(eventType, metadata = {}) {
    const name = "Mayank Agarwal";
    const phone = "+91 9999999999"; // default simulation profile
    try {
        console.log(`[Storefront Moment] Dispatching event: ${eventType}`);
        await fetch('http://localhost:3001/api/moments/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, event_type: eventType, metadata })
        });
    } catch (err) {
        console.warn('Failed to dispatch storefront moment:', err.message);
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initCountdown();
    initParallax();
    initCartListeners();
    initCheckoutStepper();
    
    // Log initial catalog landing page load
    dispatchMoment("product_viewed", { product_name: "Archive Catalog Homepage" });
});

// --- Giant Countdown Clock Logic ---
function initCountdown() {
    const countdownDuration = (2 * 24 * 60 * 60 * 1000) + (4 * 60 * 60 * 1000) + (35 * 60 * 1000) + 10000;
    const targetDate = new Date().getTime() + countdownDuration;

    function updateClock() {
        const now = new Date().getTime();
        const difference = targetDate - now;

        if (difference <= 0) {
            initCountdown();
            return;
        }

        const d = Math.floor(difference / (1000 * 60 * 60 * 24));
        const h = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((difference % (1000 * 60)) / 1000);

        DOM.days.innerText = String(d).padStart(2, '0');
        DOM.hours.innerText = String(h).padStart(2, '0');
        DOM.minutes.innerText = String(m).padStart(2, '0');
        DOM.seconds.innerText = String(s).padStart(2, '0');
    }

    updateClock();
    setInterval(updateClock, 1000);
}

// --- Parallax Scrolling Engine ---
function initParallax() {
    window.addEventListener('scroll', () => {
        const scrollOffset = window.pageYOffset;

        if (DOM.deepSpace) {
            DOM.deepSpace.style.transform = `translateY(${scrollOffset * 0.15}px)`;
        }
        if (DOM.cyberGrid) {
            DOM.cyberGrid.style.transform = `translateY(${scrollOffset * 0.35}px)`;
        }
        if (DOM.glowingDust) {
            DOM.glowingDust.style.transform = `translateY(${scrollOffset * 0.55}px)`;
        }
    });
}

// --- Cart Operations ---
function initCartListeners() {
    DOM.cartBtn.addEventListener('click', () => {
        DOM.cartDrawer.classList.add('open');
        DOM.cartOverlay.classList.add('open');
    });

    const closeCart = () => {
        DOM.cartDrawer.classList.remove('open');
        DOM.cartOverlay.classList.remove('open');
        
        // Dispatch "cart_abandoned" moment if they close drawer with items still in it
        if (cart.length > 0) {
            dispatchMoment("cart_abandoned", {
                items: cart,
                cart_value: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
            });
        }
    };

    DOM.closeCartBtn.addEventListener('click', closeCart);
    DOM.cartOverlay.addEventListener('click', closeCart);

    DOM.addToCartBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            const id = card.getAttribute('data-id');
            const name = card.getAttribute('data-name');
            const price = parseInt(card.getAttribute('data-price'), 10);
            const img = card.getAttribute('data-img');

            addToCart({ id, name, price, img });

            // Visual button feedback
            const originalText = e.target.innerText;
            e.target.innerText = 'ADDED_TO_VOID';
            e.target.style.background = 'var(--neon-cyan)';
            e.target.style.boxShadow = '0 0 15px var(--neon-cyan-glow)';
            setTimeout(() => {
                e.target.innerText = originalText;
                e.target.style.background = 'var(--neon-purple)';
                e.target.style.boxShadow = '0 0 10px var(--neon-purple-glow)';
            }, 1000);
        });
    });
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
    
    // Dispatch telemetry product interest click event
    dispatchMoment("product_viewed", { product_name: product.name, price: product.price });
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    DOM.cartCount.innerText = totalItems;

    // Render Sliding Cart Drawer items
    DOM.cartItems.innerHTML = '';
    if (cart.length === 0) {
        DOM.cartItems.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); margin-top: 40px; font-style: italic;">
                VOID IS EMPTY
            </div>
        `;
    } else {
        cart.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item-card';
            itemElement.innerHTML = `
                <img src="${item.img}" alt="${item.name}">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name} (x${item.quantity})</div>
                    <div class="cart-item-meta">
                        <span class="cart-item-price">₹${(item.price * item.quantity).toLocaleString()}</span>
                        <button class="remove-item-btn" onclick="removeFromCart('${item.id}')">REMOVE</button>
                    </div>
                </div>
            `;
            DOM.cartItems.appendChild(itemElement);
        });
    }

    // Update Totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    DOM.cartTotalVal.innerText = `₹${subtotal.toLocaleString()}`;

    // Update Checkout screens UI
    updateCheckoutUI(subtotal);
}

window.removeFromCart = removeFromCart;

// --- Multi-Step Checkout Navigation and Logic ---
function updateCheckoutUI(subtotal) {
    // 1. Update checkout Step 1 Review List
    DOM.stepCartList.innerHTML = '';
    if (cart.length === 0) {
        DOM.stepCartList.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 40px 0; font-style: italic;">
                NO HARDWARE SELECTED IN MEMORY BLOCK
            </div>
        `;
    } else {
        cart.forEach(item => {
            const row = document.createElement('div');
            row.className = 'step-cart-item';
            row.innerHTML = `
                <div class="step-cart-item-info">
                    <img src="${item.img}" alt="${item.name}">
                    <div>
                        <div class="step-cart-item-name">${item.name}</div>
                        <div class="step-cart-item-qty">QUANTITY: ${item.quantity}</div>
                    </div>
                </div>
                <div class="step-cart-item-price">₹${(item.price * item.quantity).toLocaleString()}</div>
            `;
            DOM.stepCartList.appendChild(row);
        });
    }

    // 2. Update Checkout Right Side Summary totals
    DOM.summaryItemsList.innerHTML = '';
    if (cart.length === 0) {
        DOM.summaryItemsList.innerHTML = `<div class="summary-empty">NO HARDWARE IN THE VOID CART</div>`;
        DOM.summarySubtotal.innerText = '₹0';
        DOM.summaryTotal.innerText = '₹0';
        return;
    }

    cart.forEach(item => {
        const row = document.createElement('div');
        row.className = 'summary-item';
        row.innerHTML = `
            <span class="summary-item-name">${item.name} (x${item.quantity})</span>
            <span class="summary-item-price">₹${(item.price * item.quantity).toLocaleString()}</span>
        `;
        DOM.summaryItemsList.appendChild(row);
    });

    DOM.summarySubtotal.innerText = `₹${subtotal.toLocaleString()}`;
    DOM.summaryTotal.innerText = `₹${subtotal.toLocaleString()}`;
}

function initCheckoutStepper() {
    // Proceed from Step 1 (Review) to Step 2 (Shipping Form)
    DOM.proceedToShippingBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert('Your cart is empty. Load elite hardware from catalog first!');
            return;
        }
        
        // Switch screens
        DOM.stepScreen1.classList.remove('active');
        DOM.stepScreen2.classList.add('active');
        
        // Update indicators
        DOM.stepInd1.classList.add('completed');
        DOM.stepInd1.classList.remove('active');
        DOM.stepInd2.classList.add('active');
    });

    // Go back from Step 2 to Step 1
    DOM.backToCartBtn.addEventListener('click', () => {
        DOM.stepScreen2.classList.remove('active');
        DOM.stepScreen1.classList.add('active');
        
        DOM.stepInd1.classList.add('active');
        DOM.stepInd1.classList.remove('completed');
        DOM.stepInd2.classList.remove('active');
    });

    // Submit Cash on Delivery Form (Step 2 to Step 3 Confirmation)
    DOM.checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (cart.length === 0) {
            alert('Cannot confirm order: Your void cart is empty.');
            return;
        }

        const name = document.getElementById('full-name').value;
        const phone = document.getElementById('phone-number').value;
        const address = document.getElementById('shipping-address').value;
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const originalBtnHTML = DOM.submitBtn.innerHTML;
        DOM.submitBtn.disabled = true;
        DOM.submitBtn.innerHTML = '<span>QUEUING ORDER DETAILS...</span><div class="btn-glow-cyan"></div>';
        
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const campaign_id = urlParams.get('campaign_id');
            const channel_message_id = urlParams.get('msg_id');

            // Post order to backend to sync to Mongo and send WhatsApp alert
            const response = await fetch('http://localhost:3001/api/orders/storefront', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    phone,
                    address,
                    items: cart,
                    total,
                    campaign_id,
                    channel_message_id
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Server error occurred during checkout');
            }

            const data = await response.json();
            console.log('Order synced to DB:', data);

            // Log purchase_completed moment event
            dispatchMoment("purchase_completed", { items: cart, cart_value: total });

            // Success State - Show secure stamp seal
            DOM.codStamp.classList.add('active');
            DOM.submitBtn.innerHTML = '<span>ORDER SECURED! SUCCESS.</span><div class="btn-glow-cyan"></div>';
            DOM.submitBtn.style.borderColor = 'var(--neon-pink)';
            DOM.submitBtn.style.color = 'var(--neon-pink)';
            DOM.submitBtn.style.boxShadow = '0 0 20px var(--neon-pink-glow)';

            setTimeout(() => {
                // Switch screens to Step 3 (Success Screen)
                DOM.stepScreen2.classList.remove('active');
                DOM.stepScreen3.classList.add('active');
                
                // Update Indicators
                DOM.stepInd2.classList.add('completed');
                DOM.stepInd2.classList.remove('active');
                DOM.stepInd3.classList.add('active');
                
                alert(`COD Order Placed Successfully!\n\nThank you for choosing AETHER_VOID.\nOur dispatch agent will call you shortly to confirm delivery coords.`);
            }, 1800);

        } catch (err) {
            console.error('Checkout failed:', err);
            alert(`Checkout Error: ${err.message}\n\nPlease try again.`);
            DOM.submitBtn.disabled = false;
            DOM.submitBtn.innerHTML = originalBtnHTML;
        }
    });

    // Load new order flow / reset
    DOM.newOrderBtn.addEventListener('click', () => {
        // Reset cart and UI
        DOM.checkoutForm.reset();
        cart = [];
        updateCartUI();
        
        // Reset Screens to Step 1
        DOM.stepScreen3.classList.remove('active');
        DOM.stepScreen1.classList.add('active');
        
        // Reset Indicators
        DOM.stepInd1.classList.add('active');
        DOM.stepInd1.classList.remove('completed');
        DOM.stepInd2.classList.remove('active');
        DOM.stepInd2.classList.remove('completed');
        DOM.stepInd3.classList.remove('active');
        
        DOM.codStamp.classList.remove('active');
        DOM.submitBtn.disabled = false;
        DOM.submitBtn.style.borderColor = 'var(--neon-cyan)';
        DOM.submitBtn.style.color = 'var(--text-primary)';
        DOM.submitBtn.style.boxShadow = '0 0 12px var(--neon-cyan-glow)';
        
        // Scroll back up to catalog
        document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
    });
}
