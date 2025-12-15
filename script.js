// ===============================================
// script.js - Cardápio Totem RibbsZn (Corrigido e Otimizado)
// ===============================================

"use strict";

let cardapioData = {};
let cart = [];
let currentItem = null;
let splitPayments = [];
let currentPaymentIndex = null;
let pendingMilkShake = null;
let firstInteraction = false;
let inactivityTimeout;
let currentInput = null;

// NOVAS VARIÁVEIS PARA CUSTOMIZAÇÃO SEQUENCIAL DE COMBO
let comboCustomization = {
  item: null, // O item completo do cardápio (ex: "3 Duplos")
  currentBurgerIndex: -1, // Índice do burger sendo customizado (0, 1, 2...)
  totalCustomizations: [], // Array para armazenar as customizações de cada burger
  basePrice: 0, // Preço base do combo
};

const sounds = {
  click: document.getElementById("soundClick"),
  add: document.getElementById("soundAdd"),
  confirm: document.getElementById("soundConfirm"),
};

function playSound(type) {
  if (sounds[type]) {
    sounds[type].play().catch(() => {});
  }
}

// ===============================================
// Inicialização
// ===============================================

async function loadMenuData() {
  try {
    const response = await fetch("cardapio.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    cardapioData = await response.json();
    console.log("Cardápio carregado via JSON!");
  } catch (e) {
    console.warn(
      "Erro ao carregar cardapio.json (provavelmente CORS local). Usando menu de backup).",
      e
    );
    cardapioData = BACKUP_MENU;
  }
  showStartScreen();
}

document.addEventListener("DOMContentLoaded", () => {
  loadMenuData();
  setInterval(() => {
    const now = new Date();
    const relogio = document.getElementById("relogio");
    if (relogio) {
      relogio.textContent = now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }, 1000);
  document.addEventListener("keydown", handleEscapeKey);
});

function handleEscapeKey(e) {
  if (e.key === "Escape") {
    const openPopupEl = document.querySelector(".popup.show");
    if (openPopupEl) {
      const id = openPopupEl.id;
      switch (id) {
        case "popupCustom":
          closePopupCustom();
          break;
        case "popupResumoPedido":
          closeResumoPopup();
          break;
        case "popupPayment":
          closePaymentPopup();
          break;
        case "popupDividirPagamento":
          closePopupDividir();
          break;
        case "popupPix":
          closePix();
          break;
        case "popupCalda":
          closeCaldaPopup();
          break;
        case "popupNome":
          closeNome();
          break;
        case "popupTroco":
          closeTrocoPopup();
          break;
        case "customAlert":
          closeCustomAlert();
          break;
        case "customConfirm":
          closeCustomConfirm();
          break;
        case "popupImage":
          closeImagePopup();
          break;
        default:
          closePopup(id);
      }
    }
  }
}

// ===============================================
// Controle de Tela e Inatividade
// ===============================================

function showStartScreen() {
  document.body.classList.add("start-active");
  const startScreen = document.getElementById("startScreen");
  if (startScreen) startScreen.classList.remove("hidden");
  resetInactivityTimer();
}

function hideStartScreen() {
  document.body.classList.remove("start-active");
  const startScreen = document.getElementById("startScreen");
  if (startScreen) startScreen.classList.add("hidden");
  tryEnterFullscreen();
  resetInactivityTimer();

  // Seleciona a primeira categoria automaticamente
  if (Object.keys(cardapioData).length > 0) {
    showCategory("Promoções", document.querySelector(".sessao-topo button"));
  }
}

// Tornar global para acesso do HTML
window.hideStartScreen = hideStartScreen;

const startScreenEl = document.getElementById("startScreen");
if (startScreenEl) {
  startScreenEl.addEventListener("click", () => {
    playSound("click");
    hideStartScreen();
  });
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(() => {
    reiniciarPedido();
    showStartScreen();
  }, 120000); // 2 minutos
}

document.addEventListener("click", resetInactivityTimer);
document.addEventListener("touchstart", resetInactivityTimer);

function tryEnterFullscreen() {
  if (firstInteraction) return;
  firstInteraction = true;
  const el = document.documentElement;
  (el.requestFullscreen || el.webkitRequestFullscreen)
    ?.call(el)
    .catch(() => {});
}

// ===============================================
// Utilitários
// ===============================================

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getIngredientesParaOpcao(item, opcao) {
  return (
    item.ingredientesPorOpcao?.[opcao] ||
    item.ingredientesPadrao ||
    item.ingredientes ||
    []
  );
}

function getIngredsForComboCompat(item, burgerName) {
  const bName = burgerName ? burgerName.toLowerCase() : "";
  if (
    item.simplesIngredients &&
    (bName.includes("simples") || bName.includes("smash simples"))
  ) {
    return {
      ingredients: item.simplesIngredients,
      vegetables: item.simplesVegetables || [],
    };
  }
  if (
    item.duploIngredients &&
    (bName.includes("duplo") || bName.includes("smash duplo"))
  ) {
    return {
      ingredients: item.duploIngredients,
      vegetables: item.duploVegetables || [],
    };
  }
  // Fallback para combos mais genéricos
  return {
    ingredients: item.ingredients || [],
    vegetables: item.vegetables || [],
  };
}

function hasCustomization(item) {
  return !!(
    (
      item.combo ||
      (item.adicionais && item.adicionais.length > 0) || // Adicionais (extras)
      item.paidExtras || // Adicionais pagos
      item.ingredientesPorOpcao || // Ingredientes por opção (remoção)
      (item.ingredientesPadrao && item.ingredientesPadrao.length > 0) || // Ingredientes padrão (remoção)
      (item.ingredients && item.ingredients.length > 0) || // Ingredientes gerais (remoção)
      item.simplesIngredients || // Ingredientes de combo (remoção)
      item.duploIngredients
    ) // Ingredientes de combo (remoção)
  );
}

/**
 * Função helper para aplicar as regras de apelidos (aliases) aos ingredientes removidos.
 * @param {string[]} removed - Array de ingredientes removidos.
 * @returns {string} String formatada, ex: "sem salada" ou "sem Bacon, Picles".
 */
function formatRemovedIngredients(removed) {
  if (!removed || removed.length === 0) return "";

  const removedSet = new Set(removed);
  const size = removed.length;

  // Mapa de Ingredientes para Nomes de Exibição Simplificados/Substituídos
  const DISPLAY_NAMES = {
    "Cheddar fatiado": "queijo", // SUBSTITUIÇÃO SOLICITADA
    "Molho artesanal": "molho", // Simplificação baseada em exemplo anterior
    "Cebola caramelizada": "cebola", // Simplificação para fallback
    Alface: "alface", // Simplificação para fallback
    Tomate: "tomate", // Simplificação para fallback
  };

  // Função helper para verificar a presença exata de um conjunto de ingredientes.
  const checkExact = (ingList) =>
    size === ingList.length && ingList.every((ing) => removedSet.has(ing));

  // As regras são verificadas da combinação mais complexa para a mais simples.

  // se desmarcar alface, tomate e cebola caramelizada: sem verduras
  if (checkExact(["Alface", "Tomate", "Cebola caramelizada"]))
    return "sem verduras";

  // se desmarcar alface e tomate: sem salada
  if (checkExact(["Alface", "Tomate"])) return "sem salada";

  // Casos de ingrediente único que possuem apelido:

  // cheddar fatiado: sem queijo
  if (checkExact(["Cheddar fatiado"])) return "sem queijo";

  // cebola caramelizada: sem cebola
  if (checkExact(["Cebola caramelizada"])) return "sem cebola";

  // alface: sem alface
  if (checkExact(["Alface"])) return "sem alface";

  // tomate: sem tomate
  if (checkExact(["Tomate"])) return "sem tomate";

  // Fallback: Lista de ingredientes removidos, AGORA COM "SEM" REPETIDO E SUBSTITUIÇÕES.
  // Se não houver alias específico, mapeia cada item com o prefixo "sem",
  // usando o DISPLAY_NAMES para substituições.
  return removed
    .map((ing) => {
      const displayName = DISPLAY_NAMES[ing] || ing;
      return `sem ${displayName}`;
    })
    .join(", ");
}

/**
 * Gera uma string de detalhes de customização para exibição no carrinho.
 * @param {object} custom - O objeto custom do item no carrinho.
 * @returns {string} String HTML formatada com os detalhes.
 */
function generateCustomDetails(custom) {
  if (!custom) return "";
  let details = [];

  // --- 1. Combo Customization ---
  if (custom.burgers && custom.burgers.length > 0) {
    let burgerDetails = custom.burgers.map((b) => {
      let parts = [];

      // Removals (AGORA USA O HELPER formatRemovedIngredients)
      if (b.removed && b.removed.length > 0) {
        parts.push(formatRemovedIngredients(b.removed));
      }

      // Extras
      if (b.extras && b.extras.length > 0) {
        const extraNames = b.extras.map((e) => e.nome);
        parts.push(`Adicionar ${extraNames.join(", ")}`);
      }

      // Format: "Smash Simples (sem Cebola, c/ Bacon)"
      if (parts.length > 0) {
        return `${b.burgerName} (${parts.join(", ")})`;
      }
      return `${b.burgerName}`;
    });

    // Junta todos os detalhes do burger
    details.push(burgerDetails.join(" | "));

    // Extras gerais do Combo
    if (custom.comboExtras && custom.comboExtras.length > 0) {
      const extraNames = custom.comboExtras.map((e) => e.nome);
      details.push(`Extras Combo: ${extraNames.join(", ")}`);
    }
  }

  // --- 2. Individual Item Customization ---
  else {
    // MilkShake Calda
    if (custom.calda) {
      details.push(`Calda: ${custom.calda}`);
    }

    // Removals (AGORA USA O HELPER formatRemovedIngredients)
    if (custom.removed && custom.removed.length > 0) {
      details.push(formatRemovedIngredients(custom.removed));
    }

    // Extras
    if (custom.extras && custom.extras.length > 0) {
      const extraNames = custom.extras.map((e) => e.nome);
      details.push(`Adicionais: ${extraNames.join(", ")}`);
    }
  }

  if (details.length === 0) return "";

  // Usa uma classe para estilização opcional e envolve em parênteses
  return `<span class="cart-details">(${details.join("; ")})</span>`;
}

function getCartTotal() {
  return cart.reduce((total, c) => total + c.price * c.quantity, 0);
}

function updateCart() {
  const cartItems = document.getElementById("cartItems");
  if (!cartItems) return;
  cartItems.innerHTML = "";

  cart.forEach((c, i) => {
    const p = document.createElement("p");
    const customDetails = generateCustomDetails(c.custom); // NOVO

    // Injeta os detalhes de customização ao lado do nome do item
    p.innerHTML = `${escapeHtml(c.item)} ${customDetails} x ${
      c.quantity
    } - R$ ${(c.price * c.quantity).toFixed(2)}`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "removeBtn";
    removeBtn.textContent = "Remover";
    removeBtn.onclick = () => removeFromCart(i);
    p.appendChild(removeBtn);

    const qtyDiv = document.createElement("div");
    const minus = document.createElement("button");
    minus.className = "qtyBtn";
    minus.textContent = "-";
    minus.onclick = () => adjustQuantity(i, -1);

    const plus = document.createElement("button");
    plus.className = "qtyBtn";
    plus.textContent = "+";
    plus.onclick = () => adjustQuantity(i, 1);

    qtyDiv.appendChild(minus);
    qtyDiv.appendChild(plus);
    p.appendChild(qtyDiv);
    cartItems.appendChild(p);
  });

  document.getElementById("cartCount").textContent = cart.length;
  document.getElementById("cartTotal").textContent = getCartTotal().toFixed(2);
}

function addToCart(name, price, custom = {}) {
  // Procura se já existe exatamente o mesmo item com as mesmas customizações
  // Para simplificar, comparamos apenas nome aqui. Se tiver customização, idealmente seria um novo item.
  // Neste exemplo, vamos adicionar novo item sempre que tiver customização.
  const hasCustom = Object.keys(custom).length > 0;

  let existing = null;
  if (!hasCustom) {
    existing = cart.find(
      (c) =>
        c.item === name && (!c.custom || Object.keys(c.custom).length === 0)
    );
  }

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ item: name, price, quantity: 1, custom });
  }

  playSound("add");
  updateCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCart();
}

