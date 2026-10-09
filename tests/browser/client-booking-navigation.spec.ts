import { test, expect, type Page, type Route, type Locator } from "@playwright/test";

const today = "2026-12-31";
const now = new Date("2026-12-31T22:00:00Z");
const serviceName = "Massagem relaxante para costas, pernas e pés";
type AvailabilityRequest = { kind: string; date: string; service: string };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function mockPortal(page: Page, options: {
  rulesUnavailable?: boolean;
  wait?: (request: AvailabilityRequest) => Promise<void> | undefined;
} = {}) {
  const queries: AvailabilityRequest[] = [];
  const forbidden: string[] = [];
  let account = 1;
  const user = () => ({
    id: "00000000-0000-4000-8000-00000000000" + account,
    aud: "authenticated", role: "authenticated", email: "cliente" + account + "@example.test",
    app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [],
  });
  const service = (id: string, name: string) => ({
    custom_duration_minutes: null, custom_price: null,
    services: { id, name, slug: id, category: "Bem-estar", description: "Serviço fictício para teste local.", duration_minutes: 60, price: 180, image_url: null, active: true },
    professionals: { id: "pro-test", display_name: "Ana Profissional de Teste", specialty: "Bem-estar", whatsapp_number: "11999999999", active: true },
  });
  const appointments = [
    { id: "booking-expired", start_at: "2026-12-31T23:00:00Z", end_at: "2027-01-01T00:00:00Z", status: "confirmed", notes: null,
      services: { name: serviceName, category: "Bem-estar", duration_minutes: 60 }, professionals: { id: "pro-test", display_name: "Ana Profissional de Teste" }, payments: [{ amount: 180, status: "pending" }] },
    { id: "booking-eligible", start_at: "2027-01-01T22:00:00Z", end_at: "2027-01-01T23:00:00Z", status: "confirmed", notes: null,
      services: { name: "Outro cuidado", category: "Bem-estar", duration_minutes: 60 }, professionals: { id: "pro-test", display_name: "Ana Profissional de Teste" }, payments: [{ amount: 180, status: "pending" }] },
  ];
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(now);
  await page.addInitScript(() => { localStorage.setItem("spaexpress-cookie-notice-v1", "acknowledged"); });
  // Toda chamada Supabase é simulada. APIs locais também são interceptadas para
  // impedir que uma rota do servidor acesse produção ou dispare notificações.
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (url.hostname === "127.0.0.1") {
      if (pathname === "/api/appointments/cancellation-rules" && request.method() === "GET") {
        return json(route, options.rulesUnavailable ? { error: "Configuração indisponível" } :
          { cancellationEnabled: true, cancellationNoticeHours: 3 }, options.rulesUnavailable ? 503 : 200);
      }
      if (pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method())) {
        forbidden.push(pathname);
        return route.abort();
      }
      return route.continue();
    }
    if (pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const payload = Buffer.from(JSON.stringify({ sub: user().id, aud: "authenticated", role: "authenticated", exp: 2_200_000_000 })).toString("base64url");
      return json(route, { access_token: "eyJhbGciOiJIUzI1NiJ9." + payload + ".mock-signature", token_type: "bearer",
        expires_in: 3600, expires_at: 2_200_000_000, refresh_token: "mock-refresh", user: user() });
    }
    if (pathname === "/auth/v1/user" && request.method() === "GET") return json(route, user());
    if (pathname === "/auth/v1/logout") { account += 1; return json(route, {}); }
    if (pathname === "/rest/v1/profiles" && request.method() === "GET") {
      return json(route, { id: user().id, full_name: "Cliente Teste " + account, email: user().email, phone: "11999999999", role: "client", active: true });
    }
    if (pathname === "/rest/v1/professional_services" && request.method() === "GET") {
      return json(route, [service("service-one", serviceName), service("service-two", "Outro serviço")]);
    }
    if (pathname === "/rest/v1/appointments" && request.method() === "GET") return json(route, appointments);
    if (pathname === "/rest/v1/rpc/get_available_slots" || pathname === "/rest/v1/rpc/get_booking_gap_suggestions") {
      const input = request.postDataJSON();
      const query = { kind: pathname.endsWith("get_available_slots") ? "slots" : "gaps", date: input.p_date, service: input.p_service_id };
      queries.push(query);
      await options.wait?.(query);
      if (query.date === today) return json(route, []);
      const label = query.date === "2027-01-01" ? "11:00" : "12:00";
      if (query.kind === "slots") return json(route, [{ slot_start: query.date + "T" + label + ":00-03:00", slot_end: query.date + "T13:00:00-03:00", slot_label: label }]);
      return json(route, [{ gap_start: query.date + "T14:00:00-03:00", gap_end: query.date + "T14:20:00-03:00", available_minutes: 20,
        gap_start_label: query.date === "2027-01-01" ? "14:00" : "15:00", gap_end_label: query.date === "2027-01-01" ? "14:20" : "15:20" }]);
    }
    if (pathname.startsWith("/rest/v1/") && request.method() === "GET") return json(route, []);
    if (pathname.startsWith("/auth/") || pathname.startsWith("/rest/")) forbidden.push(pathname);
    return route.abort(); // inclui imagens/fontes externas; nenhuma rede externa é liberada
  });

  async function login() {
    await page.locator('input[type="email"]').fill("cliente" + account + "@example.test");
    await page.locator('input[type="password"]').fill("senha-ficticia-123");
    await page.getByRole("button", { name: "Entrar na minha conta →", exact: true }).click();
    await expect(page.locator(".client-portal")).toBeVisible();
  }
  await page.goto("/?access=client");
  await login();
  return { queries, forbidden, login };
}

