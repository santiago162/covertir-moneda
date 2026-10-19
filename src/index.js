const https = require('https');
const readline = require('readline');

const API_URL = 'https://open.er-api.com/v6/latest/USD';
const COMMON_CURRENCIES = ['USD', 'EUR', 'COP', 'MXN', 'GBP', 'JPY', 'CAD', 'BRL', 'ARS', 'CLP'];

function getExchangeRates() {
  return new Promise((resolve, reject) => {
    const request = https.get(API_URL, (response) => {
      let body = '';

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`La API respondió con el estado HTTP ${response.statusCode}.`));
        return;
      }

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.result !== 'success' || !data.rates || typeof data.rates !== 'object') {
            reject(new Error('La API no devolvió tasas de cambio válidas.'));
            return;
          }

          resolve(data);
        } catch (error) {
          reject(new Error(`No se pudo interpretar la respuesta de la API: ${error.message}`));
        }
      });
      response.on('error', reject);
    });

    request.setTimeout(10000, () => {
      request.destroy(new Error('La solicitud de tasas de cambio excedió el tiempo límite.'));
    });
    request.on('error', reject);
  });
}

function convertCurrency(amount, fromCurrency, toCurrency, rates) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('El monto debe ser un número válido mayor o igual a cero.');
  }

  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0 || toRate <= 0) {
    throw new Error('Una o ambas monedas no están disponibles en las tasas recibidas.');
  }

  return (amount / fromRate) * toRate;
}

function ask(question, interfaceHandle) {
  return new Promise((resolve) => {
    interfaceHandle.question(question, resolve);
  });
}

async function main() {
  const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('=== Conversor de monedas ===');
    console.log('Consultando las tasas de cambio actuales...');
    const exchangeData = await getExchangeRates();
    const rates = exchangeData.rates;

    console.log(`Monedas comunes: ${COMMON_CURRENCIES.filter((code) => rates[code]).join(', ')}`);
    console.log('También puedes ingresar cualquier código ISO 4217 disponible.');

    const amountInput = (await ask('Monto a convertir: ', terminal)).trim().replace(',', '.');
    if (amountInput === '' || !/^\d+(\.\d+)?$/.test(amountInput)) {
      throw new Error('Ingresa un monto válido usando solo dígitos y, opcionalmente, un punto decimal.');
    }
    const amount = Number(amountInput);

    const fromCurrency = (await ask('Moneda de origen (por ejemplo, USD): ', terminal)).trim().toUpperCase();
    const toCurrency = (await ask('Moneda de destino (por ejemplo, COP): ', terminal)).trim().toUpperCase();

    const convertedAmount = convertCurrency(amount, fromCurrency, toCurrency, rates);
    const formattedAmount = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: toCurrency,
    }).format(convertedAmount);

    console.log(`\n${amount} ${fromCurrency} = ${formattedAmount}`);
    console.log(`Tasas actualizadas: ${exchangeData.time_last_update_utc || 'fecha no informada por la API'}`);
  } finally {
    terminal.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { convertCurrency, getExchangeRates };