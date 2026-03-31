/* ============================================
   Casa Ahorro — Catálogo + Carrito + WhatsApp
   ============================================ */

// ─── CONFIGURACIÓN ─────────────────────────
// Solo edita estos dos valores si necesitas cambiarlos.
const WHATSAPP_NUMBER = '56993682139'; // Sin +, sin espacios
const BUSINESS_NAME   = 'Casa Ahorro';

// ─── ESTADO DEL CARRITO ────────────────────
let cart           = loadCart();
let productos      = []; // Se carga desde productos.json
let promoProductIds = []; // IDs de productos en promoción

// ─── ELEMENTOS DEL DOM ─────────────────────
const $grid = document.getElementById('productsGrid');
const $cartCount = document.getElementById('cartCount');
const $cartToggle = document.getElementById('cartToggle');
const $cartSidebar = document.getElementById('cartSidebar');
const $cartOverlay = document.getElementById('cartOverlay');
const $cartClose = document.getElementById('cartClose');
const $cartItems = document.getElementById('cartItems');
const $cartEmpty = document.getElementById('cartEmpty');
const $cartFooter = document.getElementById('cartFooter');
const $cartSubtotal = document.getElementById('cartSubtotal');
const $cartTotal = document.getElementById('cartTotal');
const $cartNotes = document.getElementById('cartNotes');
const $btnWhatsapp = document.getElementById('btnWhatsapp');
const $fabWhatsapp = document.getElementById('fabWhatsapp');
const $fabTotal = document.getElementById('fabTotal');
const $searchInput = document.getElementById('searchInput');
const $emptyState = document.getElementById('emptyState');
const $categories = document.getElementById('categories');
const $toast = document.getElementById('toast');

// ─── INICIALIZACIÓN ────────────────────────
let activeCategory = 'todos';
let searchQuery    = '';

// Carga productos.json y arranca la app
fetch('productos.json')
  .then(r => r.json())
  .then(data => {
    productos = data;
    init();
  })
  .catch(() => {
    // Fallback: muestra mensaje amigable si no carga
    document.getElementById('productsGrid').innerHTML =
      '<p style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:40px 0">No se pudieron cargar los productos.<br>Verifica que <strong>productos.json</strong> existe.</p>';
  });

function init() {
  renderCategories();
  renderProducts();
  updateCartUI();
  bindEvents();
  initCarousel();
}

// ─── CATEGORÍAS ────────────────────────────
function renderCategories() {
  // Excluir "Promo Ahorro" — se agrega como chip especial por buildPromoAhorro()
  const cats = [...new Set(productos.map(p => p.categoria))].filter(c => c !== 'Promo Ahorro');
  const scroll = $categories.querySelector('.categories-scroll');
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-chip';
    btn.dataset.category = cat;
    btn.textContent = cat;
    scroll.appendChild(btn);
  });
}

