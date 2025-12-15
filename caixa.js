// ===============================================
// CAIXA - Lógica de Finalização e Gerenciamento
// ===============================================

const container = document.getElementById("pedidosCaixaContainer");
const ORDER_KEY = "activeOrders";

// Carrega e salva (funções de utilidade compartilhadas)
function getActiveOrders() {
  try {
    const ordersJson = localStorage.getItem(ORDER_KEY);
    return ordersJson ? JSON.parse(ordersJson) : [];
  } catch (e) {
    console.error("Erro ao carregar pedidos do LocalStorage:", e);
    return [];
  }
}
function saveActiveOrders(orders) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(orders));
}

// Renderiza a lista de pedidos no Caixa
function renderCaixa() {
  const orders = getActiveOrders();
  container.innerHTML = "";

  let totalFaturado = 0;
  let totalPedidos = 0;

  // Filtra e ordena para mostrar os Prontos primeiro
  const displayOrders = orders
    .filter((o) => o.status !== "AGUARDANDO" && o.status !== "EM_PREPARO")
    .sort((a, b) => {
      // PRONTO vem antes de FINALIZADO
      if (a.status === "PRONTO" && b.status === "FINALIZADO") return -1;
      if (a.status === "FINALIZADO" && b.status === "PRONTO") return 1;
      return 0;
    });

  if (displayOrders.length === 0) {
    container.innerHTML = "<h2>Nenhum pedido para finalizar.</h2>";
    document.getElementById("totalPedidos").textContent = 0;
    document.getElementById("totalFaturado").textContent = "0.00";
    return;
  }

  displayOrders.forEach((order) => {
    totalPedidos++;
    if (order.status === "FINALIZADO") {
      totalFaturado += order.total;
    }

    const card = document.createElement("div");
    card.className = "pedido-card";
    card.dataset.status = order.status;

    const isReady = order.status === "PRONTO";
    const isFinished = order.status === "FINALIZADO";

    const paymentsList = order.pagamentos
      .map(
        (p) =>
          `<li>${p.method}: R$ ${p.value.toFixed(2)} ${
            p.troco > 0 ? `(Troco: R$ ${p.troco.toFixed(2)})` : ""
          }</li>`
      )
      .join("");

    card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; font-size: 20px;">#${order.id} - ${
      order.nomeCliente
    }</h4>
                <span style="font-weight: bold; color: ${
                  isFinished ? "green" : isReady ? "orange" : "gray"
                };">
                    Status: ${order.status.replace("_", " ")}
                </span>
            </div>
            <p style="margin: 5px 0;"><strong>Total: R$ ${order.total.toFixed(
              2
            )}</strong></p>
            <p>Pagamentos:</p>
            <ul style="margin-top: 0; list-style: none;">${paymentsList}</ul>
            <div class="pedido-actions">
                ${
                  isReady
                    ? `<button class="btn-finalizar" onclick="finalizeOrder('${order.id}')">
                        FINALIZAR (Caixa)
                    </button>`
                    : ""
                }
            </div>
        `;
    container.appendChild(card);
  });

  // Atualiza o resumo
  document.getElementById("totalPedidos").textContent = totalPedidos;
  document.getElementById("totalFaturado").textContent =
    totalFaturado.toFixed(2);
}

// Função para finalizar um pedido
function finalizeOrder(id) {
  let orders = getActiveOrders();
  const index = orders.findIndex((o) => o.id === id);

  if (index !== -1) {
    orders[index].status = "FINALIZADO";
    orders[index].dataFinalizacao = new Date().toISOString();
    saveActiveOrders(orders); // Salva e notifica as outras abas
  }
}
window.finalizeOrder = finalizeOrder;

// ===============================================
// SINCRONIZAÇÃO EM TEMPO REAL
// ===============================================

// Carrega na inicialização
document.addEventListener("DOMContentLoaded", renderCaixa);

// Ouve o evento de 'storage' de outras janelas (Totem e KDS)
window.addEventListener("storage", (e) => {
  if (e.key === ORDER_KEY) {
    renderCaixa();
  }
});
