"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, getFriendlyErrorMessage, readApiJson } from "@/lib/api";
import { getValidStoredToken } from "@/lib/auth";

type Profile = {
  id: number;
  name: string;
  email: string;
  role: "student" | "instructor";
};

type Instructor = {
  id: number;
  name: string;
};

type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "rejected"
  | "completed";

type Appointment = {
  id: number;
  studentId: number;
  studentName: string;
  instructorId: number;
  instructorName: string;
  scheduledAt: string;
  status: AppointmentStatus;
  notes: string | null;
  cancellationReason: string | null;
};

type NextAppointment = {
  id: number;
  instructorId: number;
  instructorName: string;
  scheduledAt: string;
  status: AppointmentStatus;
} | null;

type AvailabilitySlot = {
  scheduledAt: string;
  available: boolean;
};

export default function DashboardPage() {
  const token = getValidStoredToken();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [nextAppointment, setNextAppointment] = useState<NextAppointment>(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(
    token ? null : "Sessão inválida. Faça login novamente.",
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [selectedScheduledAt, setSelectedScheduledAt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [
          profileResponse,
          instructorsResponse,
          appointmentsResponse,
          nextAppointmentResponse,
        ] =
          await Promise.all([
          apiFetch("/profile"),
          apiFetch("/instructors"),
          apiFetch("/appointments"),
          apiFetch("/appointments/next"),
        ]);

        const profilePayload = await readApiJson<Profile>(
          profileResponse,
          "Não foi possível carregar seu perfil.",
        );

        setProfile(profilePayload);

        const instructorsPayload = await readApiJson<Instructor[]>(
          instructorsResponse,
          "Não foi possível listar os instrutores.",
        );

        setInstructors(instructorsPayload);

        const appointmentsPayload = await readApiJson<Appointment[]>(
          appointmentsResponse,
          "Não foi possível listar os agendamentos.",
        );
        setAppointments(appointmentsPayload);

        const nextAppointmentPayload = await readApiJson<{
          nextAppointment: NextAppointment;
        }>(nextAppointmentResponse, "Não foi possível carregar a próxima aula.");
        setNextAppointment(nextAppointmentPayload.nextAppointment ?? null);
      } catch (err) {
        setError(
          getFriendlyErrorMessage(
            err,
            "Falha ao carregar os dados do dashboard.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [token]);

  const isStudent = profile?.role === "student";

  const formatDateTime = (isoDate: string) =>
    new Date(isoDate).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  const statusLabel: Record<AppointmentStatus, string> = {
    pending: "Pendente",
    confirmed: "Confirmada",
    cancelled: "Cancelada",
    rejected: "Recusada",
    completed: "Concluída",
  };

  const getStatusBadgeClass = (status: AppointmentStatus) => {
    if (status === "confirmed" || status === "completed") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (status === "pending") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    return "border-rose-200 bg-rose-50 text-rose-700";
  };

  const refreshAppointments = async () => {
    if (!token) return;
    const response = await apiFetch("/appointments");
    const payload = await readApiJson<Appointment[]>(
      response,
      "Não foi possível atualizar agendamentos.",
    );
    setAppointments(payload);
  };

  const refreshNextAppointment = async () => {
    if (!token) return;
    const response = await apiFetch("/appointments/next");
    const payload = await readApiJson<{ nextAppointment: NextAppointment }>(
      response,
      "Não foi possível atualizar a próxima aula.",
    );
    setNextAppointment(payload.nextAppointment ?? null);
  };

  const loadAvailability = async (instructorId: number, date: string) => {
    if (!token) return;
    setAvailabilitySlots([]);
    setSelectedScheduledAt(null);

    if (!date) return;

    const response = await apiFetch(
      `/appointments/availability?instructorId=${instructorId}&date=${date}`,
    );
    const payload = await readApiJson<{ slots: AvailabilitySlot[] }>(
      response,
      "Não foi possível carregar horários.",
    );

    setAvailabilitySlots(payload.slots ?? []);
  };

  const handleScheduleAppointment = async () => {
    if (!token || !selectedInstructorId || !selectedScheduledAt) {
      setActionMessage("Selecione instrutor e horário para continuar.");
      return;
    }

    try {
      setIsSubmitting(true);
      setActionMessage(null);

      const response = await apiFetch("/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instructorId: selectedInstructorId,
          scheduledAt: selectedScheduledAt,
        }),
      });
      await readApiJson(response, "Não foi possível criar o agendamento.");

      setActionMessage("Agendamento realizado com sucesso.");
      await refreshAppointments();
      await refreshNextAppointment();
      if (selectedDate) {
        await loadAvailability(selectedInstructorId, selectedDate);
      }
    } catch (err) {
      setActionMessage(
        getFriendlyErrorMessage(err, "Falha ao criar o agendamento."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAppointmentStatus = async (
    appointmentId: number,
    status: AppointmentStatus,
  ) => {
    if (!token) return;

    try {
      setActionMessage(null);
      const response = await apiFetch(
        `/appointments/${appointmentId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );
      await readApiJson(response, "Não foi possível atualizar o status.");

      setActionMessage("Status atualizado com sucesso.");
      await refreshAppointments();
      await refreshNextAppointment();
    } catch (err) {
      setActionMessage(
        getFriendlyErrorMessage(err, "Falha ao atualizar status."),
      );
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-10 pt-28">
      <div className="grid gap-6">
        <Card className="space-y-4">
          <Badge>Área privada</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-[var(--brand-blue)]">
              {isStudent ? "Agendar Aula Prática" : "Minha Agenda"}
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              {profile
                ? `Olá, ${profile.name}. Gerencie seus agendamentos de aula por aqui.`
                : "Carregando seu ambiente autenticado."}
            </p>
          </div>
        </Card>

        {isStudent && (
          <Card className="space-y-3">
            <Badge>Próxima aula</Badge>
            {nextAppointment ? (
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-[var(--brand-blue)]">
                  {formatDateTime(nextAppointment.scheduledAt)}
                </h2>
                <p className="text-sm leading-6 text-slate-600">
                  Aula com {nextAppointment.instructorName}.
                </p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                Você ainda não tem uma próxima aula agendada.
              </p>
            )}
          </Card>
        )}

        {isStudent && (
          <Card className="space-y-5">
            <div className="space-y-2">
              <Badge>Novo agendamento</Badge>
              <h2 className="text-2xl font-bold text-[var(--brand-blue)]">
                Escolha instrutor, data e horário
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Selecione um instrutor e veja os horários livres para confirmar sua aula.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Instrutor</label>
                <select
                  className="h-10 w-full rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm"
                  value={selectedInstructorId ?? ""}
                  onChange={(event) => {
                    const nextId = Number(event.target.value);
                    setSelectedInstructorId(nextId || null);
                    if (nextId && selectedDate) {
                      void loadAvailability(nextId, selectedDate);
                    } else {
                      setAvailabilitySlots([]);
                      setSelectedScheduledAt(null);
                    }
                  }}
                >
                  <option value="">Selecione...</option>
                  {instructors.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Data da aula</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    const nextDate = event.target.value;
                    setSelectedDate(nextDate);
                    if (selectedInstructorId && nextDate) {
                      void loadAvailability(selectedInstructorId, nextDate);
                    } else {
                      setAvailabilitySlots([]);
                      setSelectedScheduledAt(null);
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Horários disponíveis</p>
              <div className="flex flex-wrap gap-2">
                {availabilitySlots.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Selecione instrutor e data para listar horários.
                  </p>
                )}
                {availabilitySlots.map((slot) => (
                  <Button
                    key={slot.scheduledAt}
                    variant={selectedScheduledAt === slot.scheduledAt ? "default" : "outline"}
                    disabled={!slot.available}
                    onClick={() => setSelectedScheduledAt(slot.scheduledAt)}
                  >
                    {new Date(slot.scheduledAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Button>
                ))}
              </div>
            </div>

            <Button onClick={handleScheduleAppointment} disabled={isSubmitting}>
              {isSubmitting ? "Confirmando..." : "Confirmar agendamento"}
            </Button>
          </Card>
        )}

        <Card className="space-y-4">
          <div className="space-y-2">
            <Badge>{isStudent ? "Meus agendamentos" : "Agenda recebida"}</Badge>
            <h2 className="text-2xl font-bold text-[var(--brand-blue)]">
              {isStudent ? "Aulas que você solicitou" : "Aulas agendadas por alunos"}
            </h2>
          </div>

          {isLoading && <p className="text-sm text-slate-500">Carregando agendamentos...</p>}

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          {actionMessage && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {actionMessage}
            </p>
          )}

          {!isLoading && !error && appointments.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Ainda não há agendamentos.
            </p>
          )}

          {!isLoading && !error && appointments.length > 0 && (
            <div className="grid gap-3">
              {appointments.map((appointment) => (
                <article
                  key={appointment.id}
                  className="rounded-2xl border border-[var(--border-soft)] bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {isStudent
                          ? `Instrutor: ${appointment.instructorName}`
                          : `Aluno: ${appointment.studentName}`}
                      </p>
                      <p className="text-sm text-slate-600">
                        Data: {formatDateTime(appointment.scheduledAt)}
                      </p>
                    </div>
                    <Badge className={getStatusBadgeClass(appointment.status)}>
                      {statusLabel[appointment.status]}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {isStudent && ["pending", "confirmed"].includes(appointment.status) && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          void handleUpdateAppointmentStatus(appointment.id, "cancelled")
                        }
                      >
                        Cancelar
                      </Button>
                    )}

                    {!isStudent && appointment.status === "pending" && (
                      <>
                        <Button
                          onClick={() =>
                            void handleUpdateAppointmentStatus(appointment.id, "confirmed")
                          }
                        >
                          Confirmar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            void handleUpdateAppointmentStatus(appointment.id, "rejected")
                          }
                        >
                          Recusar
                        </Button>
                      </>
                    )}

                    {!isStudent && appointment.status === "confirmed" && (
                      <>
                        <Button
                          onClick={() =>
                            void handleUpdateAppointmentStatus(appointment.id, "completed")
                          }
                        >
                          Concluir
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            void handleUpdateAppointmentStatus(appointment.id, "cancelled")
                          }
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
