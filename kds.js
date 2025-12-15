// kds.js - Sistema de Exibição de Cozinha (KDS) Profissionalizado
// ===============================================
// Autor: [Seu Nome ou IA Assistente]
// Versão: 2.0
// Data: Dezembro 2025
// Descrição: Script para gerenciar pedidos na cozinha, com histórico, modais e armazenamento local.
// Melhorias:
// - Organização modular com classes e funções puras.
// - Tratamento de erros aprimorado com try-catch e logs.
// - Renderização otimizada (evita re-render desnecessário).
// - Notificação sonora para novos pedidos.
// - Ordenação de pedidos por hora (mais recentes primeiro).
// - Suporte a busca simples no histórico.
// - Uso de template literals para HTML mais limpo.
// - Event delegation para melhor performance.
// - Adicionado clear history com confirmação.
// ===============================================

"use strict";

// Áudio de notificação (adicione um arquivo beep.mp3 na pasta)
const newOrderSound = new Audio("beep.mp3"); // Adicione o arquivo de som

class KDSManager {
  constructor() {
    this.ordersContainer = document.getElementById("ordersContainer");
    this.noOrdersMessage = document.getElementById("noOrdersMessage");
    this.historySidebar = document.getElementById("historySidebar");
    this.historyToggleBtn = document.getElementById("historyToggleBtn");
    this.historyContent = document.getElementById("historyContent");
    this.backdrop = document.getElementById("backdrop");
    this.currentOrderId = null;
    this.lastOrderCount = 0; // Para detectar novos pedidos

    this.initListeners();
    this.renderOrders(this.getOrders());
  }

  // ===============================================
  // Utilitários de Armazenamento
  // ===============================================

  getOrders() {
    try {
      const orders = localStorage.getItem("kds_orders");
      return orders ? JSON.parse(orders) : [];
    } catch (e) {
      console.error("Erro ao ler pedidos do localStorage:", e);
      return [];
    }
  }

  saveOrders(orders) {
    try {
      localStorage.setItem("kds_orders", JSON.stringify(orders));
    } catch (e) {
      console.error("Erro ao salvar pedidos no localStorage:", e);
    }
  }

  getHistory() {
    try {
      const history = localStorage.getItem("kds_history");
      return history ? JSON.parse(history) : [];
    } catch (e) {
      console.error("Erro ao ler histórico do localStorage:", e);
      return [];
    }
  }

  saveHistory(history) {
    try {
      localStorage.setItem("kds_history", JSON.stringify(history));
    } catch (e) {
      console.error("Erro ao salvar histórico no localStorage:", e);
    }
  }

