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

4. Suba o servidor local para testes (PHP embutido):

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