function adjustQuantity(index, delta) {
  if (!cart[index]) return;
  cart[index].quantity = cart[index].quantity + delta;
  if (cart[index].quantity < 1) cart[index].quantity = 1;
  updateCart();
}

function clearCart() {
  showConfirm("Limpar o carrinho?", (yes) => {
    if (yes) {
      cart = [];
      updateCart();
      const footer = document.getElementById("footerCart");
      if (footer) footer.classList.remove("expanded");
    }
  });
}

// Tornar globais
window.removeFromCart = removeFromCart;
window.adjustQuantity = adjustQuantity;
window.clearCart = clearCart;

// ===============================================
// Navegação e Exibição do Cardápio
// ===============================================

function showCategory(cat, btn) {
  tryEnterFullscreen();
  document
    .querySelectorAll(".sessao-topo button")
    .forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  const container = document.getElementById("cardapio");
  container.innerHTML = "";
  container.className =
    "cardapio" + (cat === "Artesanais" ? " artesanais-container" : "");

  const items = cardapioData[cat] || [];

  items.forEach((item, i) => {
    const card = document.createElement("div");
    card.className = "card";

    // Imagem
    if (item.img) {
      const img = document.createElement("img");
      img.src = item.img;
      img.alt = item.nome;
      img.loading = "lazy";
      img.onclick = () => openImagePopup(item.img);
      card.appendChild(img);
    }

    // Título e descrição
    const title = document.createElement("h3");
    title.textContent = item.nome;
    card.appendChild(title);

    if (item.descricao) {
      const desc = document.createElement("p");
      desc.className = "descricao";
      desc.textContent = item.descricao;
      card.appendChild(desc);
    }

    // Opções de tamanho/preço
    const optionsRow = document.createElement("div");
    optionsRow.className = "options-row";

    const opcoes = item.opcoes || [""];
    opcoes.forEach((op, j) => {
      // Fallback seguro para preço
      const price =
        item.precoBase && item.precoBase[j] !== undefined
          ? item.precoBase[j]
          : item.precoBase
          ? item.precoBase[0]
          : 0;

      const optionDiv = document.createElement("div");
      optionDiv.className = "small-option";
      optionDiv.innerHTML = `<p>${op || item.nome}</p><p>R$ ${Number(
        price
      ).toFixed(2)}</p>`;

      // Lógica de Renderização de Botões (CORRIGIDA)
      const needsCustom = hasCustomization(item);
      const isMilkShake = cat === "Milk Shakes";

      if (needsCustom && !isMilkShake) {
        // Se precisa de customização (ingredientes/adicionais) E NÃO é Milk Shake -> Personalizar
        const customizeBtn = document.createElement("button");
        customizeBtn.className = "btn";
        customizeBtn.textContent = "Personalizar";
        customizeBtn.onclick = () => {
          playSound("click");
          openPopupCustom(cat, i, j);
        };
        optionDiv.appendChild(customizeBtn);
      } else {
        // Itens simples (Bebidas, ou Milk Shakes com fluxo de calda) -> Adicionar
        const addBtn = document.createElement("button");
        addBtn.className = "btn";
        addBtn.textContent = "Adicionar";
        addBtn.onclick = () => {
          const fullName = item.nome + (op && op !== item.nome ? " " + op : "");
          if (isMilkShake) {
            pendingMilkShake = { name: fullName, price };
            openCaldaPopup();
          } else {
            adicionarDireto(fullName, price);
          }
        };
        optionDiv.appendChild(addBtn);
      }

      optionsRow.appendChild(optionDiv);
    });

    card.appendChild(optionsRow);
    container.appendChild(card);
  });
}

