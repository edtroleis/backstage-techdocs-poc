#!/usr/bin/env node
// Publica um site TechDocs gerado no Azure Blob Storage via connection string (ex.: Azurite).
//
// O @techdocs/cli não aceita connection string nem endpoint customizado para Azure, então este
// script chama diretamente a classe Publisher do @backstage/plugin-techdocs-node, que é o mesmo
// código usado pelo CLI e pelo backend do Backstage. Resolve os pacotes a partir de app/node_modules.
//
// Uso: AZURE_STORAGE_CONNECTION_STRING=... node scripts/techdocs-azure-publish.cjs <site-dir> <namespace/kind/name>
'use strict';

const path = require('node:path');
const { createRequire } = require('node:module');

const appRequire = createRequire(path.join(__dirname, '..', 'app', 'package.json'));
const { ConfigReader } = appRequire('@backstage/config');
const { Publisher } = appRequire('@backstage/plugin-techdocs-node');
const { BlobServiceClient } = appRequire('@azure/storage-blob');

const CONTAINER = process.env.TECHDOCS_AZURE_CONTAINER || 'techdocs';

function makeLogger() {
  const log = level => (msg, meta) =>
    console.error(`[${level}] ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`);
  const logger = { info: log('info'), warn: log('warn'), error: log('error'), debug: () => {} };
  logger.child = () => logger;
  return logger;
}

async function main() {
  const [directory, triplet] = process.argv.slice(2);
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!directory || !triplet || triplet.split('/').length !== 3) {
    throw new Error('uso: techdocs-azure-publish.cjs <site-dir> <namespace/kind/name>');
  }
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING não definida (eval "$(scripts/azurite.sh env)")');
  }

  // O publisher assume que o container já existe.
  await BlobServiceClient.fromConnectionString(connectionString)
    .getContainerClient(CONTAINER)
    .createIfNotExists();

  const config = new ConfigReader({
    techdocs: {
      publisher: {
        type: 'azureBlobStorage',
        azureBlobStorage: { containerName: CONTAINER, connectionString },
      },
    },
  });
  const publisher = await Publisher.fromConfig(config, {
    logger: makeLogger(),
    discovery: { getBaseUrl: async () => '', getExternalBaseUrl: async () => '' },
  });

  const [namespace, kind, name] = triplet.split('/');
  await publisher.publish({
    entity: { apiVersion: 'backstage.io/v1alpha1', kind, metadata: { namespace, name } },
    directory: path.resolve(directory),
  });
}

main().catch(err => {
  console.error(`erro: ${err.message}`);
  process.exit(1);
});
