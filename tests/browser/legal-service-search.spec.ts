import { test, expect, type Page, type Route } from "@playwright/test";

const homeTitle = "SPA Express Cambucás | Massagem e Estética em Guapimirim";
const noResults = "Nenhum serviço corresponde à pesquisa e aos filtros selecionados.";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated", role: "authenticated", email: "cliente@example.test",
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [],
};
const catalog = [
  ...Array.from({ length: 6 }, (_, i) => ({ name: "Drenagem Linfática " + (i + 1), category: i < 4 ? "Corporal" : "Bem-estar", pro: i % 2 === 0 ? "a" : "b" })),
  { name: "Massagem Relaxante", category: "Bem-estar", pro: "b" },
  { name: "Depilação Facial", category: "Facial", pro: "a" },
].map((service, i) => ({
  custom_duration_minutes: null, custom_price: null,
  services: { id: "service-" + i, slug: "service-" + i, name: service.name, category: service.category,
    description: "Descrição especial que não deve ser pesquisada.", duration_minutes: 60, price: 180, image_url: null, active: true },
  professionals: { id: "pro-" + service.pro, display_name: service.pro === "a" ? "Ana Teste" : "Bia Teste", specialty: "Bem-estar", whatsapp_number: null, active: true },
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function mockServices(page: Page, delayCatalog?: Promise<void>) {
  const requests: string[] = [];
  const forbidden: string[] = [];
  const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("spaexpress-cookie-notice-v1", "acknowledged");
    localStorage.setItem("spa-theme", "light");
  });
  // Nenhuma chamada chega ao Supabase ou a APIs locais: todos os contratos
  // usados aqui são fictícios. Fontes, imagens e demais assets locais são reais.
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (url.hostname === "127.0.0.1") {
      if (pathname === "/api/appointments/cancellation-rules" && request.method() === "GET") {
        return json(route, { cancellationEnabled: true, cancellationNoticeHours: 2 });
      }
      if (pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method())) {
        forbidden.push(pathname);
        return route.abort();
      }
      return route.continue();
    }
    requests.push(pathname);
    if (pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const payload = Buffer.from(JSON.stringify({ sub: user.id, aud: "authenticated", role: "authenticated", exp: 2_200_000_000 })).toString("base64url");
      return json(route, { access_token: "eyJhbGciOiJIUzI1NiJ9." + payload + ".mock-signature",
        token_type: "bearer", expires_in: 3600, expires_at: 2_200_000_000, refresh_token: "mock-refresh", user });
    }
    if (pathname === "/auth/v1/user" && request.method() === "GET") return json(route, user);
    if (pathname === "/rest/v1/profiles" && request.method() === "GET") {
      return json(route, { id: user.id, full_name: "Cliente Teste", email: user.email, phone: "11999999999", role: "client", active: true });
    }
    if (pathname === "/rest/v1/professional_services" && request.method() === "GET") {
      await delayCatalog;
      return json(route, catalog);
    }
    if (pathname === "/rest/v1/rpc/get_public_spa_settings") {
      return json(route, { business: { name: "SPA Express Cambucás", phone: null, email: null, description: null, whatsappUrl: null, instagramUrl: null }, businessHours: {} });
    }
    if (pathname.startsWith("/rest/v1/") && request.method() === "GET") return json(route, []);
    if (pathname.startsWith("/rest/") || pathname.startsWith("/auth/")) forbidden.push(pathname);
    return route.abort();
  });
  return { requests, forbidden };
}