// Tornar global
window.showCategory = showCategory;

// ===============================================
// Popup Custom (Personalização de Itens)
// ===============================================

function openPopupCustom(cat, itemIndex, optionIndex) {
  currentItem = { cat, itemIndex, optionIndex };
  const item = cardapioData[cat][itemIndex];
  const opcao = item.opcoes?.[optionIndex] || "";

  // ===============================================
  // Lógica para Combos (Promoções) -> FLUXO SEQUENCIAL
  // ===============================================
  if (item.combo && item.burgers && cat === "Promoções") {
    const preco =
      item.precoBase[optionIndex] !== undefined
        ? item.precoBase[optionIndex]
        : item.precoBase[0];

    comboCustomization.item = item;
    comboCustomization.currentBurgerIndex = 0; // Inicia no primeiro burger
    comboCustomization.totalCustomizations = [];
    comboCustomization.basePrice = preco;

    renderComboBurgerModal();
    return;
  }

  // ===============================================
  // Lógica de Item Individual (FLUXO ÚNICO)
  // ===============================================

  const title = document.getElementById("popupCustomTitle");
  title.textContent = `Personalize: ${item.nome} ${opcao}`;

  const questionDiv = document.getElementById("popupQuestion");
  questionDiv.innerHTML = "";

  // 1. Vegetais para remover (PRÉ-MARCADOS)
  const veggies =
    item.vegetables ||
    item.ingredientesPadrao?.filter((ing) =>
      ["Alface", "Tomate"].includes(ing)
    ) ||
    [];
  if (veggies.length > 0) {
    const veggieSection = document.createElement("div");
    veggieSection.innerHTML = "<h4>Remover vegetais:</h4>";
    veggies.forEach((veg) => {
      const label = document.createElement("label");
      // Adiciona o atributo 'checked' para que venha pré-marcado
      label.innerHTML = `<input type="checkbox" data-type="remove" value="${veg}" checked> ${veg}`;
      veggieSection.appendChild(label);
    });
    questionDiv.appendChild(veggieSection);
  }

  // 2. Ingredientes para remover (PRÉ-MARCADOS)
  const ingredients = getIngredientesParaOpcao(item, opcao);
  const ingredientsForRemoval = ingredients.filter(
    (ing) => !veggies.includes(ing)
  );

  if (ingredientsForRemoval.length > 0) {
    const ingSection = document.createElement("div");
    ingSection.innerHTML = "<h4>Remover outros ingredientes:</h4>";
    ingredientsForRemoval.forEach((ing) => {
      const label = document.createElement("label");
      // Adiciona o atributo 'checked' para que venha pré-marcado
      label.innerHTML = `<input type="checkbox" data-type="remove" value="${ing}" checked> ${ing}`;
      ingSection.appendChild(label);
    });
    questionDiv.appendChild(ingSection);
  }

  // 3. Adicionais pagos ou gratuitos (NÃO PRÉ-MARCADOS)
  const extras = item.paidExtras || item.adicionais || [];
  if (extras.length > 0) {
    const extraSection = document.createElement("div");
    extraSection.innerHTML = "<h4>Adicionais:</h4>";
    extras.forEach((extra) => {
      const precoText =
        extra.preco > 0 ? `(+R$ ${extra.preco.toFixed(2)})` : "(Grátis)";
      const label = document.createElement("label");
      // Não adiciona 'checked'
      label.innerHTML = `<input type="checkbox" data-type="extra" data-preco="${extra.preco}" value="${extra.nome}"> ${extra.nome} ${precoText}`;
      extraSection.appendChild(label);
    });
    questionDiv.appendChild(extraSection);
  }

  // Adiciona o botão de confirmação padrão (que deve ser o último elemento em #popupCustom)
  const confirmBtn = document.querySelector("#popupCustom .btn");
  if (confirmBtn) {
    confirmBtn.textContent = "Adicionar ao carrinho";
    confirmBtn.onclick = confirmPopupCustom;
  }

  openPopup("popupCustom");
}

