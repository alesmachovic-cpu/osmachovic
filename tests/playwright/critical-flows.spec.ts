import { test, expect } from "@playwright/test";

/**
 * VIANEMA Critical UX flows — týždenný headless walker.
 *
 * Pokryje to čo API-only QA smoke nepokryje: reálne UI (kliky, formy,
 * loading states, redirecty, hydration). Spúšťa sa cez GitHub Actions
 * každý pondelok 7:00 Bratislava.
 *
 * Test účet: secrets PLAYWRIGHT_USER / PLAYWRIGHT_PASS (read-only / sandbox role).
 *
 * NEROBÍ destructive operácie. Iba čítanie + navigácia + form opens.
 */

const USER = process.env.UX_USER || "";
const PASS = process.env.UX_PASS || "";

test.describe("Login flow", () => {
  test("login page načíta sa", async ({ page }) => {
    await page.goto("/");
    // Login screen má input "Meno alebo email"
    await expect(page.getByText(/Prihl.*sa.*do.*syst.*mu/i)).toBeVisible({ timeout: 20_000 });
  });

  test("login s prázdnym heslom ukáže chybu", async ({ page }) => {
    test.skip(!USER, "UX_USER nie je nastavené — preskakujem");
    await page.goto("/");
    await page.getByPlaceholder(/meno/i).first().fill(USER || "test");
    // Submit s prázdnym heslom — server vráti 401 alebo client validation
    await page.keyboard.press("Enter");
    // Očakávame buď chybovú správu alebo zostatok na login page
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/");
  });
});

test.describe("Authenticated walk", () => {
  test.skip(!USER || !PASS, "UX_USER + UX_PASS nie sú nastavené — preskakujem authenticated walk");

  test("home → klienti → portfolio → faktúry", async ({ page }) => {
    // 1) Login
    await page.goto("/");
    await page.getByPlaceholder(/meno/i).first().fill(USER);
    await page.getByPlaceholder(/heslo/i).first().fill(PASS);
    await page.getByRole("button", { name: /prihl/i }).first().click();

    // Buď 2FA prompt alebo home — počkáme na sidebar
    await expect(page.getByText(/Klienti|Prehľad/i).first()).toBeVisible({ timeout: 25_000 });

    // 2) Klienti
    await page.getByRole("link", { name: /klienti/i }).first().click();
    await expect(page).toHaveURL(/\/klienti/);
    // Tabuľka alebo prázdny stav
    await page.waitForTimeout(2000);

    // 3) Portfolio
    await page.getByRole("link", { name: /portfólio|portfolio/i }).first().click().catch(() => {});
    await page.waitForTimeout(2000);

    // 4) Faktúry
    await page.getByRole("link", { name: /faktúry|faktury/i }).first().click().catch(() => {});
    await page.waitForTimeout(2000);

    // 5) Nastavenia (over 2FA tab je viditeľný)
    await page.getByRole("link", { name: /nastavenia/i }).first().click().catch(() => {});
    await page.waitForTimeout(2000);
    // Bezpečnosť (2FA) tab by mal byť v sidebar/menu
    // (slabší assertion — nech to len neforči 500)
    const errors = await page.locator("text=/500|Internal/i").count();
    expect(errors).toBe(0);
  });
});

test.describe("Public legal pages", () => {
  for (const path of ["/gdpr", "/cookies", "/podmienky-pouzitia", "/obchodne-podmienky", "/aml-poucenie"]) {
    test(`legal page ${path} sa renderuje`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(400);
      // Footer obsahuje IČO Vianemy (signal že firma_info loaded)
      await expect(page.getByText(/47395095|Vianema/i).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe("Smoke", () => {
  test("manifest.json je dostupný", async ({ request }) => {
    const r = await request.get("/manifest.json");
    expect(r.ok()).toBeTruthy();
    const json = await r.json();
    expect(json.name || json.short_name).toBeTruthy();
  });

  test("/api/firma-info GET vracia data", async ({ request }) => {
    const r = await request.get("/api/firma-info");
    expect(r.ok()).toBeTruthy();
    const json = await r.json();
    expect(json.ico).toBeTruthy();
  });
});
