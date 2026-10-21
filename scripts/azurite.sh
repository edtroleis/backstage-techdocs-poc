#!/usr/bin/env bash
# Azurite (emulador do Azure Blob Storage) no Podman, para o publisher azureBlobStorage do TechDocs.
#
# Uso: scripts/azurite.sh up|down|status|env
#   eval "$(scripts/azurite.sh env)"   # exporta AZURE_STORAGE_CONNECTION_STRING
set -euo pipefail

NAME=azurite
IMAGE=mcr.microsoft.com/azure-storage/azurite:3.37.0
VOLUME=techdocs-azurite
PORT=10000

# Conta e chave de desenvolvimento padrão do Azurite (públicas, documentadas pela Microsoft).
ACCOUNT=devstoreaccount1
KEY='Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=='

running() { [[ "$(podman inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" == "true" ]]; }

case "${1:-}" in
  up)
    if running; then
      echo "azurite já está rodando"
    elif podman container exists "$NAME"; then
      podman start "$NAME" >/dev/null && echo "azurite iniciado"
    else
      podman volume exists "$VOLUME" || podman volume create "$VOLUME" >/dev/null
      podman run -d --name "$NAME" \
        -p "127.0.0.1:$PORT:10000" \
        -v "$VOLUME:/data" \
        "$IMAGE" \
        azurite-blob --blobHost 0.0.0.0 --location /data --skipApiVersionCheck --loose >/dev/null
      echo "azurite criado e iniciado em http://127.0.0.1:$PORT/$ACCOUNT"
    fi
    ;;
  down)
    if running; then podman stop "$NAME" >/dev/null && echo "azurite parado"; else echo "azurite não está rodando"; fi
    ;;
  status)
    if running; then echo "running"; else echo "stopped"; exit 1; fi
    ;;
  env)
    echo "export AZURE_STORAGE_CONNECTION_STRING='DefaultEndpointsProtocol=http;AccountName=$ACCOUNT;AccountKey=$KEY;BlobEndpoint=http://127.0.0.1:$PORT/$ACCOUNT;'"
    ;;
  *)
    echo "uso: $0 up|down|status|env" >&2
    exit 2
    ;;
esac