/**
 * Função para renderizar o modal de customização para um único burger do combo.
 */
function renderComboBurgerModal() {
  const { item, currentBurgerIndex } = comboCustomization;
  const burgerName = item.burgers[currentBurgerIndex];

  const title = document.getElementById("popupCustomTitle");
  title.textContent = `Personalize: ${burgerName} (${
    currentBurgerIndex + 1
  } de ${item.burgers.length})`;

  const questionDiv = document.getElementById("popupQuestion");
  questionDiv.innerHTML = "";

  // 1. Renderiza a seção de ingredientes/vegetais para remoção
  renderBurgerCustomizationSection(questionDiv, item, burgerName);

  // 2. Adicionais Pagos (por item)
  const extras = item.paidExtras || [];
  if (extras.length > 0) {
    const extraSection = document.createElement("div");
    extraSection.innerHTML = "<h4>Adicionais Pagos (por item):</h4>";
    extras.forEach((extra) => {
      const precoText =
        extra.preco > 0 ? `(+R$ ${extra.preco.toFixed(2)})` : "(Grátis)";
      const label = document.createElement("label");
      // Usamos data-type="extra-burger" para diferenciar de outros fluxos
      // Não pré-marcado
      label.innerHTML = `<input type="checkbox" data-type="extra-burger" data-preco="${extra.preco}" value="${extra.nome}"> ${extra.nome} ${precoText}`;
      extraSection.appendChild(label);
    });
    questionDiv.appendChild(extraSection);
  }

  // 3. Botão "Próximo" ou "Finalizar"
  const nextButton = document.querySelector("#popupCustom .btn");
  if (currentBurgerIndex < item.burgers.length - 1) {
    nextButton.textContent = "Próximo Lanche";
  } else {
    // Se for o último burger, verifica se há adicionais de combo (ex: batata, molhos)
    if (item.adicionais && item.adicionais.length > 0) {
      nextButton.textContent = "Próxima Etapa (Adicionais)";
    } else {
      nextButton.textContent = "Finalizar Personalização";
    }
  }
  nextButton.onclick = confirmPopupCustom; // Volta para a função de confirmação para avançar

  openPopup("popupCustom");
}

/**
 * Helper para renderizar checkboxes de ingredientes e vegetais a serem removidos
 * *AJUSTADO PARA CHECKED POR PADRÃO*
 */
function renderBurgerCustomizationSection(container, item, burgerName) {
  const { ingredients, vegetables } = getIngredsForComboCompat(
    item,
    burgerName
  );

  // 1. Vegetais para remover (PRÉ-MARCADOS)
  if (vegetables && vegetables.length > 0) {
    const veggieSection = document.createElement("div");
    veggieSection.innerHTML = "<h4>Remover vegetais:</h4>";
    vegetables.forEach((veg) => {
      const label = document.createElement("label");
      // Adiciona o atributo 'checked'
      label.innerHTML = `<input type="checkbox" data-type="remove-veg" value="${veg}" checked> ${veg}`;
      veggieSection.appendChild(label);
    });
    container.appendChild(veggieSection);
  }

  // 2. Outros Ingredientes para remover (PRÉ-MARCADOS)
  const otherIngredients = ingredients.filter(
    (ing) => !vegetables.includes(ing)
  );

  if (otherIngredients && otherIngredients.length > 0) {
    const ingSection = document.createElement("div");
    ingSection.innerHTML = "<h4>Remover outros ingredientes:</h4>";
    otherIngredients.forEach((ing) => {
      const label = document.createElement("label");
      // Adiciona o atributo 'checked'
      label.innerHTML = `<input type="checkbox" data-type="remove-ing" value="${ing}" checked> ${ing}`;
      ingSection.appendChild(label);
    });
    container.appendChild(ingSection);
  }
}

/**
 * Função para renderizar a etapa final de adicionais gerais do combo (ex: Batata, Molho)
 */
function renderComboFinalAddsModal() {
  const { item } = comboCustomization;

  const title = document.getElementById("popupCustomTitle");
  title.textContent = `Adicionais Finais do Combo: ${item.nome}`;

  const questionDiv = document.getElementById("popupQuestion");
  questionDiv.innerHTML = "";

  // Adicionais gratuitos/opcionais do combo (NÃO PRÉ-MARCADOS)
  const adds = item.adicionais || [];
  if (adds.length > 0) {
    const addSection = document.createElement("div");
    addSection.innerHTML = "<h4>Adicionais (Opcional/Geral):</h4>";
    adds.forEach((add) => {
      const precoText =
        add.preco > 0 ? `(+R$ ${add.preco.toFixed(2)})` : "(Grátis)";
      const label = document.createElement("label");
      // Não pré-marcado
      label.innerHTML = `<input type="checkbox" data-type="extra-combo" data-preco="${add.preco}" value="${add.nome}"> ${add.nome} ${precoText}`;
      addSection.appendChild(label);
    });
    questionDiv.appendChild(addSection);
  }

  // Mudar botão para Finalizar
  const nextButton = document.querySelector("#popupCustom .btn");
  nextButton.textContent = "Finalizar Pedido";
  nextButton.onclick = finalizeComboOrder;

  openPopup("popupCustom");
}

