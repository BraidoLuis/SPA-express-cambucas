import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  monthKey,
  pad,
} from "../../lib/spa-data";
import type { ProfessionalAccess } from "../../lib/services/professional-access-service";
import {
  completeProfessionalAppointment,
  getProfessionalAgenda,
  updateProfessionalAppointmentStatus,
  type ProfessionalAppointment,
  type ProfessionalAppointmentStatus,
} from "../../lib/services/professional-agenda-service";
import {
  createProfessionalService,
  getProfessionalServices,
  updateProfessionalService,
  type ProfessionalService,
} from "../../lib/services/professional-service-service";
import { ActionDialog } from "../shared/action-dialog";
import {
  getProfessionalAvailability,
  saveProfessionalAvailability,
  type ProfessionalAvailabilityRule,
} from "../../lib/services/professional-availability-service";
import {
  createProfessionalTimeOff,
  deleteProfessionalTimeOff,
  getProfessionalTimeOffs,
  type ProfessionalTimeOff,
} from "../../lib/services/professional-time-off-service";
import {
  createProfessionalExtraAppointment,
} from "../../lib/services/professional-extra-appointment-service";
import {
  createProfessionalScheduleBlock,
  deleteProfessionalScheduleBlock,
  getProfessionalScheduleBlocks,
  type ProfessionalScheduleBlock,
} from "../../lib/services/professional-schedule-block-service";
import {
  ProfessionalDayAgendaDialog,
} from "./professional-day-agenda-dialog";
import { Logo, NotificationBell, ThemeToggle } from "../shared/spa-ui";
import { ServiceCoverImage } from "../shared/service-cover-image";
import { ServiceCoverEditor } from "../shared/service-cover-editor";
import { applyServiceCoverChange, type CoverImageChange } from "../../lib/services/service-cover-image-service";
import { ArrowLeft, Bell, CalendarDays, Clock, Home, LogOut, Menu, Sparkles, X } from "lucide-react";
import { useDashboardDrawer } from "../shared/use-dashboard-drawer";

const professionalStatusLabel: Record<
  ProfessionalAppointmentStatus,
  string
> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};
const availabilityWeekdays = [
  { weekday: 1, label: "Segunda-feira" },
  { weekday: 2, label: "Terça-feira" },
  { weekday: 3, label: "Quarta-feira" },
  { weekday: 4, label: "Quinta-feira" },
  { weekday: 5, label: "Sexta-feira" },
  { weekday: 6, label: "Sábado" },
  { weekday: 0, label: "Domingo" },
];
function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1,
  )}-${pad(date.getDate())}`;
}

function appointmentTime(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProfessionalDashboard({
  access,
  goPublic,
  logout,
}: {
  access: ProfessionalAccess;
  goPublic: () => void;
  logout: () => void;
}) {
  const { open: drawerOpen, setOpen: setDrawerOpen, close: closeDrawer, drawerRef, triggerRef } = useDashboardDrawer();
  const [section, setSection] = useState("Meu dia");
  const today = new Date();
  const [agendaMonth, setAgendaMonth] = useState(monthKey(today));
  const [
    selectedAgendaDate,
    setSelectedAgendaDate,
  ] = useState<string | null>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraServiceId, setExtraServiceId] = useState("");
  const [extraDuration, setExtraDuration] = useState(60);
  const [extraSaving, setExtraSaving] = useState(false);
  const [extraError, setExtraError] = useState("");
  const [showBlockForm, setShowBlockForm] = useState(false);

  const [
    scheduleBlocks,
    setScheduleBlocks,
  ] = useState<ProfessionalScheduleBlock[]>([]);

  const [scheduleBlocksLoading, setScheduleBlocksLoading] =
    useState(true);

  const [scheduleBlockSaving, setScheduleBlockSaving] =
    useState(false);

  const [scheduleBlockError, setScheduleBlockError] =
    useState("");
  const [todayAppointments, setTodayAppointments] =
    useState<ProfessionalAppointment[]>([]);

  const [monthAppointments, setMonthAppointments] =
    useState<ProfessionalAppointment[]>([]);

  const [agendaLoading, setAgendaLoading] =
    useState(true);

  const [agendaError, setAgendaError] =
    useState("");
  const [
    updatingAppointmentId,
    setUpdatingAppointmentId,
  ] = useState("");
  const [
    completionAppointmentId,
    setCompletionAppointmentId,
  ] = useState("");

  const [
    appointmentToCancel,
    setAppointmentToCancel,
  ] = useState<ProfessionalAppointment | null>(null);

  const [
    timeOffToRemove,
    setTimeOffToRemove,
  ] = useState<ProfessionalTimeOff | null>(null);

  const [
    scheduleBlockToRemove,
    setScheduleBlockToRemove,
  ] = useState<ProfessionalScheduleBlock | null>(null);

  const [paymentReceived, setPaymentReceived] =
    useState(true);

  const [paymentMethod, setPaymentMethod] =
    useState<
      "pix" | "dinheiro" | "cartao" | "outro"
    >("pix");

  const [paymentNotes, setPaymentNotes] =
    useState("");
  const [myServices, setMyServices] = useState<ProfessionalService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const [savingService, setSavingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState("");
  const [newServiceCoverChange, setNewServiceCoverChange] = useState<CoverImageChange>({ kind: "keep" });
  const [editServiceCoverChange, setEditServiceCoverChange] = useState<CoverImageChange>({ kind: "keep" });
  const [
    availabilityRules,
    setAvailabilityRules,
  ] = useState<ProfessionalAvailabilityRule[]>([]);

  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilitySuccess, setAvailabilitySuccess] = useState("");
  const [timeOffs, setTimeOffs] = useState<ProfessionalTimeOff[]>([]);
  const [timeOffsLoading, setTimeOffsLoading] = useState(true);
  const [timeOffSaving, setTimeOffSaving] = useState(false);
  const [timeOffError, setTimeOffError] = useState("");
  const [showTimeOffForm, setShowTimeOffForm] = useState(false);
  const professional: "Eliane" | "Dayanne" =
    access.displayName.toLowerCase().includes("dayanne")
      ? "Dayanne"
      : "Eliane";

  const isEliane = professional === "Eliane";
  const fullName = access.displayName;

  const initials = fullName
    .split(" ")
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();

  const role = access.specialty;
  const monthDate = new Date(`${agendaMonth}-01T12:00:00`);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
  const menu = ["Meu dia", "Minha agenda", "Meus serviços", "Disponibilidade", "Notificações"];
  const menuIcons = [Home, CalendarDays, Sparkles, Clock, Bell];
  const todayKey = localDateKey(today);
  const selectedDayAppointments =
    selectedAgendaDate
      ? monthAppointments.filter(
          (item) =>
            localDateKey(new Date(item.start)) ===
            selectedAgendaDate,
        )
      : [];

  const selectedDayScheduleBlocks =
    selectedAgendaDate
      ? scheduleBlocks.filter(
          (block) =>
            localDateKey(new Date(block.start)) ===
            selectedAgendaDate,
        )
      : [];

  const activeTodayAppointments =
    todayAppointments.filter(
      (item) => item.status !== "cancelled",
    );

  const nextAppointment =
    activeTodayAppointments.find(
      (item) =>
        ["pending", "confirmed"].includes(
          item.status,
        ) &&
        new Date(item.end) > new Date(),
    );

  async function loadAgenda() {
    setAgendaLoading(true);
    setAgendaError("");

    try {
      const currentMonth = monthKey(new Date());

      const todayData = await getProfessionalAgenda(access.id, currentMonth);
      const selectedMonthData = agendaMonth === currentMonth
        ? todayData
        : await getProfessionalAgenda(access.id, agendaMonth);

      setTodayAppointments(
        todayData.filter(
          (item) =>
            localDateKey(new Date(item.start)) ===
            todayKey,
        ),
      );

      setMonthAppointments(selectedMonthData);
    } catch {
      setAgendaError(
        "Não foi possível carregar sua agenda agora.",
      );
    } finally {
      setAgendaLoading(false);
    }
  }

  async function loadServices() {
    setServicesLoading(true);
    setServicesError("");

    try {
      const professionalServices = await getProfessionalServices(access.id);
      setMyServices(professionalServices);
    } catch {
      setServicesError("Não foi possível carregar seus serviços agora.");
    } finally {
      setServicesLoading(false);
    }
  }

  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    setSavingService(true);
    setServicesError("");

    try {
      const serviceId = await createProfessionalService({
        name: String(form.get("name")),
        category: String(form.get("category")),
        description: String(form.get("description") || ""),
        duration: Number(form.get("duration")),
        price: Number(form.get("price")),
      });
      await applyServiceCoverChange(serviceId, null, newServiceCoverChange);

      formElement.reset();
      setShowServiceForm(false);
      setNewServiceCoverChange({ kind: "keep" });

      await loadServices();
    } catch (error) {
      setServicesError(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o serviço.",
      );
    } finally {
      setSavingService(false);
    }
  }

  async function saveServiceChanges(
    event: FormEvent<HTMLFormElement>,
    service: ProfessionalService,
  ) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    setSavingService(true);
    setServicesError("");

    try {
      await updateProfessionalService(access.id, service.id, {
        duration: Number(form.get("duration")),
        price: Number(form.get("price")),
        active: service.active,
      });
      await applyServiceCoverChange(
        service.id,
        service.image,
        editServiceCoverChange,
      );

      setEditingServiceId("");
      setEditServiceCoverChange({ kind: "keep" });
      await loadServices();
    } catch {
      setServicesError(
        "Não foi possível salvar as alterações do serviço.",
      );
    } finally {
      setSavingService(false);
    }
  }

  async function toggleService(service: ProfessionalService) {
    setSavingService(true);
    setServicesError("");

    try {
      await updateProfessionalService(access.id, service.id, {
        duration: service.duration,
        price: service.price,
        active: !service.active,
      });

      await loadServices();
    } catch {
      setServicesError(
        "Não foi possível alterar a situação do serviço.",
      );
    } finally {
      setSavingService(false);
    }
  }

  async function loadAvailability() {
    setAvailabilityLoading(true);
    setAvailabilityError("");
    setAvailabilitySuccess("");

    try {
      const storedRules = await getProfessionalAvailability(access.id);

      const completeRules = availabilityWeekdays.map(
        ({ weekday }, index) => {
          const storedRule = storedRules.find(
            (rule) => rule.weekday === weekday,
          );

          if (storedRule) {
            return storedRule;
          }

          return {
            id: null,
            weekday,
            startTime: "09:00",
            endTime:
              weekday === 6 ? "15:00" : "18:00",
            active: index < 6,
          };
        },
      );

      setAvailabilityRules(completeRules);

    } catch {
      setAvailabilityError(
        "Não foi possível carregar sua disponibilidade.",
      );
    } finally {
      setAvailabilityLoading(false);
    }
  }

  function updateAvailabilityRule(
    weekday: number,
    changes: Partial<ProfessionalAvailabilityRule>,
  ) {
    setAvailabilityRules((currentRules) =>
      currentRules.map((rule) =>
        rule.weekday === weekday
          ? { ...rule, ...changes }
          : rule,
      ),
    );

    setAvailabilitySuccess("");
  }

  async function submitAvailability() {
    setAvailabilityError("");
    setAvailabilitySuccess("");

    const invalidRule = availabilityRules.find(
      (rule) =>
        rule.active &&
        (!rule.startTime ||
          !rule.endTime ||
          rule.endTime <= rule.startTime),
    );

    if (invalidRule) {
      const day = availabilityWeekdays.find(
        (item) => item.weekday === invalidRule.weekday,
      );

      setAvailabilityError(
        `O horário final de ${day?.label || "um dos dias"} deve ser maior que o inicial.`,
      );

      return;
    }

    setAvailabilitySaving(true);

    try {
      await saveProfessionalAvailability(
        access.id,
        availabilityRules,
      );

      setAvailabilitySuccess("Disponibilidade salva com sucesso.");
      await loadAvailability();
      setAvailabilitySuccess("Disponibilidade salva com sucesso.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" &&
              error !== null &&
              "message" in error
            ? String(error.message)
            : "";

      setAvailabilityError(
        message ||
          "Não foi possível salvar sua disponibilidade.",
      );
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function loadTimeOffs() {
    setTimeOffsLoading(true);
    setTimeOffError("");

    try {
      const storedTimeOffs = await getProfessionalTimeOffs(access.id);
      setTimeOffs(storedTimeOffs);
    } catch {
      setTimeOffError("Não foi possível carregar suas folgas.");
    } finally {
      setTimeOffsLoading(false);
    }
  }

  async function submitTimeOff(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const date = String(form.get("date"));
    const reason = String(form.get("reason") || "").trim();
    const currentDate = localDateKey(new Date());

    setTimeOffError("");

    if (!date || date < currentDate) {
      setTimeOffError(
        "Escolha a data de hoje ou uma data futura.",
      );
      return;
    }

    if (reason.length > 0 && reason.length < 3) {
      setTimeOffError(
        "O motivo deve possuir pelo menos 3 caracteres.",
      );
      return;
    }

    setTimeOffSaving(true);

    try {
      await createProfessionalTimeOff(
        access.id,
        date,
        reason || "Folga",
      );

      formElement.reset();
      setShowTimeOffForm(false);

      await loadTimeOffs();
    } catch {
      setTimeOffError("Não foi possível cadastrar a folga.");
    } finally {
      setTimeOffSaving(false);
    }
  }

  async function removeTimeOff(timeOff: ProfessionalTimeOff) {
    setTimeOffSaving(true);
    setTimeOffError("");

    try {
      await deleteProfessionalTimeOff(
        access.id,
        timeOff.id,
      );

      await loadTimeOffs();
    } catch {
      setTimeOffError("Não foi possível remover essa folga.");
    } finally {
      setTimeOffSaving(false);
    }
  }

  function toggleExtraForm() {
    setExtraError("");

    if (showExtraForm) {
      setShowExtraForm(false);
      return;
    }

    const firstActiveService = myServices.find(
      (service) => service.active,
    );

    setExtraServiceId(firstActiveService?.id || "");
    setExtraDuration(firstActiveService?.duration || 60);
    setShowExtraForm(true);
  }

  async function submitExtraAppointment(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const date = String(form.get("date"));
    const time = String(form.get("time"));
    const clientName = String(form.get("client")).trim();
    const notes = String(form.get("notes") || "").trim();

    setExtraError("");

    if (!extraServiceId) {
      setExtraError("Selecione um serviço.");
      return;
    }

    if (clientName.length < 3) {
      setExtraError(
        "Informe o nome da cliente com pelo menos 3 caracteres.",
      );
      return;
    }

    if (!date || !time) {
      setExtraError("Informe a data e o horário do atendimento.");
      return;
    }

    if (extraDuration < 10 || extraDuration > 720) {
      setExtraError(
        "A duração deve estar entre 10 e 720 minutos.",
      );
      return;
    }

    setExtraSaving(true);

    try {
      await createProfessionalExtraAppointment({
        serviceId: extraServiceId,
        clientName,
        date,
        time,
        duration: extraDuration,
        notes,
      });

      formElement.reset();
      setShowExtraForm(false);

      await loadAgenda();
    } catch (error) {

      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error
          ? String(error.message)
          : error instanceof Error
            ? error.message
            : "";

      setExtraError(
        message.includes("appointments_no_professional_overlap") ||
          message.toLowerCase().includes("conflict")
          ? "Esse período já está ocupado por outro atendimento."
          : message.includes("Serviço não encontrado")
            ? "Esse serviço não está mais disponível para a profissional."
            : message ||
              "Não foi possível salvar o atendimento extra.",
      );
    } finally {
      setExtraSaving(false);
    }
  }



  async function loadScheduleBlocks() {
    setScheduleBlocksLoading(true);
    setScheduleBlockError("");

    try {
      const storedBlocks =
        await getProfessionalScheduleBlocks(
          access.id,
          agendaMonth,
        );

      setScheduleBlocks(storedBlocks);
    } catch {
      setScheduleBlockError(
        "Não foi possível carregar os horários bloqueados.",
      );
    } finally {
      setScheduleBlocksLoading(false);
    }
  }

  async function submitScheduleBlock(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const date = String(form.get("date"));
    const startTime = String(form.get("startTime"));
    const endTime = String(form.get("endTime"));
    const reason = String(form.get("reason") || "").trim();

    setScheduleBlockError("");

    if (!date || !startTime || !endTime) {
      setScheduleBlockError(
        "Informe a data, o horário inicial e o horário final.",
      );
      return;
    }

    if (endTime <= startTime) {
      setScheduleBlockError(
        "O horário final deve ser posterior ao inicial.",
      );
      return;
    }

    setScheduleBlockSaving(true);

    try {
      await createProfessionalScheduleBlock({
        date,
        startTime,
        endTime,
        reason,
      });

      formElement.reset();
      setShowBlockForm(false);

      await loadScheduleBlocks();
    } catch (error) {

      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error
          ? String(error.message)
          : "";

      setScheduleBlockError(
        message.includes("atendimento ativo")
          ? "Já existe um atendimento nesse período."
          : message.includes("já possui um bloqueio")
            ? "Esse período já está bloqueado."
            : message.includes("passado")
              ? "Não é possível bloquear um horário no passado."
              : message ||
                "Não foi possível bloquear esse horário.",
      );
    } finally {
      setScheduleBlockSaving(false);
    }
  }

  async function removeScheduleBlock(
    block: ProfessionalScheduleBlock,
  ) {
    setScheduleBlockSaving(true);
    setScheduleBlockError("");

    try {
      await deleteProfessionalScheduleBlock(
        access.id,
        block.id,
      );

      await loadScheduleBlocks();
    } catch {
      setScheduleBlockError(
        "Não foi possível liberar esse horário.",
      );
    } finally {
      setScheduleBlockSaving(false);
    }
  }

  async function changeAppointmentStatus(
    appointment: ProfessionalAppointment,
    status: ProfessionalAppointmentStatus,
    reason?: string,
  ) {
    if (
      status === "cancelled" &&
      (!reason || reason.trim().length < 3)
    ) {
      setAgendaError(
        "Informe um motivo de cancelamento com pelo menos 3 caracteres.",
      );
      return;
    }

    setUpdatingAppointmentId(appointment.id);
    setAgendaError("");

    try {
      await updateProfessionalAppointmentStatus(
        appointment.id,
        status,
        reason,
      );

      await loadAgenda();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "";

      setAgendaError(
        message.includes("futuro")
          ? "Esse atendimento ainda não pode ser concluído ou marcado como ausência."
          : "Não foi possível atualizar o atendimento.",
      );
    } finally {
      setUpdatingAppointmentId("");
    }
  }

  function openCompletion(appointmentId: string) {
  setCompletionAppointmentId(appointmentId);
  setPaymentReceived(true);
  setPaymentMethod("pix");
  setPaymentNotes("");
  setAgendaError("");
}

async function finishAppointment(
  event: FormEvent<HTMLFormElement>,
  appointment: ProfessionalAppointment,
) {
  event.preventDefault();

  setUpdatingAppointmentId(appointment.id);
  setAgendaError("");

  try {
    await completeProfessionalAppointment({
      appointmentId: appointment.id,
      paymentReceived,
      paymentMethod: paymentReceived
        ? paymentMethod
        : undefined,
      paymentNotes,
    });

    setCompletionAppointmentId("");
    await loadAgenda();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    setAgendaError(
      message.includes("futuro")
        ? "Esse atendimento ainda não pode ser concluído."
        : "Não foi possível concluir o atendimento.",
    );
  } finally {
    setUpdatingAppointmentId("");
  }
}

function completionForm(
  item: ProfessionalAppointment,
) {
  if (completionAppointmentId !== item.id) {
    return null;
  }

  return (
    <form
      className="appointment-completion-form"
      onSubmit={(event) =>
        finishAppointment(event, item)
      }
    >
      <strong>Concluir atendimento</strong>

      <label className="payment-received-check">
        <input
          type="checkbox"
          checked={paymentReceived}
          onChange={(event) =>
            setPaymentReceived(
              event.target.checked,
            )
          }
        />

        <span>Pagamento recebido no local</span>
      </label>

      <label>
        Forma de pagamento

        <select
          value={paymentMethod}
          disabled={!paymentReceived}
          onChange={(event) =>
            setPaymentMethod(
              event.target.value as
                | "pix"
                | "dinheiro"
                | "cartao"
                | "outro",
            )
          }
        >
          <option value="pix">PIX</option>
          <option value="dinheiro">
            Dinheiro
          </option>
          <option value="cartao">
            Cartão
          </option>
          <option value="outro">Outro</option>
        </select>
      </label>

      <label>
        Observação

        <input
          value={paymentNotes}
          onChange={(event) =>
            setPaymentNotes(event.target.value)
          }
          placeholder="Opcional"
        />
      </label>

      <div>
        <button
          type="button"
          onClick={() =>
            setCompletionAppointmentId("")
          }
        >
          Voltar
        </button>

        <button
          className="complete"
          disabled={
            updatingAppointmentId === item.id
          }
        >
          {updatingAppointmentId === item.id
            ? "Salvando..."
            : "Confirmar conclusão"}
        </button>
      </div>
    </form>
  );
}

  function appointmentActions(
    item: ProfessionalAppointment,
  ) {
    const updating =
      updatingAppointmentId === item.id;

    const alreadyStarted =
      new Date(item.start) <= new Date();

    if (
      !["pending", "confirmed"].includes(
        item.status,
      )
    ) {
      return null;
    }

    return (
      <div className="professional-appointment-actions">
        {item.status === "pending" && (
          <button
            disabled={updating}
            onClick={() =>
              changeAppointmentStatus(
                item,
                "confirmed",
              )
            }
          >
            Confirmar
          </button>
        )}

        {item.status === "confirmed" &&
          alreadyStarted && (
            <button
              className="complete"
              disabled={updating}
              onClick={() => openCompletion(item.id)}
            >
              Concluir
            </button>
          )}

        {item.status === "confirmed" &&
          alreadyStarted && (
            <button
              disabled={updating}
              onClick={() =>
                changeAppointmentStatus(
                  item,
                  "no_show",
                )
              }
            >
              Não compareceu
            </button>
          )}

        <button
          className="cancel"
          disabled={updating}
          onClick={() => setAppointmentToCancel(item)}
        >
          {updating
            ? "Atualizando..."
            : "Cancelar"}
        </button>
      </div>
    );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAgenda();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.id, agendaMonth]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadServices();

    // Recarrega quando a conta profissional mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAvailability();

    // Recarrega quando a conta profissional mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTimeOffs();

    // Recarrega quando a conta profissional mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadScheduleBlocks();

    // Recarrega quando a profissional ou o mês consultado mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.id, agendaMonth]);
  return (
    <div className="admin-shell professional-shell">
      {drawerOpen && <button className="dashboard-drawer-backdrop" type="button" aria-label="Fechar menu" onClick={() => closeDrawer()} />}
      <aside id="professional-navigation" ref={drawerRef} tabIndex={-1} className={drawerOpen ? "dashboard-drawer-open" : ""}>
        <Logo compact />
        <button className="dashboard-drawer-close icon-button" type="button" aria-label="Fechar menu" title="Fechar menu" onClick={() => closeDrawer()}><X aria-hidden="true" /></button>
        <div className="professional-aside-profile">
          <span>{initials}</span>
          <div>
            <b>{fullName}</b>
            <small>{role}</small>
          </div>
        </div>
        <nav>
          {menu.map((m, i) => {
            const MenuIcon = menuIcons[i];
            return (
            <button
              className={section === m ? "active" : ""}
              onClick={() => { setSection(m); closeDrawer(false); }}
              key={m}
            >
              <span><MenuIcon aria-hidden="true" /></span>
              {m}
              {m === "Meu dia" && (
                <i>{activeTodayAppointments.length}</i>
              )}
            </button>
          );})}
        </nav>
        <button className="view-site button-with-icon" onClick={goPublic}>
          <ArrowLeft aria-hidden="true" /> Ver site público
        </button>
        <button className="view-site logout button-with-icon" onClick={logout}>
          <LogOut aria-hidden="true" /> Sair da conta
        </button>
      </aside>
      <main className="admin-main professional-main">
        <header>
          <div>
            <span>ESPAÇO DA PROFISSIONAL</span>
            <h1>{section}</h1>
            <p>Olá, {professional}. Organize seu dia com tranquilidade.</p>
          </div>
          <div className="admin-actions">
            <ThemeToggle />
            <NotificationBell audience="professional" />
            <div className="profile">
              <span>{initials}</span>
              <div>
                <b>{fullName}</b>
                <small>Profissional</small>
              </div>
            </div>
            <button ref={triggerRef} className="dashboard-menu-button icon-button" type="button" aria-label="Abrir menu" title="Abrir menu" aria-expanded={drawerOpen} aria-controls="professional-navigation" onClick={() => setDrawerOpen(true)}><Menu aria-hidden="true" /></button>
          </div>
        </header>
        {section === "Meu dia" && (
          <>
            <section className="professional-welcome">
              <div>
                <span className="eyebrow">
                  {today
                    .toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                    })
                    .toUpperCase()}
                </span>
                <h2>Bom dia, {professional}! ♡</h2>
                <p>
                  Você tem {activeTodayAppointments.length} atendimentos programados para hoje.
                </p>
              </div>
              <button
                className="primary"
                onClick={() => setSection("Minha agenda")}
              >
                Ver agenda completa →
              </button>
            </section>
            <section className="professional-stats">
              <article>
                <span>◷</span>
                <div>
                  <small>PRÓXIMO ATENDIMENTO</small>
                    <b>
                      {nextAppointment
                        ? `${appointmentTime(
                            nextAppointment.start,
                          )} · ${nextAppointment.clientName}`
                        : "Nenhum próximo horário"}
                    </b>

                    <p>
                      {nextAppointment?.serviceName ||
                        "Sua agenda está livre"}
                    </p>
                </div>
              </article>
              <article>
                <span>✓</span>
                <div>
                  <small>ATENDIMENTOS HOJE</small>
                    <b>{activeTodayAppointments.length}</b>

                    <p>
                      {
                        activeTodayAppointments.filter(
                          (item) => item.status === "confirmed",
                        ).length
                      } confirmados
                    </p>
                </div>
              </article>
              <article>
                <span>✦</span>
                <div>
                  <small>SERVIÇOS ATIVOS</small>
                  <b>{myServices.length}</b>
                  <p>Disponíveis para agendamento</p>
                </div>
              </article>
            </section>
            <section className="panel professional-today">
              <div className="panel-head">
                <div>
                  <h2>Sua agenda de hoje</h2>
                  <p>Somente os seus atendimentos</p>
                </div>
                <span className="access-pill">Visão individual</span>
              </div>
              {agendaLoading && (
                  <div className="professional-agenda-feedback">
                    Carregando seus horários...
                  </div>
                )}

                {!agendaLoading &&
                  activeTodayAppointments.length === 0 && (
                    <div className="professional-agenda-feedback">
                      Nenhum atendimento marcado para hoje.
                    </div>
                  )}

                {!agendaLoading &&
                  activeTodayAppointments.length > 0 && (
                    <div className="professional-appointment-list">
                      {activeTodayAppointments.map((item) => (
                        <article key={item.id}>
                          <time>
                            {appointmentTime(item.start)}
                          </time>

                          <div>
                            <b>{item.clientName}</b>

                            <span>
                              {item.serviceName} · {item.duration} minutos
                            </span>

                            <small>
                              R${" "}
                              {item.paymentAmount
                                .toFixed(2)
                                .replace(".", ",")}{" "}
                              ·{" "}
                              {item.paymentStatus === "paid"
                                ? "pagamento confirmado"
                                : "pagamento no local"}
                            </small>
                          </div>

                          <em className={item.status}>
                            {professionalStatusLabel[item.status]}
                          </em>
                          {appointmentActions(item)}
                          {completionForm(item)}
                        </article>
                      ))}
                    </div>
                  )}

                {agendaError && (
                  <div className="professional-agenda-feedback error">
                    {agendaError}

                    <button onClick={loadAgenda}>
                      Tentar novamente
                    </button>
                  </div>
                )}
            </section>
          </>
        )}
        {section === "Minha agenda" && (
          <div className="screen-card professional-agenda">
            <div className="screen-toolbar">
              <div>
                <h2>Minha agenda completa</h2>
                <p>Consulte qualquer mês, organize bloqueios e registre encaixes.</p>
              </div>
              <div className="agenda-toolbar-actions">
                <input type="month" min={monthKey(today)} value={agendaMonth} onChange={(event) => setAgendaMonth(event.target.value)} aria-label="Mês da agenda" />
                <button
                  onClick={() => setAgendaMonth(monthKey(today))}
                >Hoje</button>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleBlockError("");
                    setShowBlockForm((current) => !current);
                  }}
                >
                  {showBlockForm
                    ? "Fechar bloqueio"
                    : "＋ Bloquear horário"}
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={toggleExtraForm}
                >
                  {showExtraForm ? "Fechar formulário" : "＋ Serviço extra"}
                </button>
              </div>
            </div>
            {scheduleBlockError && (
              <p className="schedule-block-error">
                {scheduleBlockError}
              </p>
            )}

            {showBlockForm && (
              <form
                className="schedule-block-form"
                onSubmit={submitScheduleBlock}
              >
                <div>
                  <b>Bloquear um período</b>
                  <small>
                    Esse horário deixará de aparecer para as clientes.
                  </small>
                </div>

                <label>
                  Data
                  <input
                    name="date"
                    type="date"
                    min={todayKey}
                    required
                  />
                </label>

                <label>
                  Início
                  <input
                    name="startTime"
                    type="time"
                    required
                  />
                </label>

                <label>
                  Fim
                  <input
                    name="endTime"
                    type="time"
                    required
                  />
                </label>

                <label>
                  Motivo
                  <input
                    name="reason"
                    placeholder="Ex.: Almoço ou compromisso"
                  />
                </label>

                <button
                  className="primary"
                  disabled={scheduleBlockSaving}
                >
                  {scheduleBlockSaving
                    ? "Bloqueando..."
                    : "Salvar bloqueio"}
                </button>
              </form>
            )}
            {showExtraForm && (
              <form
                className="inline-extra-form"
                onSubmit={submitExtraAppointment}
              >
                <div>
                  <b>Adicionar atendimento fora da grade</b>
                  <small>
                    Ideal para encaixes, retornos e atendimentos sem reserva
                    prévia.
                  </small>
                </div>

                {extraError && (
                  <p className="extra-appointment-error">
                    {extraError}
                  </p>
                )}

                <label>
                  Data
                  <input
                    name="date"
                    type="date"
                    min={todayKey}
                    required
                  />
                </label>

                <label>
                  Horário
                  <input
                    name="time"
                    type="time"
                    required
                  />
                </label>

                <label>
                  Cliente
                  <input
                    name="client"
                    minLength={3}
                    placeholder="Nome da cliente"
                    required
                  />
                </label>

                <label>
                  Serviço
                  <select
                    name="service"
                    value={extraServiceId}
                    required
                    onChange={(event) => {
                      const serviceId = event.target.value;
                      const selectedService = myServices.find(
                        (service) => service.id === serviceId,
                      );

                      setExtraServiceId(serviceId);
                      setExtraDuration(selectedService?.duration || 60);
                    }}
                  >
                    {myServices
                      .filter((service) => service.active)
                      .map((service) => (
                        <option
                          value={service.id}
                          key={service.id}
                        >
                          {service.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Duração em minutos
                  <input
                    name="duration"
                    type="number"
                    min="10"
                    max="720"
                    step="5"
                    value={extraDuration}
                    required
                    onChange={(event) =>
                      setExtraDuration(Number(event.target.value))
                    }
                  />
                </label>

                <label>
                  Observação
                  <input
                    name="notes"
                    placeholder="Opcional"
                  />
                </label>

                <button
                  className="primary"
                  disabled={extraSaving || !extraServiceId}
                >
                  {extraSaving ? "Salvando..." : "Salvar encaixe"}
                </button>
              </form>
            )}
            <div className="month-summary"><span>Visualizando <b>{monthDate.toLocaleDateString("pt-BR", {month:"long",year:"numeric"})}</b></span><span>
              <b>10 minutos de intervalo</b> entre atendimentos
              · horários calculados conforme a duração de cada serviço
            </span></div>
            {scheduleBlocksLoading && (
              <p className="schedule-block-loading">
                Carregando bloqueios...
              </p>
            )}
            <div className="professional-month-calendar">
              {["DOM","SEG","TER","QUA","QUI","SEX","SÁB"].map((label)=><b className="month-weekday" key={label}>{label}</b>)}
              {Array.from({length:firstWeekday}).map((_,i)=><span className="empty-day" key={`empty-${i}`} />)}
              {Array.from(
                { length: daysInMonth },
                (_, index) => index + 1,
              ).map((day) => {
                const date = `${agendaMonth}-${pad(day)}`;

                const dayScheduleBlocks =
                  scheduleBlocks.filter(
                    (block) =>
                      localDateKey(new Date(block.start)) ===
                      date,
                  );

                const dayAppointments =
                  monthAppointments
                    .filter(
                      (item) =>
                        localDateKey(new Date(item.start)) ===
                        date,
                    )
                    .sort((first, second) => {
                      const firstCancelled =
                        first.status === "cancelled" ? 1 : 0;
                      const secondCancelled =
                        second.status === "cancelled" ? 1 : 0;

                      if (
                        firstCancelled !== secondCancelled
                      ) {
                        return (
                          firstCancelled - secondCancelled
                        );
                      }

                      return (
                        new Date(first.start).getTime() -
                        new Date(second.start).getTime()
                      );
                    });

                const dayEntries = [
                  ...dayAppointments.map((item) => ({
                    type: "appointment" as const,
                    start: item.start,
                    appointment: item,
                    block: null,
                  })),
                  ...dayScheduleBlocks.map((block) => ({
                    type: "block" as const,
                    start: block.start,
                    appointment: null,
                    block,
                  })),
                ].sort(
                  (first, second) =>
                    new Date(first.start).getTime() -
                    new Date(second.start).getTime(),
                );

                const previewEntries = dayEntries.slice(0, 2);
                const hiddenEntries = Math.max(
                  dayEntries.length - 2,
                  0,
                );

                return (
                  <article
                    key={day}
                    className={[
                      date < todayKey ? "past" : "",
                      "professional-calendar-day",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <header className="professional-calendar-day-header">
                      <strong>{day}</strong>

                      {dayEntries.length > 0 && (
                        <small>{dayEntries.length}</small>
                      )}
                    </header>

                    <div className="professional-calendar-preview">
                      {previewEntries.map((entry) => {
                        if (
                          entry.type === "appointment" &&
                          entry.appointment
                        ) {
                          const item = entry.appointment;

                          return (
                            <div
                              className={[
                                "calendar-booking",
                                item.outsideSchedule
                                  ? "extra"
                                  : "",
                                item.status === "cancelled"
                                  ? "cancelled"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              key={item.id}
                            >
                              <b>
                                {appointmentTime(item.start)}
                                {item.outsideSchedule
                                  ? " · encaixe"
                                  : ""}
                              </b>

                              <span>{item.serviceName}</span>

                              <small>
                                {item.clientName} ·{" "}
                                {item.duration} min
                              </small>
                            </div>
                          );
                        }

                        if (entry.block) {
                          return (
                            <div
                              className="calendar-block real"
                              key={entry.block.id}
                            >
                              <b>
                                {appointmentTime(
                                  entry.block.start,
                                )}{" "}
                                até{" "}
                                {appointmentTime(
                                  entry.block.end,
                                )}
                              </b>

                              <span>
                                {entry.block.reason ||
                                  "Horário bloqueado"}
                              </span>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>

                    {dayEntries.length > 0 && (
                      <button
                        type="button"
                        className="professional-calendar-day-open"
                        onClick={() =>
                          setSelectedAgendaDate(date)
                        }
                      >
                        {hiddenEntries > 0
                          ? `Ver agenda completa +${hiddenEntries}`
                          : "Ver detalhes do dia"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}
        {section === "Meus serviços" && (
          <div>
            <div className="screen-top">
              <div>
                <h2>Serviços que você realiza</h2>
                <p>Cadastre seus serviços e informe a duração real de cada atendimento.</p>
              </div>
              <button className="primary" onClick={() => { setShowServiceForm(!showServiceForm); setNewServiceCoverChange({ kind: "keep" }); }}>＋ Adicionar serviço</button>
            </div>
            {showServiceForm && (
              <form
                className="professional-service-form"
                onSubmit={submitService}
              >
                <label>
                  Nome do serviço
                  <input
                    name="name"
                    required
                    minLength={3}
                    placeholder="Ex.: Spa dos pés"
                  />
                </label>

                <label>
                  Categoria
                  <input
                    name="category"
                    required
                    minLength={2}
                    placeholder="Ex.: Unhas"
                  />
                </label>

                <label>
                  Descrição
                  <input
                    name="description"
                    placeholder="Explique brevemente o atendimento"
                  />
                </label>

                <label>
                  Duração estimada
                  <input
                    name="duration"
                    type="number"
                    min="10"
                    max="720"
                    step="5"
                    defaultValue="60"
                    required
                  />
                </label>

                <label>
                  Valor no local
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>

                <ServiceCoverEditor currentUrl={null} serviceName="novo serviço" disabled={savingService} onChange={setNewServiceCoverChange} onError={setServicesError} />

                <button className="primary" disabled={savingService}>
                  {savingService ? "Salvando..." : "Salvar serviço"}
                </button>
              </form>
            )}
            {servicesError && (
              <p className="form-error professional-services-error">
                {servicesError}
              </p>
            )}

            {servicesLoading && (
              <p className="professional-services-loading">
                Carregando seus serviços...
              </p>
            )}
            <div className="admin-service-grid professional-services">
              {myServices.map((service) => (
                <article
                  className={!service.active ? "inactive-service" : ""}
                  key={service.id}
                >
                  <div className="professional-service-cover"><ServiceCoverImage src={service.image} alt={service.name} /></div>
                  <div className="service-admin-icon">
                    <Sparkles aria-hidden="true" />
                  </div>

                  <span
                    className={`active-pill ${
                      !service.active ? "inactive" : ""
                    }`}
                  >
                    {service.active ? "Ativo" : "Inativo"}
                  </span>

                  <h3>{service.name}</h3>

                  <p>
                    {service.category} · {service.duration} minutos
                  </p>

                  <div className="professional-service-meta">
                    <b>
                      {service.price.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </b>

                    <span>
                      {service.active
                        ? "Visível para clientes"
                        : "Oculto para clientes"}
                    </span>
                  </div>

                  {editingServiceId === service.id && (
                    <form
                      className="professional-service-edit-form"
                      onSubmit={(event) =>
                        saveServiceChanges(event, service)
                      }
                    >
                      <label>
                        Duração em minutos
                        <input
                          name="duration"
                          type="number"
                          min="10"
                          max="720"
                          step="5"
                          defaultValue={service.duration}
                          required
                        />
                      </label>

                      <label>
                        Valor no local
                        <input
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={service.price}
                          required
                        />
                      </label>

                      <ServiceCoverEditor key={service.id} currentUrl={service.image} serviceName={service.name} disabled={savingService} onChange={setEditServiceCoverChange} onError={setServicesError} />

                      <div>
                        <button
                          type="button"
                          onClick={() => { setEditingServiceId(""); setEditServiceCoverChange({ kind: "keep" }); }}
                        >
                          Voltar
                        </button>

                        <button
                          className="primary"
                          disabled={savingService}
                        >
                          {savingService ? "Salvando..." : "Salvar"}
                        </button>
                      </div>
                    </form>
                  )}

                  <footer>
                    <button
                      onClick={() => {
                        setEditServiceCoverChange({ kind: "keep" });
                        setEditingServiceId(
                          editingServiceId === service.id
                            ? ""
                            : service.id,
                        );
                      }}
                    >
                      Editar serviço
                    </button>

                    <button
                      disabled={savingService}
                      onClick={() => toggleService(service)}
                    >
                      {service.active ? "Desativar" : "Ativar"}
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          </div>
        )}
        {section === "Disponibilidade" && (
          <div className="screen-card availability-settings">
            <div className="screen-top">
              <div>
                <h2>Minha disponibilidade</h2>
                <p>
                  Informe os dias e períodos em que você poderá receber
                  clientes.
                </p>
              </div>

              <button
                type="button"
                className="primary"
                disabled={availabilitySaving || availabilityLoading}
                onClick={submitAvailability}
              >
                {availabilitySaving
                  ? "Salvando..."
                  : "Salvar alterações"}
              </button>
            </div>

            {availabilityError && (
              <p className="availability-message error">
                {availabilityError}
              </p>
            )}

            {availabilitySuccess && (
              <p className="availability-message success">
                {availabilitySuccess}
              </p>
            )}

            {availabilityLoading ? (
              <div className="availability-loading">
                Carregando sua disponibilidade...
              </div>
            ) : (
              <>
                <div className="schedule-rules-card">
                  <div>
                    <b>Horários flexíveis</b>
                    <small>
                      Os horários são calculados conforme a duração
                      de cada serviço, com 10 minutos de intervalo
                      entre atendimentos.
                    </small>
                  </div>

                  <div className="availability-total">
                    <span>Dias disponíveis</span>

                    <b>
                      {
                        availabilityRules.filter((rule) => rule.active)
                          .length
                      }{" "}
                      dias
                    </b>

                    <small>
                      As clientes verão somente horários futuros e livres.
                    </small>
                  </div>
                </div>

                <div className="availability-list">
                  {availabilityWeekdays.map(({ weekday, label }) => {
                    const rule = availabilityRules.find(
                      (item) => item.weekday === weekday,
                    );

                    if (!rule) return null;

                    return (
                      <div
                        className={!rule.active ? "inactive" : ""}
                        key={weekday}
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={rule.active}
                            onChange={(event) =>
                              updateAvailabilityRule(weekday, {
                                active: event.target.checked,
                              })
                            }
                          />

                          <span>{label}</span>
                        </label>

                        <input
                          type="time"
                          value={rule.startTime}
                          disabled={!rule.active}
                          aria-label={`Início de ${label}`}
                          onChange={(event) =>
                            updateAvailabilityRule(weekday, {
                              startTime: event.target.value,
                            })
                          }
                        />

                        <em>até</em>

                        <input
                          type="time"
                          value={rule.endTime}
                          disabled={!rule.active}
                          aria-label={`Fim de ${label}`}
                          onChange={(event) =>
                            updateAvailabilityRule(weekday, {
                              endTime: event.target.value,
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="professional-time-off">
                  <div className="time-off-card">
                    <span>☼</span>

                    <div>
                      <b>Folgas e ausências</b>
                      <small>
                        Bloqueie datas em que você não poderá receber clientes.
                      </small>
                    </div>

                    <button
                      type="button"
                      disabled={timeOffSaving}
                      onClick={() => setShowTimeOffForm((current) => !current)}
                    >
                      {showTimeOffForm ? "Fechar" : "＋ Adicionar folga"}
                    </button>
                  </div>

                  {timeOffError && (
                    <p className="availability-message error">
                      {timeOffError}
                    </p>
                  )}

                  {showTimeOffForm && (
                    <form
                      className="time-off-form"
                      onSubmit={submitTimeOff}
                    >
                      <label>
                        Data da folga

                        <input
                          name="date"
                          type="date"
                          min={todayKey}
                          required
                        />
                      </label>

                      <label>
                        Motivo

                        <input
                          name="reason"
                          minLength={3}
                          placeholder="Ex.: Compromisso pessoal"
                        />
                      </label>

                      <button
                        className="primary"
                        disabled={timeOffSaving}
                      >
                        {timeOffSaving ? "Salvando..." : "Bloquear data"}
                      </button>
                    </form>
                  )}

                  <div className="time-off-list">
                    {timeOffsLoading ? (
                      <p>Carregando folgas...</p>
                    ) : timeOffs.length === 0 ? (
                      <p>Nenhuma folga futura cadastrada.</p>
                    ) : (
                      timeOffs.map((timeOff) => (
                        <article key={timeOff.id}>
                          <div>
                            <b>
                              {new Date(
                                `${timeOff.date}T12:00:00`,
                              ).toLocaleDateString("pt-BR", {
                                weekday: "long",
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                              })}
                            </b>

                            <small>
                              {timeOff.reason || "Folga"}
                            </small>
                          </div>

                          <button
                            type="button"
                            disabled={timeOffSaving}
                            onClick={() => setTimeOffToRemove(timeOff)}
                          >
                            Liberar data
                          </button>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {section === "Notificações" && (
          <div className="screen-card notification-settings">
            <div className="screen-top">
              <div>
                <h2>Como você será avisada?</h2>

                <p>
                  Estes são os canais utilizados para informar alterações
                  relacionadas à sua agenda.
                </p>
              </div>
            </div>

            <div className="notification-channel-grid">
              <article className="notification-fixed-channel">
                <span className="channel-icon">◉</span>

                <div>
                  <b>Notificação no sistema</b>

                  <small>
                    Aparece no sino e permanece no seu histórico.
                  </small>
                </div>

                <span className="notification-channel-active">
                  Ativo
                </span>
              </article>

              <article className="notification-fixed-channel">
                <span className="channel-icon">✉</span>

                <div>
                  <b>E-mail</b>

                  <small>
                    Os detalhes são enviados ao seu e-mail profissional
                    cadastrado.
                  </small>
                </div>

                <span className="notification-channel-active">
                  Ativo
                </span>
              </article>
            </div>

            <h3>Eventos que geram aviso</h3>

            <div className="notification-event-list">
              {[
                "Novo agendamento confirmado",
                "Reagendamento realizado",
                "Cancelamento de horário",
                "Lembrete da agenda do dia seguinte",
              ].map((event) => (
                <article key={event}>
                  <span>
                    <b>{event}</b>

                    <small>
                      A profissional recebe as informações compatíveis
                      com este evento.
                    </small>
                  </span>

                  <span className="notification-event-active">
                    <b aria-hidden="true">✓</b>
                    Ativo
                  </span>
                </article>
              ))}
            </div>
          </div>
        )}
      </main>

      <ProfessionalDayAgendaDialog
        open={selectedAgendaDate !== null}
        date={selectedAgendaDate}
        appointments={selectedDayAppointments}
        blocks={selectedDayScheduleBlocks}
        blockRemoving={scheduleBlockSaving}
        renderActions={appointmentActions}
        renderCompletion={completionForm}
        onRequestRemoveBlock={(block) =>
          setScheduleBlockToRemove(block)
        }
        onClose={() => {
          setSelectedAgendaDate(null);
          setCompletionAppointmentId("");
        }}
      />

      <ActionDialog
        open={appointmentToCancel !== null}
        title="Cancelar atendimento?"
        description={
          appointmentToCancel
            ? `O horário de ${appointmentToCancel.clientName} será liberado novamente para outras clientes.`
            : ""
        }
        confirmLabel="Confirmar cancelamento"
        danger
        loading={
          appointmentToCancel
            ? updatingAppointmentId === appointmentToCancel.id
            : false
        }
        input={{
          label: "Motivo do cancelamento",
          placeholder: "Ex.: Cliente solicitou o cancelamento",
          minLength: 3,
          required: true,
        }}
        onCancel={() => setAppointmentToCancel(null)}
        onConfirm={(reason) => {
          if (!appointmentToCancel) return;

          const appointment = appointmentToCancel;

          setAppointmentToCancel(null);

          void changeAppointmentStatus(
            appointment,
            "cancelled",
            reason,
          );
        }}
      />
      <ActionDialog
        open={timeOffToRemove !== null}
        title="Liberar esta data?"
        description={
          timeOffToRemove
            ? `Os horários de ${new Date(
                `${timeOffToRemove.date}T12:00:00`,
              ).toLocaleDateString("pt-BR")} voltarão a ficar disponíveis para as clientes.`
            : ""
        }
        confirmLabel="Liberar data"
        loading={timeOffSaving}
        onCancel={() => setTimeOffToRemove(null)}
        onConfirm={() => {
          if (!timeOffToRemove) return;

          const timeOff = timeOffToRemove;
          setTimeOffToRemove(null);

          void removeTimeOff(timeOff);
        }}
      />

      <ActionDialog
        open={scheduleBlockToRemove !== null}
        title="Liberar este horário?"
        description={
          scheduleBlockToRemove
            ? `O período de ${appointmentTime(
                scheduleBlockToRemove.start,
              )} até ${appointmentTime(
                scheduleBlockToRemove.end,
              )} voltará a aparecer para as clientes.`
            : ""
        }
        confirmLabel="Liberar horário"
        loading={scheduleBlockSaving}
        onCancel={() => setScheduleBlockToRemove(null)}
        onConfirm={() => {
          if (!scheduleBlockToRemove) return;

          const block = scheduleBlockToRemove;
          setScheduleBlockToRemove(null);

          void removeScheduleBlock(block);
        }}
      />
    </div>
  );
}
