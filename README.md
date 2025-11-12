<!-- File: README.md -->
# Ecobots MVP

Este repositório contém o MVP do Ecobots com backend em PHP 8 + MySQL 5.7 e frontend PWA em HTML/JS vanilla com Bulma.

## Estrutura

```
/api
  /core
    auth.php
    db.php
    geo.php
    response.php
    rules.php
  encounter_*.php
  inventory_*.php
  mission_*.php
  paths_*.php
  profile_update.php
  init_config.php
/public
  *.html
  /css
  /js
  manifest.webmanifest
  sw.js
/db/migrations
  001_add_mvp_fields.sql
```

## Configuração

1. Configure as credenciais de banco via variáveis de ambiente opcionais:
   - `ECOBOTS_DB_HOST`
   - `ECOBOTS_DB_NAME`
   - `ECOBOTS_DB_USER`
   - `ECOBOTS_DB_PASS`

   Alternativamente edite `api/init_config.php` para colocar valores fixos.

2. Certifique-se de que a pasta `api/uploads` exista com permissão de escrita para o PHP (para as fotos de missões).

3. A base oficial `base-de-dados.sql` já inclui todas as colunas necessárias (xp/level, down_until, provas de missão etc.).
   O arquivo `db/migrations/001_add_mvp_fields.sql` está presente apenas para documentação — não há `ALTER TABLE` adicionais.

4. (Opcional) Configure o serviço de rotas usado para traçar caminhos no mapa:
   - `ECOBOTS_OSRM_URL` aponta para a instância OSRM (padrão público `https://router.project-osrm.org`).
   - `ECOBOTS_OSRM_PROFILE` define o perfil (`foot`, `driving`, etc.); o padrão é `foot`.
   Caso essas variáveis não sejam definidas, os botões de rota utilizam o endpoint público padrão.

5. Suba o servidor local para testes (PHP embutido):

   ```bash
   php -S 0.0.0.0:8080 -t public
   ```

   A API estará disponível em `http://localhost:8080/api/*.php`.

## Endpoints principais

- `POST /api/register.php` — cria usuário, ecobot e inventário inicial.
- `POST /api/login.php` — autentica e retorna token Bearer.
- `GET /api/me.php` — perfil do usuário + status do ecobot.
- `GET /api/missions_list.php?lat&lng&km` — lista missões próximas.
- `POST /api/mission_start.php` / `mission_finish.php` — ciclo de missões.
- `POST /api/mission_photo_upload.php`, `mission_qr_submit.php`, `mission_p2p_touch.php` — etapas específicas.
- `POST /api/encounter_scan.php`, `encounter_start.php`, `encounter_resolve.php` — encontros de batalha.
- `GET /api/inventory_list.php` e `POST /api/inventory_equip.php` / `inventory_unequip.php` — inventário.
- `GET /api/paths_list.php`, `GET /api/paths_progress.php` — caminhos.
- `POST /api/profile_update.php` — atualização de nickname/geofence.

Todas as rotas autenticadas exigem header `Authorization: Bearer <token>`.

## PWA

O frontend utiliza Bulma puro, scripts JS por página e registra um service worker simples (`public/sw.js`) para cache básico offline.

## Fluxo de missões no frontend

- A partir do mapa (home) cada missão abre uma página dedicada (`missao.html`) que exibe ícone, imagem, descrição, pré-requisitos e status de geofence antes de habilitar o botão **Iniciar missão**.
- Ao iniciar, o usuário é redirecionado automaticamente para uma tela especializada por tipo:
  - `missao_batalha.html` — opções de ataque com armas/módulos equipados e log de turnos.
  - `missao_foto.html` — mural, captura via câmera e envio para `mission_photo_upload.php` antes da conclusão.
  - `missao_qr.html` — entrada manual ou leitura (quando suportada) usando a API `BarcodeDetector`, seguida da validação em `mission_qr_submit.php`.
- `missao_corrida.html` — mapa com pontos inicial/final, rota sugerida via OSRM, acompanhamento de distância e finalização automática ao atingir o destino.
- `missao_p2p.html` — checkpoints sequenciais com rota sugerida via OSRM e registro em `mission_p2p_touch.php`; a missão só termina após todos os pontos serem tocados na ordem correta.
- Todas as telas exibem botões de retorno para o detalhe da missão e informam métricas (distância, tempo, velocidade média) quando a geolocalização está ativa.
- Para dispositivos sem suporte a câmera/leitor, permanece disponível a digitação manual do QR e o envio tradicional de fotos.
- Cada tela de missão oferece um botão de **Abortar missão**, que encerra a execução atual (status `CANCELLED`) e permite tentar novamente posteriormente.

## Pacote de ícones

Os ícones padrão são SVGs embutidos (data URI) definidos em `api/init_config.php`; não há arquivos binários versionados. Para obter
um pacote zipado com esses SVGs, faça uma requisição GET para `/api/icons_package.php`.

O endpoint gera o ZIP em tempo real (pastas `missions/*.svg`, `items/*.svg` e `items/kind-*.svg`) a partir das definições atuais.
Exemplo via cURL (ajuste a URL base conforme `APP_BASE_API`):

```bash
curl -o mission_item_icons.zip "$APP_BASE_API/icons_package.php"
```

É necessário que o PHP tenha a extensão `zip`/`ZipArchive` habilitada para permitir a criação do pacote durante a requisição.

## Observações

- CORS liberado apenas para `https://negocio.tec.br` conforme especificação.
- Timezone fixado em `America/Sao_Paulo` com `SET time_zone = '-03:00'` na conexão.
- Ajuste dos minutos de recuperação do ecobot conforme tipo de missão em `APP_RECOVERY_MAP` dentro de `api/init_config.php`.
- Os atributos base sem carcaça e o ataque padrão do Ecobot vêm de `APP_ECOBOT_BASELINE_STATS` e `APP_ECOBOT_BASIC_ATTACK` definidos em `api/init_config.php`; esses valores são somados aos números retornados em `inventory_list.php`.
- Para experiência ideal nas missões geolocalizadas, habilite `navigator.geolocation` no navegador/dispositivo. Quando indisponível, os botões de início permanecem desabilitados e as telas de corrida/P2P exibem mensagens de aviso.