/**
 * Função que consolida a ordem do combo e adiciona ao carrinho.
 */
function finalizeComboOrder() {
  const { item, totalCustomizations, basePrice } = comboCustomization;

  let finalPrice = basePrice;
  const comboDetails = { burgers: [], comboExtras: [] };

  // Capturar adicionais gerais do combo (se esta etapa foi renderizada)
  const questionDiv = document.getElementById("popupQuestion");
  const comboAdds = Array.from(
    questionDiv.querySelectorAll('input[data-type="extra-combo"]:checked')
  ).map((input) => ({
    nome: input.value,
    preco: parseFloat(input.dataset.preco) || 0,
  }));

  comboAdds.forEach((add) => {
    finalPrice += add.preco;
    comboDetails.comboExtras.push(add);
  });

  // Processar customizações e somar preço dos extras por burger (usando o array já salvo)
  totalCustomizations.forEach((burgerCustom) => {
    let burgerPrice = 0;
    burgerCustom.extras.forEach((extra) => {
      burgerPrice += extra.preco; // Soma o preço de cada extra
    });
    finalPrice += burgerPrice;

    comboDetails.burgers.push(burgerCustom);
  });

  const fullName = item.nome;

  addToCart(fullName, finalPrice, comboDetails);

  // Limpar e fechar
  comboCustomization.currentBurgerIndex = -1; // Reset state
  closePopupCustom();
}

window.openPopupCustom = openPopupCustom;

// ===============================================
// Confirmação do Popup Custom (AGORA TAMBÉM GERE O AVANÇO DO FLUXO DE COMBO)
// ===============================================

function confirmPopupCustom() {
  playSound("click");
  const questionDiv = document.getElementById("popupQuestion");

  // ===========================================
  // FLUXO DE CUSTOMIZAÇÃO SEQUENCIAL (COMBOS)
  // Esta função agora AVANÇA o fluxo
  // ===========================================
  if (comboCustomization.currentBurgerIndex !== -1) {
    const { item, currentBurgerIndex, totalCustomizations } =
      comboCustomization;
    const burgerName = item.burgers[currentBurgerIndex];

    // 1. Capturar customizações do burger atual
    // Captura o que NÃO está MARCADO (ou seja, o que o cliente DESMARCOU para REMOVER)
    const removed = Array.from(
      questionDiv.querySelectorAll('input[data-type^="remove"]:not(:checked)')
    ).map((input) => input.value);

    const extras = Array.from(
      questionDiv.querySelectorAll('input[data-type="extra-burger"]:checked') // Captura só os extras do burger
    ).map((input) => ({
      nome: input.value,
      preco: parseFloat(input.dataset.preco) || 0,
    }));

    totalCustomizations[currentBurgerIndex] = {
      burgerName,
      removed,
      extras,
    };

    // 2. Avançar para o próximo passo
    if (currentBurgerIndex < item.burgers.length - 1) {
      // PRÓXIMO BURGER
      comboCustomization.currentBurgerIndex++;
      renderComboBurgerModal(); // Abre o modal para o próximo burger
      return;
    }

    // 3. ÚLTIMO BURGER: Adicionais do Combo (se houver)
    if (item.adicionais && item.adicionais.length > 0) {
      // Renderiza a etapa final de adicionais (agora é a última etapa)
      renderComboFinalAddsModal();
      return;
    }

    // 4. FINALIZAR TUDO (se não houver adicionais gerais)
    finalizeComboOrder();
    return;
  }

  // ===========================================
  // FLUXO DE ITEM INDIVIDUAL (ORIGINAL)
  // ===========================================

  const item = cardapioData[currentItem.cat][currentItem.itemIndex];
  // Preço base
  let preco =
    item.precoBase[currentItem.optionIndex] !== undefined
      ? item.precoBase[currentItem.optionIndex]
      : item.precoBase[0];

  // Captura customizações do item individual
  // Captura o que NÃO está MARCADO (ou seja, o que o cliente DESMARCOU para REMOVER)
  const removed = Array.from(
    questionDiv.querySelectorAll('input[data-type="remove"]:not(:checked)')
  ).map((input) => input.value);

  const extras = Array.from(
    questionDiv.querySelectorAll('input[data-type="extra"]:checked')
  ).map((input) => ({
    nome: input.value,
    preco: parseFloat(input.dataset.preco) || 0,
  }));

  let extraPrice = extras.reduce((sum, extra) => sum + extra.preco, 0);
  const opcao = item.opcoes?.[currentItem.optionIndex] || "";
  const fullName = `${item.nome} ${opcao}`.trim();
  const finalPrice = preco + extraPrice;

  addToCart(fullName, finalPrice, { removed, extras });

  closePopupCustom();
}

window.confirmPopupCustom = confirmPopupCustom;

function closePopupCustom() {
  // Limpa o estado de customização de combos em caso de ESC ou clique no X
  comboCustomization.currentBurgerIndex = -1;
  closePopup("popupCustom", () => closeBackdrop());
  currentItem = null;
}
window.closePopupCustom = closePopupCustom;

// ===============================================
// Adicionar Direto (sem custom)
// ===============================================

function adicionarDireto(name, price) {
  playSound("add");
  addToCart(name, price);
}

// ===============================================
// Popup Calda para Milk Shake
// ===============================================

function openCaldaPopup() {
  closeAllPopups(() => {
    openPopup("popupCalda");
  });
}

function closeCaldaPopup() {
  closePopup("popupCalda", () => closeBackdrop());
}

function selectCalda(calda) {
  playSound("click");
  if (pendingMilkShake) {
    const fullName = `${pendingMilkShake.name} com calda de ${calda}`;
    addToCart(fullName, pendingMilkShake.price, { calda });
    pendingMilkShake = null;
  }
  closeCaldaPopup();
}
window.closeCaldaPopup = closeCaldaPopup;
window.selectCalda = selectCalda;

// ===============================================
// Resumo do Pedido
// ===============================================