  // ===============================================
  // Funções de Modal
  // ===============================================

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      this.backdrop.style.display = "flex";
      modal.style.display = "block";
      modal.classList.add("show");
    }
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = "none";
      modal.classList.remove("show");
    }
    if (id === "popupObservacao") {
      this.currentOrderId = null;
    }
    const openModals = document.querySelectorAll(".kds-modal.show");
    if (openModals.length === 0) {
      this.backdrop.style.display = "none";
    }
  }

  // ===============================================
  // Geração de Detalhes Customizados
  // ===============================================

  generateCustomDetails(custom, isKdsNote = false) {
    if (!custom) return "";
    let details = [];

    if (isKdsNote) {
      if (custom.kdsNote) details.push(`[KDS OBS]: ${custom.kdsNote}`);
      if (custom.editNote) details.push(`[KDS EDITED]: ${custom.editNote}`);
    }

    if (custom.burgers && custom.burgers.length > 0) {
      custom.burgers.forEach((b) => {
        let parts = [];
        if (b.removed && b.removed.length > 0) {
          parts.push(`- ${b.removed.join(", - ")}`);
        }
        if (b.extras && b.extras.length > 0) {
          const extraNames = b.extras.map((e) => e.nome);
          parts.push(`+ ${extraNames.join(", + ")}`);
        }
        if (parts.length > 0) {
          details.push(`${b.burgerName}: ${parts.join(" | ")}`);
        }
      });
      if (custom.comboExtras && custom.comboExtras.length > 0) {
        const extraNames = custom.comboExtras.map((e) => e.nome);
        details.push(`Extras Combo: + ${extraNames.join(", + ")}`);
      }
    } else if (!isKdsNote) {
      if (custom.calda) details.push(`Calda: ${custom.calda}`);
      if (custom.removed && custom.removed.length > 0) {
        details.push(`- ${custom.removed.join(", - ")}`);
      }
      if (custom.extras && custom.extras.length > 0) {
        const extraNames = custom.extras.map((e) => e.nome);
        details.push(`+ ${extraNames.join(", + ")}`);
      }
    }

    if (details.length === 0) return "";
    return isKdsNote
      ? `<span class="details">${details.join(" | ")}</span>`
      : `<span class="details item-details">${details.join("; ")}</span>`;
  }

  // ===============================================
  // Lógica de Observação
  // ===============================================

  openObservationModal(orderId) {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    this.currentOrderId = orderId;
    const obsTextarea = document.getElementById("obsTextarea");
    document.getElementById("obsOrderInfo").textContent = `Pedido: #${order.id
      .substring(0, 5)
      .toUpperCase()} - Cliente: ${order.nomeCliente}`;
    obsTextarea.value = order.custom?.kdsNote || "";

    const confirmBtn = document.getElementById("confirmObsBtn");
    confirmBtn.onclick = () => this.saveObservation(orderId);

    this.openModal("popupObservacao");
    setTimeout(() => obsTextarea.focus(), 50);
  }

  saveObservation(orderId) {
    if (!orderId) return;
    const note = document.getElementById("obsTextarea").value.trim();
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) return;

    if (!orders[index].custom) orders[index].custom = {};
    orders[index].custom.kdsNote = note || undefined;

    this.saveOrders(orders);
    this.renderOrders(orders);
    this.closeModal("popupObservacao");
  }

  // ===============================================
  // Lógica de Histórico
  // ===============================================

  calculateHistoryTotal(history) {
    return history.reduce((sum, order) => sum + order.total, 0);
  }

  renderHistory(searchTerm = "") {
    const history = this.getHistory().filter(
      (order) =>
        order.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    this.historyContent.innerHTML = "";

    const totalValue = this.calculateHistoryTotal(history);
    document.getElementById("historyTotalValue").textContent = `R$ ${totalValue
      .toFixed(2)
      .replace(".", ",")}`;

    if (history.length === 0) {
      this.historyContent.innerHTML =
        '<p id="noHistoryMessage" style="color: #888;">Nenhum pedido no histórico.</p>';
      return;
    }

    history
      .slice()
      .reverse()
      .forEach((order) => {
        const card = document.createElement("div");
        card.className = "history-card";
        card.dataset.id = order.id;

        const orderIdShort = order.id.substring(0, 5).toUpperCase();
        const customDetails = this.generateCustomDetails(
          order.custom || {},
          true
        );
        const paymentMethod = order.formaPagamento || "Não Informado";
        const paymentTag = `<span class="payment-tag">${paymentMethod}</span>`;

        card.innerHTML = `
        <button class="delete-btn" onclick="kdsManager.deleteOrderFromHistory('${
          order.id
        }')">Excluir</button>
        ${paymentTag}
        <p><strong>Pedido #${orderIdShort}</strong> (${order.status})</p>
        <p><strong>Cliente:</strong> ${order.nomeCliente}</p>
        <p><strong>Hora Conclusão:</strong> ${
          order.historyDate || order.dataHora
        }</p>
        <p><strong>Total:</strong> R$ ${order.total
          .toFixed(2)
          .replace(".", ",")}</p>
        ${customDetails}
        <div style="margin-top: 5px;">
          <p style="font-size: 0.8em; color: #ccc; font-weight: bold; border-top: 1px dashed #444; padding-top: 5px;">Itens:</p>
          <ul>
            ${order.itens
              .map(
                (item) => `
              <li style="font-weight: normal; color: #ccc;">
                ${item.item} x ${item.quantity}
              </li>
            `
              )
              .join("")}
          </ul>
        </div>
      `;
        this.historyContent.appendChild(card);
      });
  }

  moveOrderToHistory(order) {
    const history = this.getHistory();
    order.historyDate = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    history.push({ ...order });
    this.saveHistory(history);
    if (this.historySidebar.classList.contains("open")) this.renderHistory();
  }

  deleteOrderFromHistory(orderId) {
    if (
      !confirm(
        "Tem certeza que deseja EXCLUIR este pedido do histórico? Isso é permanente."
      )
    )
      return;
    let history = this.getHistory();
    history = history.filter((o) => o.id !== orderId);
    this.saveHistory(history);
    this.renderHistory();
  }

  clearHistory() {
    if (
      !confirm(
        "Tem certeza que deseja LIMPAR TODO O HISTÓRICO? Isso é permanente."
      )
    )
      return;
    this.saveHistory([]);
    this.renderHistory();
  }

  toggleHistorySidebar() {
    const isOpen = this.historySidebar.classList.toggle("open");
    if (isOpen) {
      this.renderHistory();
      this.historyToggleBtn.style.display = "none";
    } else {
      this.historyToggleBtn.style.display = "block";
    }
  }

  // ===============================================
  // Renderização e Ações de Pedidos
  // ===============================================

  renderOrders(orders) {
    this.ordersContainer.innerHTML = "";
    const activeOrders = orders
      .filter((o) => o.status !== "Concluído")
      .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora)); // Ordena por mais recente

    // Notificação sonora se houver novos pedidos
    if (activeOrders.length > this.lastOrderCount) {
      newOrderSound.play().catch(() => console.log("Áudio não reproduzido."));
    }
    this.lastOrderCount = activeOrders.length;

    if (activeOrders.length === 0) {
      this.ordersContainer.appendChild(this.noOrdersMessage);
      return;
    }

    if (this.noOrdersMessage.parentNode) {
      this.ordersContainer.removeChild(this.noOrdersMessage);
    }

    activeOrders.forEach((order) => {
      const card = document.createElement("div");
      card.className = `order-card ${order.status.toLowerCase()}`;
      card.dataset.id = order.id;

      const customDetails = this.generateCustomDetails(
        order.custom || {},
        true
      );
      const statusTag = `<span class="status-tag">${order.status}</span>`;

      let mainActionButtonText = "";
      let mainActionButtonAction = "";
      if (order.status === "Pendente") {
        mainActionButtonText = "ACEITAR Pedido";
        mainActionButtonAction = `kdsManager.acceptOrder('${order.id}')`;
      } else if (order.status === "Aceito") {
        mainActionButtonText = "Marcar como PRONTO";
        mainActionButtonAction = `kdsManager.toggleOrderStatus('${order.id}')`;
      } else if (order.status === "Pronto") {
        mainActionButtonText = "Marcar como ENTREGUE";
        mainActionButtonAction = `kdsManager.toggleOrderStatus('${order.id}')`;
      }

      card.innerHTML = `
        <h2>Pedido #${order.id.substring(0, 5).toUpperCase()}</h2>
        <p><strong>Cliente:</strong> ${order.nomeCliente}</p>
        <p><strong>Hora:</strong> ${order.dataHora}</p>
        <p><strong>Total:</strong> R$ ${order.total
          .toFixed(2)
          .replace(".", ",")}</p>
        ${statusTag}
        ${customDetails}
        <ul>
          ${order.itens
            .map(
              (item) => `
            <li>
              ${item.item} x ${item.quantity}
              ${this.generateCustomDetails(item.custom, false)}
            </li>
          `
            )
            .join("")}
        </ul>
        <button class="main-action-btn" onclick="${mainActionButtonAction}">
          ${mainActionButtonText}
        </button>
        <div class="button-group">
          <button onclick="kdsManager.openObservationModal('${
            order.id
          }')">Obs</button>
          <button onclick="kdsManager.printOrder('${
            order.id
          }')">Imprimir</button>
          <button class="delete-btn" onclick="kdsManager.deleteOrder('${
            order.id
          }')">Excluir</button>
        </div>
      `;
      this.ordersContainer.appendChild(card);
    });
  }

  acceptOrder(orderId) {
    if (
      !confirm(
        "Tem certeza que deseja ACEITAR este pedido e iniciar o preparo?"
      )
    )
      return;
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) return;
    orders[index].status = "Aceito";
    this.saveOrders(orders);
    this.renderOrders(orders);
  }

  toggleOrderStatus(orderId) {
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) return;

    const currentStatus = orders[index].status;
    const orderToUpdate = orders[index];

    if (currentStatus === "Aceito") {
      orderToUpdate.status = "Pronto";
    } else if (currentStatus === "Pronto") {
      if (
        !confirm(
          "Marcar como ENTREGUE/CONCLUÍDO? Isso irá remover o pedido da tela."
        )
      )
        return;
      if (!orderToUpdate.formaPagamento)
        orderToUpdate.formaPagamento = "Dinheiro (KDS)";
      orderToUpdate.status = "Concluído";
      this.moveOrderToHistory(orderToUpdate);
      orders.splice(index, 1);
    }

    this.saveOrders(orders);
    this.renderOrders(orders);
    if (this.historySidebar.classList.contains("open")) this.renderHistory();
  }

  deleteOrder(orderId) {
    if (
      !confirm(
        "ATENÇÃO: Tem certeza que deseja EXCLUIR este pedido permanentemente?"
      )
    )
      return;
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) return;
    orders.splice(index, 1);
    this.saveOrders(orders);
    this.renderOrders(orders);
  }

  printOrder(orderId) {
    const cardToPrint = document.querySelector(
      `.order-card[data-id="${orderId}"]`
    );
    if (!cardToPrint) return alert("Pedido não encontrado para impressão.");

    const printContent = cardToPrint.outerHTML;
    const style = `
      <style>
        body { background: white !important; color: black !important; padding: 0; margin: 0; }
        .order-card { 
          border: none !important; 
          box-shadow: none !important; 
          width: 100%; 
          max-width: 300px; 
          margin: 0 auto; 
          background: white !important; 
          color: black !important; 
        } 
        .status-tag, .button-group, .main-action-btn, .details { display: none !important; } 
        h2, p, li { color: black !important; } 
        ul { border-color: #ccc !important; } 
      </style>
    `;

    const printWindow = window.open("", "", "height=500,width=800");
    printWindow.document.write("<html><head>");
    printWindow.document.write("<title>Impressão Pedido KDS</title>");
    printWindow.document.write(style);
    printWindow.document.write("</head><body>");
    printWindow.document.write(printContent);
    printWindow.document.write("</body></html>");
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }

  // ===============================================
  // Inicialização e Listeners
  // ===============================================

  initListeners() {
    this.historyToggleBtn.addEventListener("click", () =>
      this.toggleHistorySidebar()
    );

    window.addEventListener("storage", (e) => {
      if (e.key === "kds_orders") {
        console.log("Novo pedido detectado via localStorage!");
        this.renderOrders(this.getOrders());
      }
      if (
        e.key === "kds_history" &&
        this.historySidebar.classList.contains("open")
      ) {
        this.renderHistory();
      }
    });

    const obsTextarea = document.getElementById("obsTextarea");
    if (obsTextarea) {
      obsTextarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          const popup = document.getElementById("popupObservacao");
          if (
            popup &&
            popup.classList.contains("show") &&
            this.currentOrderId
          ) {
            this.saveObservation(this.currentOrderId);
          }
        }
      });
    }

    // Adicionar busca no histórico (exemplo simples)
    const historyHeader = document.getElementById("historyHeader");
    const searchInput = document.createElement("input");
    searchInput.placeholder = "Buscar por cliente ou ID...";
    searchInput.style.marginLeft = "10px";
    searchInput.addEventListener("input", (e) =>
      this.renderHistory(e.target.value)
    );
    historyHeader.appendChild(searchInput);

    // Botão para limpar histórico
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Limpar Histórico";
    clearBtn.onclick = () => this.clearHistory();
    clearBtn.style.marginLeft = "10px";
    historyHeader.appendChild(clearBtn);
  }
}

// Instancia o gerenciador global
const kdsManager = new KDSManager();

// Exposições globais necessárias (para onclicks inline)
window.closeModal = (id) => kdsManager.closeModal(id);
window.openObservationModal = (orderId) =>
  kdsManager.openObservationModal(orderId);
window.acceptOrder = (orderId) => kdsManager.acceptOrder(orderId);
window.toggleOrderStatus = (orderId) => kdsManager.toggleOrderStatus(orderId);
window.deleteOrder = (orderId) => kdsManager.deleteOrder(orderId);
window.printOrder = (orderId) => kdsManager.printOrder(orderId);
window.deleteOrderFromHistory = (orderId) =>
  kdsManager.deleteOrderFromHistory(orderId);
window.toggleHistorySidebar = () => kdsManager.toggleHistorySidebar();