async function openCatalog(page: Page, surface: "home" | "cliente") {
  await page.goto(surface === "home" ? "/" : "/?access=client");
  if (surface === "cliente") {
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill("senha-ficticia-123");
    await page.getByRole("button", { name: "Entrar na minha conta →", exact: true }).click();
    await expect(page.locator(".client-portal")).toBeVisible();
  }
  return page.locator(surface === "home" ? "#servicos" : ".service-catalog");
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const input = page.getByLabel("Pesquisar serviços", { exact: true });
  if (await input.count()) {
    const box = await input.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(80);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
}

for (const width of [1440, 390, 320]) {
  test.describe(width + "px", () => {
    test.use({ viewport: { width, height: width === 1440 ? 1000 : 844 } });

    for (const surface of ["home", "cliente"] as const) {
      test("pesquisa e filtros locais: " + surface, async ({ page }, info) => {
        const mocks = await mockServices(page);
        const scope = await openCatalog(page, surface);
        const cards = scope.locator(surface === "home" ? ".service-card" : ".client-service-grid > article");
        const grid = scope.locator(surface === "home" ? ".service-grid" : ".client-service-grid");
        const input = page.getByLabel("Pesquisar serviços", { exact: true });
        const professional = scope.locator(".professional-filter select");
        await expect(cards).toHaveCount(8);
        await page.waitForLoadState("networkidle");
        const initialQueries = mocks.requests.length;
        await expect(page).toHaveTitle(homeTitle);
        await expect(input).toHaveAttribute("type", "search");
        await expect(professional).toHaveAccessibleName(/Profissional/);

        for (const [query, count] of [
          ["linfatica", 6], ["LINFÁTICA", 6], ["  LiNfÁtIcA  ", 6], ["nagem lin", 6],
          ["linfatica 2", 1], ["depilacao", 1], ["DEPILAÇÃO", 1], ["massag", 1],
          ["especial", 0], ["Bia", 0], ["   ", 8],
        ] as const) {
          await input.fill(query);
          await expect(cards).toHaveCount(count);
          if (count === 0) await expect(scope.getByRole("status")).toHaveText(noResults + "Limpar filtros");
        }

        await input.fill("");
        await expect(cards).toHaveCount(8);
        if (width < 720) {
          await grid.evaluate((element) => { element.scrollLeft = element.scrollWidth - element.clientWidth; });
          await expect.poll(() => grid.evaluate((element) => element.scrollLeft)).toBeGreaterThan(100);
        }
        await input.fill("linfatica");
        await expect(cards).toHaveCount(6);
        // O snap da home alinha o primeiro cartão após seu padding existente.
        const startPadding = await grid.evaluate((element) => parseFloat(getComputedStyle(element).paddingLeft));
        await expect.poll(() => grid.evaluate((element) => Math.abs(element.scrollLeft))).toBeLessThanOrEqual(startPadding + 1);
        const position = await cards.first().evaluate((element) => {
          const card = element.getBoundingClientRect();
          const container = element.parentElement!.getBoundingClientRect();
          return { left: card.left - container.left, right: card.right - container.right };
        });
        expect(position.left).toBeGreaterThanOrEqual(-1);
        expect(position.right).toBeLessThanOrEqual(1);
        await scope.locator(".service-search").evaluate((element) => {
          window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - 110, behavior: "instant" });
        });
        await noOverflow(page);
        await page.screenshot({ path: info.outputPath("search-" + surface + "-" + width + "-light.png"), animations: "disabled" });

        await scope.getByRole("button", { name: "Corporal", exact: true }).click();
        await expect(cards).toHaveCount(4);
        await professional.selectOption("pro-a");
        await expect(cards).toHaveCount(2);
        await scope.getByRole("button", { name: "Limpar pesquisa", exact: true }).focus();
        await page.keyboard.press("Enter");
        await expect(input).toHaveValue("");
        await expect(input).toBeFocused();
        await expect(professional).toHaveValue("pro-a");
        await expect(cards).toHaveCount(2);
        await input.fill("linfatica");
        await scope.getByRole("button", { name: "Facial", exact: true }).click();
        await expect(cards).toHaveCount(0);
        await expect(scope.getByRole("status")).toContainText(noResults);
        await noOverflow(page);
        await page.screenshot({ path: info.outputPath("search-" + surface + "-" + width + "-empty.png"), animations: "disabled" });
        await scope.getByRole("button", { name: "Limpar filtros", exact: true }).click();
        await expect(input).toHaveValue("");
        await expect(professional).toHaveValue("all");
        await expect(cards).toHaveCount(8);
        await expect(scope.getByRole("button", { name: "Todos", exact: true })).toHaveClass("active");
        await expect(cards.locator("h3")).toHaveCount(8);
        await expect(cards.getByRole("button", { name: surface === "home" ? "Agendar este serviço" : "Ver horários disponíveis →", exact: true })).toHaveCount(8);
        await page.waitForLoadState("networkidle");
        expect(mocks.requests.length).toBe(initialQueries);
        expect(mocks.forbidden).toEqual([]);

        await page.getByRole("button", { name: "Ativar modo escuro", exact: true }).click();
        await expect(page.locator("html")).toHaveClass(/dark-theme/);
        await expect(input).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
        await scope.locator(".service-search").evaluate((element) => {
          window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - 110, behavior: "instant" });
        });
        await noOverflow(page);
        await page.screenshot({ path: info.outputPath("search-" + surface + "-" + width + "-dark.png"), animations: "disabled" });
      });
    }

    test("títulos e conteúdo das páginas legais", async ({ page }, info) => {
      const mocks = await mockServices(page);
      for (const [pathname, name, description] of [
        ["/termos-de-uso", "Termos de Uso", "Conheça as condições de uso, cadastro e agendamento do SPA Express Cambucás."],
        ["/politica-de-privacidade", "Política de Privacidade", "Saiba como o SPA Express Cambucás coleta, utiliza e protege seus dados pessoais."],
      ]) {
        await page.goto(pathname);
        await expect(page).toHaveTitle(name + " | SPA Express Cambucás");
        expect((await page.title()).match(/SPA Express Cambucás/g)).toHaveLength(1);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", description);
        await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
        const cnpj = page.locator(".legal-business-data p").filter({ hasText: "CNPJ:" });
        await expect(cnpj).toHaveText("CNPJ: 22.343.573/0001-50");
        await expect(cnpj).toBeVisible();
        await expect(page.getByText("INSERIR CNPJ AQUI", { exact: false })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (pathname === "/termos-de-uso") {
          await expect(page.getByText("Última atualização: 9 de outubro de 2026", { exact: true })).toBeVisible();
          const cancellation = page.locator("#cancelamentos");
          await expect(cancellation).toContainText("atualmente de duas horas");
          await expect(cancellation).toContainText("inclusive exatamente no limite");
          await expect(cancellation).toContainText("mais de duas horas");
          await expect(cancellation).toContainText("esse prazo adicional não se aplica");
          await expect(cancellation).toContainText("contato não garante cancelamento ou reagendamento");
          await cancellation.scrollIntoViewIfNeeded();
          await page.screenshot({ path: info.outputPath("terms-cancellation-" + width + ".png"), animations: "disabled" });
        } else {
          await expect(page.getByText("Última atualização: 22 de setembro de 2026", { exact: true })).toBeVisible();
        }
      }
      expect(mocks.forbidden).toEqual([]);
    });
  });
}

