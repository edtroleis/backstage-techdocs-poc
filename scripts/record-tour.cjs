// Grava um tour do portal de docs (TechDocs) do Backstage local.
// Uso: node tour.cjs <app-dir> <out-dir>
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');

const [appDir, outDir] = process.argv.slice(2);
const { chromium } = createRequire(path.join(appDir, 'package.json'))('@playwright/test');
const BASE = 'http://localhost:3000';
const W = 1440;
const H = 900;

// Cursor visível e legenda, injetados na página (vídeos do Playwright não mostram o mouse)
const overlay = () => {
  const install = () => {
    if (document.getElementById('tour-cursor')) return;
    const c = document.createElement('div');
    c.id = 'tour-cursor';
    Object.assign(c.style, {
      position: 'fixed', zIndex: 2147483647, width: '22px', height: '22px', borderRadius: '50%',
      background: 'rgba(250, 204, 21, .55)', border: '2px solid #facc15', pointerEvents: 'none',
      transform: 'translate(-50%, -50%)', transition: 'width .15s, height .15s', left: '-50px', top: '-50px',
    });
    const cap = document.createElement('div');
    cap.id = 'tour-caption';
    Object.assign(cap.style, {
      position: 'fixed', zIndex: 2147483646, left: '50%', bottom: '28px', transform: 'translateX(-50%)',
      background: 'rgba(15, 23, 42, .92)', color: '#fff', padding: '12px 22px', borderRadius: '10px',
      font: '600 20px/1.35 system-ui, sans-serif', boxShadow: '0 6px 24px rgba(0,0,0,.4)',
      border: '1px solid rgba(255,255,255,.15)', pointerEvents: 'none', opacity: '0', transition: 'opacity .3s',
      maxWidth: '80%', textAlign: 'center',
    });
    document.body.append(c, cap);
    document.addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    document.addEventListener('mousedown', () => { c.style.width = c.style.height = '14px'; }, true);
    document.addEventListener('mouseup', () => { c.style.width = c.style.height = '22px'; }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    colorScheme: 'dark',
    recordVideo: { dir: outDir, size: { width: W, height: H } },
  });
  await context.addInitScript(overlay);
  const page = await context.newPage();
  const pause = ms => page.waitForTimeout(ms);
  let mouse = { x: W / 2, y: H / 2 };

  const caption = async (text, ms = 0) => {
    await page.evaluate(t => {
      const cap = document.getElementById('tour-caption');
      if (!cap) return;
      cap.textContent = t;
      cap.style.opacity = t ? '1' : '0';
    }, text);
    if (ms) await pause(ms);
  };
  const moveTo = async (x, y) => {
    await page.mouse.move(x, y, { steps: 25 });
    mouse = { x, y };
  };
  const click = async (locator, wait = 1800) => {
    const el = locator.first();
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    await moveTo(box.x + box.width / 2, box.y + box.height / 2);
    await pause(350);
    await page.mouse.down();
    await page.mouse.up();
    await pause(wait);
  };
  const hover = async (locator, wait = 1200) => {
    const el = locator.first();
    const box = await el.boundingBox();
    await moveTo(box.x + box.width / 2, box.y + box.height / 2);
    await pause(wait);
  };
  const scroll = async (total, step = 120, delay = 90) => {
    for (let d = 0; Math.abs(d) < Math.abs(total); d += step * Math.sign(total)) {
      await page.mouse.wheel(0, step * Math.sign(total));
      await pause(delay);
    }
  };
  const toTop = () => page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })).then(() => pause(700));
  const nav = text => page.locator('nav').getByText(text, { exact: true });
  const docLink = text => page.getByRole('link', { name: text, exact: true });
  // grupo recolhível do menu da doc (mkdocs material: <label class="md-nav__link">)
  const section = text => page.locator('label.md-nav__link').filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });

  // ---------------------------------------------------------------- abertura + login
  await page.goto(BASE);
  await pause(1500);
  await caption('Backstage + TechDocs · portal de documentação', 2200);
  await click(page.getByRole('button', { name: /enter/i }), 3000);

  await caption('O menu Docs organiza a documentação em seções', 0);
  await hover(nav('Docs'), 2200);

  // ---------------------------------------------------------------- 1. onboarding
  await caption('1 · On Boarding: a trilha de chegada de quem entra no time');
  await click(nav('On Boarding'), 4000);
  await scroll(700);
  await pause(1200);
  await click(docLink('Primeiros dias'), 2500);
  await scroll(500);
  await pause(1500);

  // ---------------------------------------------------------------- 2. wikis
  await caption('2 · Wikis: cards montados a partir do catálogo');
  await click(nav('Wikis'), 3500);
  await hover(page.locator('.MuiCard-root', { hasText: 'Wiki de Arquitetura' }), 1500);
  await caption('Wiki de Arquitetura: pronta para apresentações');
  await click(page.locator('.MuiCard-root', { hasText: 'Wiki de Arquitetura' }).getByText('Acessar documentação'), 4000);
  await scroll(900, 150);
  await pause(1500);
  await toTop();
  await caption('Visão executiva: diagramas mermaid direto do Markdown');
  await click(docLink('Visão executiva'), 3500);
  await scroll(800, 120);
  await pause(1200);
  await toTop();
  await click(section('Visão geral'), 1200);
  await caption('Camadas e integrações: mermaid + PlantUML, abas e avisos');
  await click(docLink('Camadas e integrações'), 3500);
  await scroll(1900, 150);
  await pause(1500);
  await toTop();

  // ---------------------------------------------------------------- 3. avaliar
  await caption('3 · Avaliar: 1 a 5 estrelas, com a média ao lado');
  await hover(page.getByTestId('entity-feedback-star-button-3'), 700);
  await hover(page.getByTestId('entity-feedback-star-button-4'), 700);
  await click(page.getByTestId('entity-feedback-star-button-5'), 2500);
  await caption('A média é atualizada na hora (as notas ficam no banco do Backstage)', 2500);

  // ---------------------------------------------------------------- 4. comentar
  await caption('4 · Comentar: botão sempre visível, abre uma issue no GitHub da doc');
  await hover(page.getByRole('button', { name: 'Comentar' }), 3000);
  await caption('…ou selecione um trecho para comentar exatamente aquele parágrafo');
  const para = page.locator('article p').nth(1);
  const pbox = await para.boundingBox();
  await moveTo(pbox.x + 4, pbox.y + 6);
  await page.mouse.down();
  await page.mouse.move(pbox.x + Math.min(pbox.width, 520), pbox.y + pbox.height - 6, { steps: 30 });
  await page.mouse.up();
  await pause(1200);
  await hover(page.getByText('Open new Github issue'), 3000);
  await page.mouse.click(W - 60, H - 120);
  await pause(800);

  // ---------------------------------------------------------------- 5. golden paths
  await caption('Voltar para a seção, sem perder o contexto');
  await click(page.getByRole('link', { name: /Voltar para Wikis/ }), 3000);
  await caption('5 · Golden Paths: o caminho pavimentado, do zero à produção');
  await click(nav('Golden Paths'), 3000);
  await click(page.locator('.MuiCard-root', { hasText: 'Service - do zero à produção' }).getByText('Acessar golden path'), 4000);
  await scroll(700);
  await pause(1000);
  await click(section('Referência'), 1200);
  await click(docLink('Checklist de produção'), 3000);
  await scroll(500);
  await pause(1500);

  // ---------------------------------------------------------------- 6. manuais
  await caption('6 · Manuais: com selo de status (produtivo, em construção, descontinuado)');
  await click(nav('Manuais'), 3500);
  for (const t of ['Podman Desktop', 'OpenShift Dev Spaces', 'WSL/RHEL']) {
    await hover(page.locator('.MuiCard-root', { hasText: t }).locator('.MuiChip-root').first(), 1300);
  }
  await caption('OpenShift Dev Spaces: manual com trilha de onboarding da solução');
  await click(page.locator('.MuiCard-root', { hasText: 'OpenShift Dev Spaces' }).getByText('Acessar manual'), 4000);
  await scroll(600);
  await pause(1000);
  await toTop();
  await click(section('Onboarding'), 1200);
  await click(docLink('Trilha de onboarding'), 3500);
  await scroll(700);
  await pause(1500);

  // ---------------------------------------------------------------- 7. serviço com doc
  await caption('7 · Serviço COM documentação: a doc mora no repositório do serviço');
  await click(nav('Catalog'), 3000);
  await click(page.getByRole('link', { name: 'Pedidos Service', exact: true }), 3000);
  await click(page.getByRole('tab', { name: 'TechDocs' }).or(page.getByRole('link', { name: 'TechDocs', exact: true })), 4000);
  await click(docLink('Arquitetura'), 3500);
  await scroll(800);
  await pause(1500);

  // ---------------------------------------------------------------- 8. serviço sem doc
  await caption('8 · Serviço SEM documentação: um guia passo a passo no lugar do erro');
  await click(nav('Catalog'), 3000);
  await click(page.getByRole('link', { name: 'Pagamentos Service', exact: true }), 3000);
  await click(page.getByRole('tab', { name: 'TechDocs' }).or(page.getByRole('link', { name: 'TechDocs', exact: true })), 3500);
  await scroll(1300, 130, 110);
  await pause(1200);
  await caption('Arquivos já preenchidos, com botões que criam tudo direto no GitHub', 2500);
  await toTop();

  // ---------------------------------------------------------------- 9. all docs + busca
  await caption('9 · All Docs: todas as docs, com time dono e tipo');
  await click(nav('All Docs'), 3500);
  await scroll(800);
  await pause(1200);
  await toTop();
  await caption('Busca em todo o conteúdo das docs');
  await click(page.getByRole('button', { name: /search/i }).or(nav('Search')), 1500);
  await page.keyboard.type('rollback', { delay: 120 });
  await pause(3500);

  await caption('Backstage + TechDocs · docs-as-code, publicadas no Azure Blob', 3500);
  await caption('');
  await pause(500);

  const video = page.video();
  await context.close();
  await browser.close();
  const src = await video.path();
  const dest = path.join(outDir, 'techdocs-tour.webm');
  fs.renameSync(src, dest);
  console.log(dest);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
