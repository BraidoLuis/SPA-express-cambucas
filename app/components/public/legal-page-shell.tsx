"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { Logo, ThemeToggle } from "../shared/spa-ui";
import {
  getPublicSpaSettings,
  type PublicSpaSettings,
} from "../../lib/services/public-settings-service";

const BUSINESS_CNPJ = "INSERIR CNPJ AQUI";

export function LegalPageShell({
  eyebrow,
  title,
  description,
  lastUpdated,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  const [settings, setSettings] =
    useState<PublicSpaSettings | null>(null);

  useEffect(() => {
    let active = true;

    getPublicSpaSettings()
      .then((result) => {
        if (active) {
          setSettings(result);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const business = settings?.business;
  const businessName = business?.name || "SPA Express Cambucás";

  const phoneHref = business?.phone
    ? `tel:${business.phone.replace(/[^\d+]/g, "")}`
    : "";

  const emailHref = business?.email
    ? `mailto:${business.email}`
    : "";

  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link href="/" aria-label="Voltar ao início">
          <Logo compact />
        </Link>

        <div className="legal-header-actions">
          <ThemeToggle />

          <Link className="legal-back-button" href="/">
            <ArrowLeft aria-hidden="true" />
            <span>Voltar ao site</span>
          </Link>
        </div>
      </header>

      <main className="legal-main">
        <section className="legal-hero">
          <span className="eyebrow">{eyebrow}</span>

          <h1>{title}</h1>

          <p>{description}</p>

          <small>Última atualização: {lastUpdated}</small>
        </section>

        <article className="legal-content">
          {children}

          <section className="legal-contact" id="contato">
            <span className="eyebrow">CONTATO</span>

            <h2>Fale conosco</h2>

            <p>
              Em caso de dúvidas sobre estes documentos ou sobre o
              tratamento dos seus dados pessoais, entre em contato
              com o {businessName}.
            </p>

            <div className="legal-contact-details">
              {business?.email && (
                <a href={emailHref}>
                  <Mail aria-hidden="true" />

                  <span>
                    <small>E-mail</small>
                    <b>{business.email}</b>
                  </span>
                </a>
              )}

              {business?.phone && (
                <a href={phoneHref}>
                  <Phone aria-hidden="true" />

                  <span>
                    <small>Telefone</small>
                    <b>{business.phone}</b>
                  </span>
                </a>
              )}
            </div>

            <div className="legal-business-data">
              <p>
                <b>Responsável:</b> Eliane
              </p>

              <p>
                <b>Estabelecimento:</b> {businessName}
              </p>

              <p>
                <b>CNPJ:</b> {BUSINESS_CNPJ}
              </p>

              <p>
                <b>Endereço:</b> Avenida Dedo de Deus, 1200,
                Centro, Guapimirim — RJ, CEP 25940-000
              </p>
            </div>
          </section>
        </article>
      </main>

      <footer className="legal-footer">
        <div>
          <Logo />

          <p>
            Beleza, cuidado e bem-estar em cada atendimento.
          </p>
        </div>

        <nav aria-label="Documentos jurídicos">
          <Link href="/">Página inicial</Link>
          <Link href="/termos-de-uso">Termos de Uso</Link>
          <Link href="/politica-de-privacidade">
            Política de Privacidade
          </Link>
        </nav>

        <p>
          © {new Date().getFullYear()} {businessName}. Todos os
          direitos reservados.
        </p>
      </footer>
    </div>
  );
}