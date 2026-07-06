const { createApp, config } = require('./src/app');
const { seedDemoData } = require('./src/seed');

async function main() {
  await seedDemoData();
  const app = createApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Soft rodando em ${config.publicUrl} (porta ${config.port})`);
    if (!config.mercadoPago.configured) {
      // eslint-disable-next-line no-console
      console.log('[mercadopago] Modo demonstração ativo — configure MP_ACCESS_TOKEN no .env para cobrar de verdade.');
    }
    if (!config.whatsapp.configured) {
      // eslint-disable-next-line no-console
      console.log('[whatsapp] Bot desativado — configure WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID no .env.');
    }
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Falha ao iniciar o servidor:', err);
  process.exit(1);
});
