import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section
      id="inicio"
      className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[var(--brand-blue)] px-4 pb-14 pt-28 text-white"
    >
      <Image
        src="/img/logo_png.png"
        alt=""
        aria-hidden="true"
        width={640}
        height={300}
        priority
        className="absolute right-[-7rem] top-20 hidden opacity-10 lg:block"
      />
      <div className="relative mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="max-w-3xl space-y-6">
          <Badge className="border-white/25 bg-white/10 text-white">
            Autoescola sem agenda perdida
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight md:text-6xl">
              Estude, agende e acompanhe suas aulas em um só lugar.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              A Autecno organiza a jornada de habilitação: o aluno encontra conteúdo
              teórico, escolhe instrutor, agenda aulas práticas e recebe lembretes para
              não perder compromissos.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/auth/cadastro">
              <Button>Começar minha jornada</Button>
            </Link>
            <Link href="/auth/login">
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
              >
                Acessar minha conta
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur">
          <div className="rounded-lg bg-white p-5 text-[var(--brand-blue)]">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Próxima aula
                </p>
                <p className="mt-1 text-2xl font-bold">Hoje, 15:00</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                Confirmada
              </span>
            </div>
            <div className="grid gap-3">
              {[
                ["Instrutora Ana", "Direção defensiva e baliza"],
                ["Módulo teórico", "Sinalização e preferências"],
                ["Lembrete", "Avisar 1h antes da aula"],
              ].map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
