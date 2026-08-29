import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Home,
  SearchX,
} from "lucide-react";
import { Logo, ThemeToggle } from "./components/shared/spa-ui";

export default function NotFound() {
  return (
    <div className="not-found-page">
      <header className="not-found-header">
        <Link href="/" aria-label="Ir para a página inicial">
          <Logo compact />
        </Link>

        <ThemeToggle />
      </header>

      <main className="not-found-main">
        <div className="not-found-decoration not-found-decoration--one" />
        <div className="not-found-decoration not-found-decoration--two" />

        <section className="not-found-card">
          <div className="not-found-visual" aria-hidden="true">
            <span className="not-found-sparkle not-found-sparkle--one">
              ✦
            </span>

            <span className="not-found-sparkle not-found-sparkle--two">
              ✦
            </span>

            <div className="not-found-icon">
              <SearchX />
            </div>

            <strong>404</strong>
          </div>

          <div className="not-found-copy">
            <span className="eyebrow">
              PÁGINA NÃO ENCONTRADA
            </span>

            <h1>
              Parece que este caminho não leva ao seu{" "}
              <em>momento de cuidado.</em>
            </h1>

            <p>
              A página que você tentou acessar não existe, foi
              removida ou está temporariamente indisponível.
            </p>

            <div className="not-found-actions">
              <Link className="primary" href="/">
                <Home aria-hidden="true" />
                Voltar ao início
              </Link>

              <Link
                className="not-found-secondary"
                href="/?access=client"
              >
                <CalendarDays aria-hidden="true" />
                Acessar agendamentos
              </Link>
            </div>

            <Link className="not-found-back" href="/">
              <ArrowLeft aria-hidden="true" />
              Retornar ao SPA Express Cambucás
            </Link>
          </div>
        </section>
      </main>

      <footer className="not-found-footer">
        <p>
          © {new Date().getFullYear()} SPA Express Cambucás
        </p>

        <nav aria-label="Links institucionais">
          <Link href="/termos-de-uso">Termos de Uso</Link>

          <Link href="/politica-de-privacidade">
            Política de Privacidade
          </Link>
        </nav>
      </footer>
    </div>
  );
}