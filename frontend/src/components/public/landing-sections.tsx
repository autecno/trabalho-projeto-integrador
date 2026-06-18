import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features = [
  {
    title: "Para o aluno",
    description:
      "Veja conteúdos teóricos, acompanhe o progresso e agende aulas práticas sem depender de conversas espalhadas.",
  },
  {
    title: "Para o instrutor",
    description:
      "Receba solicitações de aula, confirme horários e mantenha sua agenda organizada em poucos cliques.",
  },
  {
    title: "Para a rotina",
    description:
      "Lembretes e notificações reduzem esquecimentos, atrasos e remarcações de última hora.",
  },
];

const steps = [
  "Crie sua conta como aluno ou instrutor",
  "Acesse seu painel e veja o próximo passo",
  "Estude os módulos e escolha um horário",
  "Receba avisos e acompanhe seus agendamentos",
];

export function LandingSections() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-16">
      <section id="funcionalidades" className="scroll-mt-28 space-y-5">
        <Badge>O que a Autecno entrega</Badge>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="space-y-3">
              <h2 className="text-xl font-bold text-[var(--brand-blue)]">
                {feature.title}
              </h2>
              <p className="text-sm leading-6 text-slate-600">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-28 space-y-5">
        <div className="max-w-2xl space-y-2">
          <Badge>Como funciona</Badge>
          <h2 className="text-3xl font-bold text-[var(--brand-blue)]">
            Um fluxo simples para sair do cadastro até a aula prática.
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {steps.map((step, index) => (
            <Card key={step} className="space-y-3 p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-yellow)] text-sm font-bold text-[var(--brand-blue)]">
                {index + 1}
              </span>
              <p className="text-sm font-semibold leading-6 text-slate-800">{step}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="space-y-3">
          <Badge>Menos improviso</Badge>
          <h2 className="text-3xl font-bold text-[var(--brand-blue)]">
            Aulas, estudos e lembretes deixam de morar em lugares diferentes.
          </h2>
          <p className="text-sm leading-7 text-slate-600">
            A experiência foi pensada para quem precisa saber o que estudar, quando
            será a próxima aula e qual ação ainda está pendente.
          </p>
        </div>
        <Card className="grid gap-3 sm:grid-cols-3">
          {["Próxima aula visível", "Progresso dos módulos", "Notificações no painel"].map(
            (item) => (
              <div key={item} className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-semibold text-[var(--brand-blue)]">{item}</p>
              </div>
            ),
          )}
        </Card>
      </section>

      <section className="rounded-xl bg-[var(--brand-blue)] p-8 text-white">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Comece organizando sua próxima aula</h2>
            <p className="text-sm text-slate-200">
              Crie sua conta e acesse a área certa para seu perfil.
            </p>
          </div>
          <Link href="/auth/cadastro">
            <Button className="min-w-40">Criar conta</Button>
          </Link>
        </div>
      </section>

      <footer id="contato" className="scroll-mt-28 border-t border-[var(--border-soft)] py-6">
        <div className="flex flex-col gap-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <p>
            <span className="font-semibold text-[var(--brand-blue)]">Autecno</span>:
            teoria, agenda e acompanhamento para a jornada de habilitação.
          </p>
          <p>
            <Link href="/auth/login" className="font-semibold underline">
              Login
            </Link>{" "}
            ·{" "}
            <Link href="/auth/cadastro" className="font-semibold underline">
              Cadastro
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