function mostrarResumo() {
  if (cart.length === 0) return showAlert("Carrinho vazio!");
  playSound("click");
  const resumoItens = document.getElementById("resumoItens");
  resumoItens.innerHTML = "";

  cart.forEach((c) => {
    const p = document.createElement("p");
    // Remove o span e parênteses da função para manter o formato do resumo mais limpo, se preferir.
    // Ou usa innerHTML para manter o formato e o span. Vamos usar innerHTML.
    const customDetails = generateCustomDetails(c.custom);

    // Injeta os detalhes de customização ao lado do nome do item
    p.innerHTML = `${escapeHtml(c.item)} ${customDetails} x ${
      c.quantity
    } - R$ ${(c.price * c.quantity).toFixed(2)}`;

    resumoItens.appendChild(p);
  });

  const totalP = document.createElement("p");
  totalP.innerHTML = `<strong>Total: R$ ${getCartTotal().toFixed(2)}</strong>`;
  resumoItens.appendChild(totalP);
  closeAllPopups(() => {
    openPopup("popupResumoPedido");
  });
}
window.mostrarResumo = mostrarResumo;

function closeResumoPopup() {
  closePopup("popupResumoPedido", () => closeBackdrop());
}
window.closeResumoPopup = closeResumoPopup;

function openPaymentPopup() {
  playSound("click");
  closeAllPopups(() => {
    const section = document.getElementById("splitPaymentSection");
    if (section) section.style.display = "none";
    openPopup("popupPayment");
  });
}
window.openPaymentPopup = openPaymentPopup;

function closePaymentPopup() {
  closePopup("popupPayment", () => closeBackdrop());
}
window.closePaymentPopup = closePaymentPopup;

// ===============================================
// Pagamento Simples
// ===============================================

function selectSinglePayment(method) {
  playSound("click");
  splitPayments = [{ value: getCartTotal(), method, troco: 0 }];
  if (method === "Dinheiro") {
    currentPaymentIndex = 0;
    openTrocoPopup(0);
  } else if (method === "Dinheiro Exato") {
    splitPayments[0].troco = 0;
    splitPayments[0].valorRecebido = splitPayments[0].value;
    proceedToNome();
  } else {
    proceedToNome();
  }
}
window.selectSinglePayment = selectSinglePayment;

// ===============================================
// Popup PIX
// ===============================================

function openPixPopup() {
  playSound("click");
  closeAllPopups(() => {
    document.getElementById(
      "pixTotal"
    ).textContent = `Total: R$ ${getCartTotal().toFixed(2)}`;
    openPopup("popupPix");
  });
}
window.openPixPopup = openPixPopup;

function closePix() {
  closePopup("popupPix", () => closeBackdrop());
}
window.closePix = closePix;

function confirmPix() {
  playSound("confirm");
  closePix();
  proceedToNome();
}
window.confirmPix = confirmPix;

// ===============================================
// Popup Dividir Pagamento
// ===============================================

function abrirPopupDividirPagamento() {
  playSound("click");
  closeAllPopups(() => {
    document.getElementById(
      "valorTotalDivisao"
    ).textContent = `Total: R$ ${getCartTotal().toFixed(2)}`;
    document.getElementById("quantidadePessoas").value = "";
    document.getElementById("inputsDivisao").innerHTML = "";
    document.getElementById("dividirKeypad").style.display = "none";
    document.getElementById("faltandoValor").textContent = "Faltando R$ 0.00";
    document.getElementById("confirmarDivisao").disabled = true;
    openPopup("popupDividirPagamento");
  });
}
window.abrirPopupDividirPagamento = abrirPopupDividirPagamento;

function closePopupDividir() {
  closePopup("popupDividirPagamento", () => closeBackdrop());
}
window.closePopupDividir = closePopupDividir;

function setCurrentInput(input) {
  currentInput = input;
}
window.setCurrentInput = setCurrentInput;

function gerarCamposDivisao() {
  const num = parseInt(document.getElementById("quantidadePessoas").value) || 0;
  const div = document.getElementById("inputsDivisao");
  div.innerHTML = "";
  for (let i = 0; i < num; i++) {
    const row = document.createElement("div");
    row.className = "rowDiv";
    row.innerHTML = `
      <label>Pagamento ${i + 1}:</label>
      <input type="number" id="divValue${i}" placeholder="Valor" onclick="setCurrentInput(this)" readonly />
      <select id="divMethod${i}">
        <option>Crédito</option>
        <option>Débito</option>
        <option>PIX</option>
        <option>Dinheiro</option>
      </select>`;
    div.appendChild(row);
  }
  document.getElementById("dividirKeypad").style.display =
    num > 0 ? "grid" : "none";
  const keypad = document.getElementById("dividirKeypad");
  // Remove listener antigo para evitar duplicação (embora replaceElement seria melhor, simples funciona aqui)
  const newKeypad = keypad.cloneNode(true);
  keypad.parentNode.replaceChild(newKeypad, keypad);
  newKeypad.addEventListener("click", handleKeypadClick);
  updateFaltando();
}
window.gerarCamposDivisao = gerarCamposDivisao;

function handleKeypadClick(e) {
  if (!currentInput || e.target.tagName !== "BUTTON") return;
  const key = e.target.dataset.key;
  if (key === "⌫") {
    currentInput.value = currentInput.value.slice(0, -1);
  } else if (key === "." && currentInput.value.includes(".")) {
    // do nothing
  } else {
    currentInput.value += key;
  }
  // Dispara evento manual se necessário, mas updateFaltando já resolve
  updateFaltando();
}

function updateFaltando() {
  const num = parseInt(document.getElementById("quantidadePessoas").value) || 0;
  let sum = 0;
  for (let i = 0; i < num; i++) {
    sum += Number(document.getElementById(`divValue${i}`).value || 0);
  }
  const faltando = getCartTotal() - sum;
  document.getElementById("faltandoValor").textContent =
    "Faltando R$ " + faltando.toFixed(2);
  // Permite confirmar se a diferença for muito pequena (ex: arredondamento)
  document.getElementById("confirmarDivisao").disabled =
    Math.abs(faltando) > 0.05;
}

