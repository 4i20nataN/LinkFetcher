// Smoke battery: o que dá para validar sem backend Tauri nem rede.
// Roda headless aqui na máquina (Chromium Playwright) contra o build de
// produção (`dist-web`). Downloads reais e mobile continuam manuais.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByPlaceholder(/Cole o link|Paste link/i)).toBeVisible();
  // Dispensa o prompt de primeiro uso (cobre a tela em perfil zerado)
  const dismiss = page.getByRole('button', { name: /Agora não|Not now/ });
  if (await dismiss.count()) await dismiss.first().click();
  (page as any)._errors = errors;
});

test.afterEach(async ({ page }) => {
  const errors: string[] = (page as any)._errors ?? [];
  expect(errors).toEqual([]);
});

test('navega pelas abas sem erro', async ({ page }) => {
  for (const tab of ['Downloads', 'Favoritos', 'Configurações', 'Baixar Depois']) {
    await page.getByRole('button', { name: new RegExp(tab) }).first().click();
  }
  // Volta ao analisador
  await page.getByRole('button', { name: /Analisar Link/ }).first().click();
  await expect(page.getByPlaceholder(/Cole o link|Paste link/i)).toBeVisible();
});

test('analisar desabilitado sem URL, habilita ao digitar', async ({ page }) => {
  const btn = page.getByRole('button', { name: 'Analisar', exact: true });
  await expect(btn).toBeDisabled();
  await page.getByPlaceholder(/Cole o link|Paste link/i).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await expect(btn).toBeEnabled();
});

test('fileira de cores tem scroll lateral e persiste a escolha', async ({ page }) => {
  await page.getByRole('button', { name: /Configurações/ }).first().click();
  const row = page.locator('div.flex.gap-2.overflow-x-auto').first();
  await expect(row).toBeVisible();
  const scrollable = await row.evaluate(
    (el) => el.scrollWidth > el.clientWidth + 2,
  );
  expect(scrollable).toBe(true);
  // Escolhe Violeta e recarrega: tem que continuar selecionada
  await row.getByRole('button', { name: /Violeta/i }).click();
  await page.reload();
  await page.getByRole('button', { name: /Configurações/ }).first().click();
  const stored = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem('universal_downloader_settings') || '{}') as any).accentColor,
  );
  expect(stored).toBe('violet');
});

test('troca de idioma PT→EN→PT aplica e persiste', async ({ page }) => {
  await page.getByRole('button', { name: /Configurações/ }).first().click();
  await page.getByRole('button', { name: 'English (US)' }).click();
  await expect(page.getByRole('button', { name: /Downloads/ }).first()).toBeVisible();
  const stored = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem('universal_downloader_settings') || '{}') as any).language,
  );
  expect(stored).toBe('en');
  await page.getByRole('button', { name: 'Português (BR)' }).click();
});

test('aba downloads vazia mostra empty state', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('universal_downloader_items'));
  await page.reload();
  await page.getByRole('button', { name: /^Downloads/ }).first().click();
  await expect(page.getByText(/Nenhum download|No downloads/i)).toBeVisible();
});
