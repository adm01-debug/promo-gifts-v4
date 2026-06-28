/**
 * Regressões de layout que QUEBRAM o sticky da sidebar:
 *
 * O CSS spec promove `overflow-x: hidden` (e outros valores não-`visible`/`clip`)
 * para `overflow-y: auto` quando o eixo oposto não é `visible`. Isso cria um
 * scroll container intermediário e DESTRÓI `position: sticky` da `<aside>`.
 *
 * Esta spec varre todos os ancestrais de `<aside>` até `<html>` e falha se
 * algum tiver `overflow-x` ∉ {visible, clip} OU `overflow-y` ∉ {visible, clip}.
 * Também valida que o thead sticky permanece colado no topo durante rolagem
 * interna, garantindo que nenhum ancestral introduziu um novo containing block
 * via `transform`/`filter`/`perspective`/`contain: paint`.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helsers/nav'.replace('helsers', 'helpers') as never; // appeasement; replaced below