function confirmarDivisao() {
  playSound("click");
  const num = parseInt(document.getElementById("quantidadePessoas").value);
  splitPayments = [];
  for (let i = 0; i < num; i++) {
    const value = Number(document.getElementById(`divValue${i}`).value);
    const method = document.getElementById(`divMethod${i}`).value;
    splitPayments.push({ value, method, troco: 0 });
  }
  closePopup("popupDividirPagamento", () => {
    const firstCash = splitPayments.findIndex((p) => p.method === "Dinheiro");
    if (firstCash !== -1) {
      currentPaymentIndex = firstCash;
      openTrocoPopup(firstCash);
    } else {
      proceedToNome();
    }
  });
}
window.confirmarDivisao = confirmarDivisao;

// ===============================================
// Popup Troco
// ===============================================

function openTrocoPopup(index) {
  closeAllPopups(() => {
    const payment = splitPayments[index];
    const h3 = document.getElementById("popupTroco").querySelector("h3");
    h3.textContent = `Pagamento ${
      index + 1
    } - Troco para R$ ${payment.value.toFixed(2)}?`;
    document.getElementById("inputTroco").value = "";
    populateTrocoKeyboard();
    openPopup("popupTroco");
  });
}

function closeTrocoPopup() {
  closePopup("popupTroco", () => closeBackdrop());
}
window.closeTrocoPopup = closeTrocoPopup;

function calculateTroco() {
  const valorPagar = splitPayments[currentPaymentIndex].value;
  const valorRecebido = Number(document.getElementById("inputTroco").value);
  return valorRecebido >= valorPagar ? valorRecebido - valorPagar : 0;
}

function confirmTroco() {
  const valorRecebido = Number(document.getElementById("inputTroco").value);
  const valorPagar = splitPayments[currentPaymentIndex].value;

  if (valorRecebido < valorPagar) {
    return showAlert("Valor insuficiente para o pagamento.");
  }

  playSound("confirm");
  const troco = calculateTroco();
  splitPayments[currentPaymentIndex].troco = troco;
  splitPayments[currentPaymentIndex].valorRecebido = valorRecebido;

  closeTrocoPopup();

  const nextCashIndex = splitPayments.findIndex(
    (p, i) => i > currentPaymentIndex && p.method === "Dinheiro"
  );
  if (nextCashIndex !== -1) {
    currentPaymentIndex = nextCashIndex;
    openTrocoPopup(nextCashIndex);
  } else {
    proceedToNome();
  }
}
window.confirmTroco = confirmTroco;

// ===============================================
// Popup Nome
// ===============================================

function proceedToNome() {
  closeAllPopups(() => {
    document.getElementById("inputNome").value = "";
    populateKeyboard();
    openPopup("popupNome");
  });
}

function closeNome() {
  closePopup("popupNome", () => closeBackdrop());
}
window.closeNome = closeNome;

function confirmNome() {
  sendOrder();
}
window.confirmNome = confirmNome;

// ===============================================
// Comunicação com KDS (via localStorage)
// ===============================================

/**
 * Lê os pedidos do localStorage (para não sobrescrever os existentes).
 * @returns {Array} Lista de pedidos.
 */
function getOrdersFromLocalStorageKDS() {
  try {
    const orders = localStorage.getItem("kds_orders");
    return orders ? JSON.parse(orders) : [];
  } catch (e) {
    console.error("Erro ao ler pedidos do localStorage (KDS):", e);
    return [];
  }
}

/**
 * Salva um novo pedido no localStorage para o KDS.
 * @param {object} newOrder - O objeto do pedido finalizado.
 */
function saveOrderToKDS(newOrder) {
  // Gera um ID simples e único para o KDS
  // O ID do pedido é importante para que o KDS possa identificá-lo e alterar o status.
  newOrder.id =
    Date.now().toString(36) + Math.random().toString(36).substring(2);
  newOrder.status = "Pendente"; // Status inicial para o KDS

  const existingOrders = getOrdersFromLocalStorageKDS();
  existingOrders.push(newOrder);

  try {
    localStorage.setItem("kds_orders", JSON.stringify(existingOrders));
    console.log(
      `Pedido #${newOrder.id.substring(0, 5).toUpperCase()} enviado para o KDS.`
    );
  } catch (e) {
    console.error("Erro ao salvar pedido no localStorage (KDS):", e);
  }
}

// ===============================================
// Finalização do Pedido
// ===============================================

function sendOrder() {
  playSound("click");
  const nomeCliente = document.getElementById("inputNome").value.trim();
  if (nomeCliente === "")
    return showAlert("Por favor, digite seu nome para finalizar o pedido.");

  // OBTÉM DATA E HORA FORMATADAS PARA O KDS
  const dataHoraFormatada = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const orderData = {
    // O ID e o STATUS serão adicionados pela função saveOrderToKDS
    nomeCliente,
    dataHora: dataHoraFormatada,
    itens: cart,
    total: getCartTotal(),
    pagamentos: splitPayments,
  };

  console.log("Pedido Finalizado e Pronto para Envio:", orderData);
  // Aqui você implementaria o envio real para o servidor

  // ===============================================
  // NOVO: ENVIA O PEDIDO PARA O KDS VIA LOCALSTORAGE
  // ===============================================
  saveOrderToKDS(orderData); // Adiciona o ID e o status e salva no localStorage

  closeNome();
  showAlert(`Obrigado, ${nomeCliente}! Pedido enviado!`);

  // Aguarda o alert fechar para reiniciar
  setTimeout(() => {
    reiniciarPedido();
  }, 2000);
}

function reiniciarPedido() {
  cart = [];
  splitPayments = [];
  currentItem = null;
  pendingMilkShake = null;
  updateCart();
  const footer = document.getElementById("footerCart");
  if (footer) footer.classList.remove("expanded");
  showStartScreen();
}
window.reiniciarPedido = reiniciarPedido;

// ===============================================
// Teclados Virtuais
// ===============================================