async function tab(page: Page, name: string) {
  const desktop = page.locator(".client-desktop-navigation").getByRole("button", { name, exact: true });
  if (await desktop.isVisible()) return desktop.click();
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.locator("#client-navigation").getByRole("button", { name, exact: true }).click();
}

async function openService(page: Page, index = 0) {
  await page.getByRole("button", { name: "Ver horários disponíveis →", exact: true }).nth(index).click();
  await expect(page.getByLabel("Data do atendimento")).toHaveValue(today);
}

async function paint(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function assertNoticeLayout(group: Locator, mobile: boolean) {
  const metrics = await group.evaluate((element) => {
    const buttons = element.querySelector(".client-booking-action-buttons")!.getBoundingClientRect();
    const notice = element.querySelector(".client-cancellation-notice")!.getBoundingClientRect();
    const card = element.closest(".client-booking, .next-appointment")!.getBoundingClientRect();
    return { buttons: { bottom: buttons.bottom, right: buttons.right }, notice: { top: notice.top, right: notice.right, left: notice.left }, card: { left: card.left, right: card.right },
      align: getComputedStyle(element.querySelector(".client-cancellation-notice")!).textAlign };
  });
  expect(metrics.notice.top).toBeGreaterThanOrEqual(metrics.buttons.bottom);
  expect(metrics.notice.left).toBeGreaterThanOrEqual(metrics.card.left);
  expect(metrics.notice.right).toBeLessThanOrEqual(metrics.card.right);
  expect(metrics.align).toBe(mobile ? "left" : "right");
  if (!mobile) expect(Math.abs(metrics.notice.right - metrics.buttons.right)).toBeLessThan(2);
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
  const mobile = viewport.width < 640;
  test.describe("cliente " + viewport.width + "px", () => {
    test.use({ viewport });

    test("hoje, setas, calendário, atalhos e reabertura ficam sincronizados", async ({ page }, info) => {
      const mocks = await mockPortal(page);
      await openService(page);
      const date = page.getByLabel("Data do atendimento");
      const previous = page.getByRole("button", { name: "Dia anterior", exact: true });
      const next = page.getByRole("button", { name: "Próximo dia", exact: true });
      await expect(previous).toBeDisabled();
      await expect(previous).toHaveAttribute("type", "button");
      await expect(next).toHaveAttribute("type", "button");
      await expect(date).toHaveAttribute("min", today);
      await expect(page.getByText("Não há horários livres ou possíveis encaixes nesta data. Escolha outro dia.")).toBeVisible();
      await expect(page.locator(".confirm-schedule")).toBeDisabled();
      await next.click();
      await expect(date).toHaveValue("2027-01-01");
      await expect(previous).toBeEnabled();
      await expect(page.locator(".availability-days button.active b")).toHaveText("01");
      await page.locator(".available-times").getByRole("button", { name: "11:00", exact: true }).click();
      await expect(page.locator(".confirm-schedule")).toBeEnabled();
      await next.click();
      await expect(date).toHaveValue("2027-01-02");
      await expect(page.locator(".confirm-schedule")).toBeDisabled();
      await expect(page.locator(".schedule-summary")).toContainText("Selecione");
      await previous.click();
      await expect(date).toHaveValue("2027-01-01");
      await date.fill("2027-01-31");
      await next.click();
      await expect(date).toHaveValue("2027-02-01");
      await previous.click();
      await expect(date).toHaveValue("2027-01-31");
      await page.locator(".availability-days button").nth(2).click();
      await expect(date).toHaveValue("2027-02-02");
      await expect(page.locator(".booking-gap-list")).toContainText("15:00 às 15:20");
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      await expect(page.locator(".schedule-summary")).toContainText("02/02/2027");
      await date.fill("2026-12-30");
      await expect(date).toHaveValue("2027-02-02");
      await date.fill(today);
      await expect(previous).toBeDisabled();
      await expect.poll(() => mocks.queries.filter((q) => q.date === today).map((q) => q.kind)).toEqual(expect.arrayContaining(["slots", "gaps"]));
      await expect(page.locator(".available-times button")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      await page.screenshot({ path: info.outputPath("schedule.png"), fullPage: true, animations: "disabled" });
      await next.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await expect(date).toHaveValue("2027-01-02");
      await page.getByRole("button", { name: "Voltar para serviços", exact: true }).click();
      await openService(page, 1);
      await expect.poll(() => mocks.queries.some((q) => q.service === "service-two" && q.date === today && q.kind === "slots")).toBe(true);
      expect(mocks.forbidden).toEqual([]);
    });

    test("respostas antigas não substituem a data atual nem encerram seu loading", async ({ page }) => {
      const old = deferred(), current = deferred();
      const mocks = await mockPortal(page, { wait: (q) => q.date === "2027-01-01" ? old.promise : q.date === "2027-01-02" ? current.promise : undefined });
      await openService(page);
      await page.getByRole("button", { name: "Próximo dia", exact: true }).click();
      await expect.poll(() => mocks.queries.filter((q) => q.date === "2027-01-01").length).toBe(2);
      await page.getByRole("button", { name: "Próximo dia", exact: true }).click();
      await expect.poll(() => mocks.queries.filter((q) => q.date === "2027-01-02").length).toBe(2);
      const oldResponse = page.waitForResponse((response) => response.url().includes("get_available_slots") && response.request().postDataJSON().p_date === "2027-01-01");
      old.resolve();
      await oldResponse;
      await paint(page);
      await expect(page.getByLabel("Data do atendimento")).toHaveValue("2027-01-02");
      await expect(page.getByText("Consultando agenda...", { exact: false })).toBeVisible();
      await expect(page.locator(".available-times button")).toHaveCount(0);
      current.resolve();
      await expect(page.locator(".available-times").getByRole("button", { name: "12:00", exact: true })).toBeVisible();
      await expect(page.locator(".available-times").getByRole("button", { name: "11:00", exact: true })).toHaveCount(0);
      await expect(page.locator(".booking-gap-list")).toContainText("15:00 às 15:20");
      await expect(page.locator(".booking-gap-list")).not.toContainText("14:00");
      expect(mocks.forbidden).toEqual([]);
    });

    test("consulta abandonada não atualiza componente remontado nem outro acesso", async ({ page }) => {
      const old = deferred(), another = deferred();
      const mocks = await mockPortal(page, { wait: (q) => q.date === "2027-01-01" ? old.promise : q.date === "2027-01-02" ? another.promise : undefined });
      await openService(page);
      await page.getByRole("button", { name: "Próximo dia", exact: true }).click();
      await expect.poll(() => mocks.queries.filter((q) => q.date === "2027-01-01").length).toBe(2);
      await tab(page, "Meus agendamentos");
      await tab(page, "Serviços");
      await openService(page);
      old.resolve();
      await paint(page);
      await expect(page.getByLabel("Data do atendimento")).toHaveValue(today);
      await expect(page.locator(".available-times button")).toHaveCount(0);
      await page.getByLabel("Data do atendimento").fill("2027-01-02");
      await expect.poll(() => mocks.queries.filter((q) => q.date === "2027-01-02").length).toBe(2);
      if (mobile) {
        await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
        await page.getByRole("button", { name: "Sair da conta", exact: true }).click();
      } else await page.getByRole("button", { name: "Sair", exact: true }).click();
      await expect(page.locator(".client-portal")).toHaveCount(0);
      await mocks.login();
      await openService(page);
      another.resolve();
      await paint(page);
      await expect(page.getByLabel("Data do atendimento")).toHaveValue(today);
      await expect(page.locator(".available-times button")).toHaveCount(0);
      await expect(page.getByText("Consultando agenda...", { exact: false })).toHaveCount(0);
      expect(mocks.forbidden).toEqual([]);
    });

    test("aviso fica abaixo das ações e a FAQ e o diálogo mantêm a antecedência", async ({ page }, info) => {
      const mocks = await mockPortal(page);
      await tab(page, "Meus agendamentos");
      const card = page.locator(".client-booking").first();
      await expect(card.locator(".client-cancellation-notice")).toHaveText("Prazo de cancelamento encerrado.");
      await assertNoticeLayout(card.locator(".client-booking-actions"), mobile);
      await expect(card).toContainText(serviceName);
      await expect(card).toContainText("Ana Profissional de Teste");
      await expect(card).toContainText("180,00");
      await page.screenshot({ path: info.outputPath("appointments.png"), fullPage: true, animations: "disabled" });
      await page.locator(".client-booking").nth(1).getByRole("button", { name: "Cancelar", exact: true }).click();
      await expect(page.locator(".action-dialog")).toContainText("3 hora(s) de antecedência");
      await page.locator(".action-dialog").getByRole("button", { name: "Voltar", exact: true }).click();
      await tab(page, "Início");
      await expect(page.locator(".next-appointment .client-cancellation-notice")).toHaveText("Prazo de cancelamento encerrado.");
      await assertNoticeLayout(page.locator(".next-appointment .client-booking-actions"), mobile);
      await page.getByText("Posso cancelar um horário?", { exact: false }).click();
      await expect(page.locator(".client-faq")).toContainText("3 hora(s) de antecedência");
      await page.screenshot({ path: info.outputPath("home.png"), fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
      expect(mocks.forbidden).toEqual([]);
    });

    test("configuração indisponível mantém aviso distinto e bloqueia o cancelamento", async ({ page }) => {
      const mocks = await mockPortal(page, { rulesUnavailable: true });
      await tab(page, "Meus agendamentos");
      await expect(page.locator(".client-booking").first().locator(".client-cancellation-notice")).toContainText("Não foi possível consultar");
      await expect(page.locator(".client-booking").first().getByRole("button", { name: "Indisponível", exact: true })).toBeDisabled();
      await assertNoticeLayout(page.locator(".client-booking").first().locator(".client-booking-actions"), mobile);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
      expect(mocks.forbidden).toEqual([]);
    });
  });
}
