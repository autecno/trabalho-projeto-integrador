"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StarRating } from "@/components/ui/star-rating";
import { apiFetch, getFriendlyErrorMessage, readApiJson } from "@/lib/api";
import { getValidStoredToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Profile = {
  id: number;
  name: string;
  email: string;
  role: "student" | "instructor";
};

type Instructor = {
  id: number;
  name: string;
  averageRating: number | null;
  totalRatings: number;
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
  counterpartAverageRating: number | null;
  counterpartTotalRatings: number;
  currentUserRatingScore: number | null;
  canCurrentUserRate: boolean;
  studentLegislationProgress: {
    id: number;
    title: string;
    contentCount: number;
    completedContentCount: number;
    progressPercent: number;
    quizCompleted: boolean;
  } | null;
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

type AvailabilityInterval = {
  id?: number;
  weekday: number;
  startTime: string;
  endTime: string;
};

const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

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
  const [availabilityIntervals, setAvailabilityIntervals] = useState<
    AvailabilityInterval[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [selectedRatings, setSelectedRatings] = useState<Record<number, number>>({});
  const [ratingAppointmentId, setRatingAppointmentId] = useState<number | null>(null);

  const isStudent = profile?.role === "student";
  const selectedInstructor =
    instructors.find((instructor) => instructor.id === selectedInstructorId) ?? null;

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
        ] = await Promise.all([
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

        if (profilePayload.role === "instructor") {
          const availabilityResponse = await apiFetch(
            "/appointments/availability-settings",
          );
          const availabilityPayload = await readApiJson<{
            intervals: AvailabilityInterval[];
          }>(
            availabilityResponse,
            "Não foi possível carregar sua disponibilidade.",
          );
          setAvailabilityIntervals(availabilityPayload.intervals);
        }

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
          getFriendlyErrorMessage(err, "Falha ao carregar os dados do dashboard."),
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchDashboardData();
  }, [token]);

  const formatDateTime = (isoDate: string) =>
    new Date(isoDate).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  const formatRatingValue = (value: number) => value.toFixed(1).replace(".", ",");

  const formatRatingSummary = (averageRating: number | null, totalRatings: number) => {
    if (averageRating === null || totalRatings === 0) {
      return "Sem avaliações ainda";
    }

    const ratingLabel = totalRatings === 1 ? "avaliação" : "avaliações";
    return `${formatRatingValue(averageRating)}/5 (${totalRatings} ${ratingLabel})`;
  };

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

  const refreshInstructors = async () => {
    if (!token) return;

    const response = await apiFetch("/instructors");
    const payload = await readApiJson<Instructor[]>(
      response,
      "Não foi possível atualizar os instrutores.",
    );
    setInstructors(payload);
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

  const handleSelectInstructor = (instructorId: number) => {
    setSelectedInstructorId(instructorId);

    if (selectedDate) {
      void loadAvailability(instructorId, selectedDate);
      return;
    }

    setAvailabilitySlots([]);
    setSelectedScheduledAt(null);
  };

  const addAvailabilityInterval = () => {
    setAvailabilityIntervals((current) => [
      ...current,
      {
        weekday: 1,
        startTime: "08:00",
        endTime: "18:00",
      },
    ]);
  };

  const updateAvailabilityInterval = (
    index: number,
    field: keyof AvailabilityInterval,
    value: string,
  ) => {
    setAvailabilityIntervals((current) =>
      current.map((interval, currentIndex) =>
        currentIndex === index
          ? {
              ...interval,
              [field]: field === "weekday" ? Number(value) : value,
            }
          : interval,
      ),
    );
  };

  const removeAvailabilityInterval = (index: number) => {
    setAvailabilityIntervals((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const handleSaveAvailability = async () => {
    try {
      setIsSavingAvailability(true);
      setActionMessage(null);

      const response = await apiFetch("/appointments/availability-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intervals: availabilityIntervals.map((interval) => ({
            weekday: interval.weekday,
            startTime: interval.startTime,
            endTime: interval.endTime,
          })),
        }),
      });
      const payload = await readApiJson<{ intervals: AvailabilityInterval[] }>(
        response,
        "Não foi possível salvar sua disponibilidade.",
      );

      setAvailabilityIntervals(payload.intervals);
      setActionMessage("Disponibilidade salva com sucesso.");
    } catch (err) {
      setActionMessage(
        getFriendlyErrorMessage(err, "Falha ao salvar disponibilidade."),
      );
    } finally {
      setIsSavingAvailability(false);
    }
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

      const response = await apiFetch(`/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
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

  const handleRateAppointment = async (appointmentId: number) => {
    if (!token) return;

    const selectedScore = selectedRatings[appointmentId];
    if (!selectedScore) {
      setActionMessage("Selecione uma nota de 1 a 5 estrelas para enviar a avaliação.");
      return;
    }

    try {
      setRatingAppointmentId(appointmentId);
      setActionMessage(null);

      const response = await apiFetch(`/appointments/${appointmentId}/rating`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score: selectedScore,
        }),
      });
      await readApiJson(response, "Não foi possível enviar a avaliação.");

      setActionMessage("Avaliação enviada com sucesso.");
      setSelectedRatings((current) => {
        const next = { ...current };
        delete next[appointmentId];
        return next;
      });

      await refreshAppointments();

      if (isStudent) {
        await refreshInstructors();
      }
    } catch (err) {
      setActionMessage(
        getFriendlyErrorMessage(err, "Falha ao enviar avaliação."),
      );
    } finally {
      setRatingAppointmentId(null);
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
              <Badge>Instrutores</Badge>
              <h2 className="text-2xl font-bold text-[var(--brand-blue)]">
                Escolha um instrutor
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Veja a média de avaliação antes de selecionar quem vai ministrar sua aula.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {instructors.map((instructor) => (
                <button
                  key={instructor.id}
                  type="button"
                  onClick={() => handleSelectInstructor(instructor.id)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    selectedInstructorId === instructor.id
                      ? "border-[var(--brand-yellow)] bg-[rgba(249,181,46,0.08)]"
                      : "border-[var(--border-soft)] bg-white hover:border-[var(--brand-yellow)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {instructor.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatRatingSummary(
                          instructor.averageRating,
                          instructor.totalRatings,
                        )}
                      </p>
                    </div>
                    {selectedInstructorId === instructor.id && (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                        Selecionado
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <StarRating
                      value={Math.round(instructor.averageRating ?? 0)}
                      readonly
                      size="sm"
                    />
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {instructor.averageRating === null
                        ? "Sem nota"
                        : `${formatRatingValue(instructor.averageRating)} / 5`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {isStudent && (
          <Card className="space-y-5">
            <div className="space-y-2">
              <Badge>Novo agendamento</Badge>
              <h2 className="text-2xl font-bold text-[var(--brand-blue)]">
                Escolha data e horário
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                {selectedInstructor
                  ? `Instrutor selecionado: ${selectedInstructor.name}.`
                  : "Selecione um instrutor para ver os horários livres."}
              </p>
            </div>

            <div className="grid gap-3 md:max-w-xs">
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

        {profile?.role === "instructor" && (
          <Card className="space-y-5">
            <div className="space-y-2">
              <Badge>Disponibilidade</Badge>
              <h2 className="text-2xl font-bold text-[var(--brand-blue)]">
                Informe quando você pode receber aulas
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Os alunos verão horários de 1 em 1 hora dentro dos intervalos que você
                cadastrar.
              </p>
            </div>

            <div className="grid gap-3">
              {availabilityIntervals.length === 0 && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Nenhum intervalo cadastrado. Adicione pelo menos um período disponível.
                </p>
              )}

              {availabilityIntervals.map((interval, index) => (
                <div
                  key={`${interval.weekday}-${interval.startTime}-${interval.endTime}-${index}`}
                  className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-white p-4 md:grid-cols-[1.3fr_1fr_1fr_auto]"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Dia da semana
                    </label>
                    <select
                      className="h-10 w-full rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm"
                      value={interval.weekday}
                      onChange={(event) =>
                        updateAvailabilityInterval(index, "weekday", event.target.value)
                      }
                    >
                      {WEEKDAYS.map((weekday, weekdayIndex) => (
                        <option key={weekday} value={weekdayIndex}>
                          {weekday}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Início</label>
                    <Input
                      type="time"
                      value={interval.startTime}
                      onChange={(event) =>
                        updateAvailabilityInterval(index, "startTime", event.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Fim</label>
                    <Input
                      type="time"
                      value={interval.endTime}
                      onChange={(event) =>
                        updateAvailabilityInterval(index, "endTime", event.target.value)
                      }
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => removeAvailabilityInterval(index)}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={addAvailabilityInterval}>
                Adicionar intervalo
              </Button>
              <Button
                onClick={handleSaveAvailability}
                disabled={isSavingAvailability}
              >
                {isSavingAvailability ? "Salvando..." : "Salvar disponibilidade"}
              </Button>
            </div>
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
              {appointments.map((appointment) => {
                const selectedScore = selectedRatings[appointment.id] ?? 0;
                const shownRating = appointment.currentUserRatingScore ?? selectedScore;

                return (
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
                        {!isStudent && appointment.studentLegislationProgress && (
                          <div className="mt-2 max-w-sm space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              <span>Legislacao</span>
                              <span>
                                {appointment.studentLegislationProgress.progressPercent}%
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{
                                  width: `${appointment.studentLegislationProgress.progressPercent}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-slate-600">
                              {
                                appointment.studentLegislationProgress
                                  .completedContentCount
                              }
                              /{appointment.studentLegislationProgress.contentCount} conteudos
                              {appointment.studentLegislationProgress.quizCompleted
                                ? " e prova finalizada"
                                : " e prova pendente"}
                            </p>
                          </div>
                        )}
                        <p className="text-sm text-slate-600">
                          {isStudent ? "Média do instrutor: " : "Média do aluno: "}
                          {formatRatingSummary(
                            appointment.counterpartAverageRating,
                            appointment.counterpartTotalRatings,
                          )}
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

                    {appointment.status === "completed" && (
                      <div className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-slate-50/80 p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {isStudent ? "Avalie o instrutor" : "Avalie o aluno"}
                          </p>
                          <p className="text-sm text-slate-600">
                            {appointment.currentUserRatingScore
                              ? `Sua nota foi ${appointment.currentUserRatingScore} de 5.`
                              : "Escolha uma nota de 1 a 5 estrelas para registrar sua avaliação."}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <StarRating
                            value={shownRating}
                            readonly={!appointment.canCurrentUserRate}
                            onChange={(value) =>
                              setSelectedRatings((current) => ({
                                ...current,
                                [appointment.id]: value,
                              }))
                            }
                          />

                          {appointment.canCurrentUserRate && (
                            <Button
                              onClick={() => void handleRateAppointment(appointment.id)}
                              disabled={ratingAppointmentId === appointment.id || !selectedScore}
                            >
                              {ratingAppointmentId === appointment.id
                                ? "Enviando..."
                                : "Enviar avaliação"}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