// ─── RENDERIZAR PRODUCTOS ──────────────────
function renderProducts() {
  const filtered = productos.filter(p => {
    let matchCat;
    if (activeCategory === 'todos')             matchCat = true;
    else if (activeCategory === 'promo-ahorro') matchCat = p.categoria === 'Promo Ahorro';
    else                                        matchCat = p.categoria === activeCategory;
    const matchSearch = p.nombre.toLowerCase().includes(searchQuery) ||
                        p.formato.toLowerCase().includes(searchQuery);
    return matchCat && matchSearch;
  });

  $grid.innerHTML = '';
  $emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

  filtered.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-img-wrap">
        <img src="${p.imagen}" alt="${p.nombre}" loading="lazy"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%23f1f5f9%22 width=%22200%22 height=%22200%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%2214%22>Sin imagen</text></svg>'">
      </div>
      <div class="product-info">
        <div class="product-name">${p.nombre}</div>
        <div class="product-format">${p.formato}</div>
        <div class="product-bottom">
          <span class="product-price">${formatPrice(p.precio)}</span>
          <button class="btn-add" data-id="${p.id}" aria-label="Añadir ${p.nombre} al carrito"><span class="btn-add-icon">+</span><span class="btn-add-text">Agregar</span></button>
        </div>
      </div>
    `;
    $grid.appendChild(card);
  });
}

// ─── EVENTOS ───────────────────────────────
function bindEvents() {
  // Añadir al carrito (delegación)
  $grid.addEventListener('click', e => {
    const btn = e.target.closest('.btn-add');
    if (!btn) return;
    const id = btn.dataset.id; // string — coincide con el id del JSON ("P001", etc.)
    addToCart(id);
    showToast('Producto añadido ✓');
  });

  // Carrito toggle
  $cartToggle.addEventListener('click', openCart);
  $cartClose.addEventListener('click', closeCart);
  $cartOverlay.addEventListener('click', closeCart);

  // WhatsApp (botón en carrito y FAB flotante)
  $btnWhatsapp.addEventListener('click', sendWhatsApp);
  $fabWhatsapp.addEventListener('click', sendWhatsApp);

  // Búsqueda
  $searchInput.addEventListener('input', e => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderProducts();
  });

  // Categorías (delegación)
  $categories.addEventListener('click', e => {
    const chip = e.target.closest('.cat-chip');
    if (!chip) return;
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeCategory = chip.dataset.category;
    renderProducts();
  });

  // Acciones carrito (delegación)
  $cartItems.addEventListener('click', e => {
    const btn = e.target.closest('.qty-btn');
    if (!btn) return;
    const id = btn.dataset.id; // string — mismo tipo que en el JSON
    const action = btn.dataset.action;
    if (action === 'plus') changeQty(id, 1);
    else if (action === 'minus') changeQty(id, -1);
    else if (action === 'delete') removeFromCart(id);
  });

  // Teclado ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeCart();
  });
}

// ─── LÓGICA DEL CARRITO ────────────────────
function addToCart(id) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, qty: 1 });
  }
  saveCart();
  updateCartUI();
  bumpCartIcon();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(id);
    return;
  }
  saveCart();
  updateCartUI();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  updateCartUI();
}

function getTotal() {
  return cart.reduce((sum, item) => {
    const prod = productos.find(p => p.id === item.id);
    return prod ? sum + prod.precio * item.qty : sum;
  }, 0);
}

// ─── PERSISTENCIA (localStorage) ───────────
function saveCart() {
  try {
    localStorage.setItem('casa_ahorro_cart', JSON.stringify(cart));
  } catch (e) { /* silently fail */ }
}

function loadCart() {
  try {
    const data = localStorage.getItem('casa_ahorro_cart');
    if (!data) return [];
    const parsed = JSON.parse(data);
    // Filtra items corruptos (id NaN o null que venían de la versión anterior)
    return parsed.filter(i => i.id != null && i.id !== 'NaN' && !Number.isNaN(i.id));
  } catch (e) {
    return [];
  }
}

// ─── ACTUALIZAR UI DEL CARRITO ─────────────
function updateCartUI() {
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  const total = getTotal();

  $cartCount.textContent = totalItems;
  $cartCount.style.display = totalItems > 0 ? 'flex' : 'none';

  // FAB flotante
  if (totalItems > 0) {
    $fabWhatsapp.style.display = 'flex';
    $fabTotal.textContent = formatPrice(total);
  } else {
    $fabWhatsapp.style.display = 'none';
  }

  if (cart.length === 0) {
    $cartEmpty.style.display = 'block';
    $cartItems.innerHTML = '';
    $cartFooter.style.display = 'none';
    return;
  }

  $cartEmpty.style.display = 'none';
  $cartFooter.style.display = 'block';

  $cartItems.innerHTML = cart.map(item => {
    const prod = productos.find(p => p.id === item.id);
    if (!prod) return '';
    const lineTotal = prod.precio * item.qty;
    return `
      <li class="cart-item">
        <img class="cart-item-img" src="${prod.imagen}" alt="${prod.nombre}"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 60 60%22><rect fill=%22%23f1f5f9%22 width=%2260%22 height=%2260%22/></svg>'">
        <div class="cart-item-details">
          <div class="cart-item-name">${prod.nombre}</div>
          <div class="cart-item-format">${prod.formato}</div>
          <div class="cart-item-price">${formatPrice(lineTotal)}</div>
        </div>
        <div class="cart-item-actions">
          <button class="qty-btn${item.qty === 1 ? ' delete' : ''}" data-id="${prod.id}" data-action="${item.qty === 1 ? 'delete' : 'minus'}" aria-label="Reducir">${item.qty === 1 ? '🗑' : '−'}</button>
          <span class="cart-item-qty">${item.qty}</span>
          <button class="qty-btn" data-id="${prod.id}" data-action="plus" aria-label="Aumentar">+</button>
        </div>
      </li>
    `;
  }).join('');

  $cartSubtotal.textContent = formatPrice(total);
  $cartTotal.textContent = formatPrice(total);
}

// ─── ABRIR / CERRAR CARRITO ────────────────
function openCart() {
  $cartSidebar.classList.add('open');
  $cartOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  $cartSidebar.classList.remove('open');
  $cartOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ─── ANIMACIÓN BUMP ────────────────────────
function bumpCartIcon() {
  $cartCount.classList.add('bump');
  setTimeout(() => $cartCount.classList.remove('bump'), 300);
}

// ─── TOAST ─────────────────────────────────
function showToast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  setTimeout(() => $toast.classList.remove('show'), 1800);
}

// ─── FORMATEAR PRECIO CLP ──────────────────
function formatPrice(n) {
  return '$' + n.toLocaleString('es-CL');
}

// ─── ENVIAR POR WHATSAPP ───────────────────
function sendWhatsApp() {
  if (cart.length === 0) return;

  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  const total = getTotal();
  const notes = $cartNotes.value.trim();

  // Fecha y hora del pedido
  const now = new Date();
  const fecha = now.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora  = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  let msg = `🛒 *PEDIDO — ${BUSINESS_NAME.toUpperCase()}*\n`;
  msg += `📅 ${fecha} ${hora}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;

  cart.forEach((item, idx) => {
    const prod = productos.find(p => p.id === item.id);
    if (!prod) return;
    const lineTotal = prod.precio * item.qty;
    msg += `\n*${idx + 1}. ${prod.nombre}*\n`;
    msg += `   📦 ${prod.formato}\n`;
    msg += `   🔢 ${item.qty} unid. × ${formatPrice(prod.precio)}\n`;
    msg += `   💵 Subtotal: *${formatPrice(lineTotal)}*\n`;
  });

  msg += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🛍️ Artículos: ${totalItems} producto${totalItems !== 1 ? 's' : ''}\n`;
  msg += `💰 *TOTAL A PAGAR: ${formatPrice(total)}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━`;

  if (notes) {
    msg += `\n\n📍 *Notas / Dirección:*\n${notes}`;
  }

  msg += `\n\n¡Gracias por su pedido! 🙌`;

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ─── HERO CAROUSEL DE PROMOCIONES ──────────────────────────────────────────
// Lee directamente del array global `productos` (ya cargado antes de init()).
// Cualquier producto con categoria "Promo Ahorro" aparece automáticamente.
function initCarousel() {
  const track         = document.getElementById('promoTrack');
  const dotsContainer = document.getElementById('promoDots');
  const section       = document.getElementById('promoCarouselSection');
  if (!track || !dotsContainer || !section) return;

  const BG_COLORS = [
    '#e8f6fb', '#e8faf0', '#fef5e0', '#f5e8fb',
    '#fce8f0', '#e8fbf3', '#fbf3e8', '#ede8fb', '#e8fbfb'
  ];

  const promos = productos.filter(p => p.categoria === 'Promo Ahorro');

  if (promos.length === 0) { section.style.display = 'none'; return; }

  // ── Chip en barra de categorías ──────────────
  const scroll   = $categories.querySelector('.categories-scroll');
  const todosBtn = scroll.querySelector('.cat-chip');
  if (todosBtn && !scroll.querySelector('[data-category="promo-ahorro"]')) {
    const chip = document.createElement('button');
    chip.className = 'cat-chip cat-chip-promo';
    chip.dataset.category = 'promo-ahorro';
    chip.textContent = '🏷️ Promo Ahorro';
    todosBtn.insertAdjacentElement('afterend', chip);
  }

  // ── Construir slides ─────────────────────────
  let currentIndex = 0;
  let autoTimer    = null;
  const INTERVAL   = 4500;

  track.innerHTML      = '';
  dotsContainer.innerHTML = '';

  promos.forEach((p, i) => {
    const slide = document.createElement('div');
    slide.className = 'promo-slide';
    slide.style.background = BG_COLORS[i % BG_COLORS.length];
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-label', `Promoción ${i + 1} de ${promos.length}: ${p.nombre}`);

    slide.innerHTML = `
      <div class="promo-slide-img-wrap">
        <img src="${p.imagen}" alt="${p.nombre}" loading="lazy"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%23f1f5f9%22 width=%22200%22 height=%22200%22/></svg>'">
      </div>
      <div class="promo-slide-content">
        <span class="promo-badge">Promo Ahorro</span>
        <div class="promo-titulo">${p.nombre}</div>
        <div class="promo-descripcion">${p.formato}</div>
        <div class="promo-price-block">
          <span class="promo-price-oferta">${formatPrice(p.precio)}</span>
        </div>
        <button class="promo-btn-add" data-id="${p.id}"
                aria-label="Añadir ${p.nombre} al carrito">
          <span>+</span> Añadir al Carrito
        </button>
      </div>`;
    track.appendChild(slide);

    const dot = document.createElement('button');
    dot.className = 'promo-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Ir a promoción ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });

  track.addEventListener('click', e => {
    const btn = e.target.closest('.promo-btn-add');
    if (!btn) return;
    addToCart(btn.dataset.id);
    showToast('Producto añadido ✓');
  });

  // ── Navegación y autoplay ────────────────────
  function goTo(index) {
    currentIndex = (index + promos.length) % promos.length;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    dotsContainer.querySelectorAll('.promo-dot')
      .forEach((d, i) => d.classList.toggle('active', i === currentIndex));
  }

  function startAutoPlay() {
    stopAutoPlay();
    autoTimer = setInterval(() => goTo(currentIndex + 1), INTERVAL);
  }

  function stopAutoPlay() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  // ── Hover pause (desktop) ───────────────────
  const wrapper = track.closest('.promo-carousel-wrapper');
  if (wrapper) {
    wrapper.addEventListener('mouseenter', stopAutoPlay);
    wrapper.addEventListener('mouseleave', startAutoPlay);
  }

  // ── Swipe touch (móvil) ─────────────────────
  let touchStartX = 0;
  let touchDeltaX = 0;

  track.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchDeltaX = 0;
    stopAutoPlay();
  }, { passive: true });

  track.addEventListener('touchmove', e => {
    touchDeltaX = e.touches[0].clientX - touchStartX;
  }, { passive: true });

  track.addEventListener('touchend', () => {
    if (Math.abs(touchDeltaX) > 50) {
      goTo(touchDeltaX < 0 ? currentIndex + 1 : currentIndex - 1);
    }
    touchDeltaX = 0;
    setTimeout(startAutoPlay, 2000);
  });

  startAutoPlay();
}