function populateKeyboard() {
  const keyboard = document.getElementById("keyboard");
  if (!keyboard) return;
  // Limpa e recria para evitar múltiplos listeners
  const newKeyboard = keyboard.cloneNode(false);
  keyboard.parentNode.replaceChild(newKeyboard, keyboard);

  const keys = "QWERTYUIOPASDFGHJKLZXCVBNM".split("");

  keys.forEach((key) => {
    const btn = document.createElement("button");
    btn.textContent = key;
    btn.dataset.key = key;
    newKeyboard.appendChild(btn);
  });

  const spaceBtn = document.createElement("button");
  spaceBtn.classList.add("space");
  spaceBtn.textContent = "ESPAÇO";
  spaceBtn.dataset.key = " ";
  newKeyboard.appendChild(spaceBtn);

  const backBtn = document.createElement("button");
  backBtn.classList.add("backspace");
  backBtn.textContent = "⌫";
  backBtn.dataset.key = "⌫";
  newKeyboard.appendChild(backBtn);

  newKeyboard.addEventListener("click", handleKeyboardClick);
}

function handleKeyboardClick(e) {
  if (e.target.tagName !== "BUTTON") return;
  const key = e.target.dataset.key;
  const input = document.getElementById("inputNome");
  if (key === "⌫") {
    input.value = input.value.slice(0, -1);
  } else {
    input.value += key;
  }
}

function populateTrocoKeyboard() {
  const trocoKeyboard = document.getElementById("trocoKeyboard");
  if (!trocoKeyboard) return;

  const newKeypad = trocoKeyboard.cloneNode(false);
  trocoKeyboard.parentNode.replaceChild(newKeypad, trocoKeyboard);

  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "⌫"];

  keys.forEach((key) => {
    const btn = document.createElement("button");
    btn.className = "key-btn";
    btn.dataset.key = key;
    btn.textContent = key;
    newKeypad.appendChild(btn);
  });

  newKeypad.addEventListener("click", handleTrocoKeyboardClick);
}

function handleTrocoKeyboardClick(e) {
  if (e.target.tagName !== "BUTTON") return;
  const key = e.target.dataset.key;
  const input = document.getElementById("inputTroco");
  if (key === "⌫") {
    input.value = input.value.slice(0, -1);
  } else if (key === "." && input.value.includes(".")) {
    // do nothing
  } else {
    input.value += key;
  }
  calculateTroco();
}

// ===============================================
// Gerenciamento de Popups e Backdrop
// ===============================================

function openPopup(id) {
  const popup = document.getElementById(id);
  const backdrop = document.getElementById("backdrop");
  if (popup) popup.classList.add("show");
  if (backdrop) backdrop.classList.add("show");
}

function closeBackdrop(callback) {
  const backdrop = document.getElementById("backdrop");
  if (!backdrop) return callback?.();

  backdrop.classList.add("hiding");
  backdrop.classList.remove("show");

  const onEnd = () => {
    backdrop.classList.remove("hiding");
    callback?.();
  };

  // Fallback seguro
  const timer = setTimeout(onEnd, 300);
  backdrop.addEventListener(
    "transitionend",
    () => {
      clearTimeout(timer);
      onEnd();
    },
    { once: true }
  );
}

function closePopup(id, callback) {
  const popup = document.getElementById(id);
  if (!popup || !popup.classList.contains("show")) return callback?.();

  popup.classList.add("hiding");
  popup.classList.remove("show");

  const onEnd = () => {
    popup.classList.remove("hiding");
    callback?.();
  };

  const timer = setTimeout(onEnd, 300);
  popup.addEventListener(
    "transitionend",
    () => {
      clearTimeout(timer);
      onEnd();
    },
    { once: true }
  );
}

function closeAllPopups(callback) {
  const popups = document.querySelectorAll(".popup.show");
  if (popups.length === 0) return callback?.();

  let count = popups.length;
  popups.forEach((p) =>
    closePopup(p.id, () => {
      count--;
      if (count === 0) closeBackdrop(callback);
    })
  );
}

// ===============================================
// Outros Popups (Alertas, Imagens)
// ===============================================

function showAlert(message) {
  closeAllPopups(() => {
    document.getElementById("alertMessage").textContent = message;
    openPopup("customAlert");
  });
}

function closeCustomAlert() {
  closePopup("customAlert", () => closeBackdrop());
}
window.closeCustomAlert = closeCustomAlert;

function showConfirm(message, onConfirm) {
  closeAllPopups(() => {
    document.getElementById("confirmMessage").textContent = message;
    const confirmBtn = document.querySelector(
      "#customConfirm button[aria-label='Sim']"
    );
    // Remove listeners antigos usando clone
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

    newConfirm.onclick = () => {
      onConfirm(true);
      closeCustomConfirm();
    };

    const cancelBtn = document.querySelector(
      "#customConfirm button[aria-label='Não']"
    );
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newCancel.onclick = () => {
      onConfirm(false);
      closeCustomConfirm();
    };

    openPopup("customConfirm");
  });
}

function closeCustomConfirm() {
  closePopup("customConfirm", () => closeBackdrop());
}
window.closeCustomConfirm = closeCustomConfirm;

function openImagePopup(src) {
  const img = document.getElementById("enlargedImage");
  if (img) img.src = src;
  openPopup("popupImage");
}

function closeImagePopup() {
  closePopup("popupImage", () => closeBackdrop());
}
window.closeImagePopup = closeImagePopup;

// ===============================================
// Carrinho Toggle (Área de Toque Expandida)
// ===============================================

const footer = document.getElementById("footerCart");

if (footer) {
  footer.addEventListener("click", (e) => {
    // REGRA 1: Se clicou em um botão interativo (Pagar, Remover, +, -), IGNORA o toggle.
    // Deixamos o clique passar para executar a função do botão.
    // A única exceção é o próprio botão da setinha (toggleCart), que deve abrir/fechar.
    if (
      (e.target.tagName === "BUTTON" && e.target.id !== "toggleCart") ||
      e.target.tagName === "INPUT"
    ) {
      return;
    }

    // REGRA 2: Se o carrinho já está aberto e a pessoa clica na área dos itens (lista), NÃO fecha.
    // Isso evita que o cliente feche o carrinho sem querer ao tentar rolar a lista ou errar o dedo num item.
    if (
      footer.classList.contains("expanded") &&
      e.target.closest("#cartItems")
    ) {
      return;
    }

    // REGRA 3: Se passou pelas regras acima, significa que clicou no fundo branco, no texto H3 ou na seta.
    // Então, alterna (abre ou fecha).
    footer.classList.toggle("expanded");
  });
}