for (const surface of ["home", "cliente"] as const) {
  test("pesquisa durante o carregamento mantém a consulta: " + surface, async ({ page }) => {
    const pending = deferred();
    const mocks = await mockServices(page, pending.promise);
    try {
      const scope = await openCatalog(page, surface);
      const cards = scope.locator(surface === "home" ? ".service-card" : ".client-service-grid > article");
      const input = page.getByLabel("Pesquisar serviços", { exact: true });
      await expect.poll(() => mocks.requests.filter((p) => p === "/rest/v1/professional_services").length).toBe(1);
      await input.fill("LINFÁTICA");
      if (surface === "cliente") {
        await expect(scope.getByText("Carregando os serviços...")).toBeVisible();
        await expect(scope.getByRole("status")).toHaveCount(0);
      } else {
        await expect(cards).toHaveCount(1); // catálogo local de fallback mantido
      }
      pending.resolve();
      await expect(cards).toHaveCount(6);
      await expect(input).toHaveValue("LINFÁTICA");
      await expect(scope.getByText("Carregando os serviços...")).toHaveCount(0);
      expect(mocks.requests.filter((p) => p === "/rest/v1/professional_services")).toHaveLength(1);
      expect(mocks.forbidden).toEqual([]);
    } finally {
      pending.resolve();
    }
  });
}
