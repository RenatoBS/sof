// Catálogo de planos — fonte da verdade no servidor. O valor cobrado nunca é aceito do cliente,
// só o nome do plano, evitando que alguém manipule o preço no checkout.
const PLANS = {
  Essencial: { name: 'Essencial', price: 99 },
  'Estúdio': { name: 'Estúdio', price: 197 },
  Rede: { name: 'Rede', price: 249 },
};

function getPlan(planName) {
  return PLANS[planName] || null;
}

module.exports = { PLANS, getPlan };
