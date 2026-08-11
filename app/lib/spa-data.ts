export type Service = {
  id?: string;
  slug?: string;
  professionalId?: string;
  name: string;
  category: string;
  description?: string;
  duration: number;
  price: number;
  professional: string;
  professionalFullName?: string;
  specialty?: string;
  image?: string;
};
export type Booking = {
  time: string;
  client: string;
  service: string;
  professional: string;
  status: "Confirmado" | "Pendente" | "Concluído";
  price?: number;
  paymentStatus?: "Pendente" | "Pago";
};
export type ServiceMedia = {
  id: string;
  title: string;
  service: string;
  professional: string;
  type: "image" | "video";
  url: string;
  createdAt: string;
  expiresAt: string;
};

export const services: Service[] = [
  {
    name: "Massagem Relaxante",
    category: "Bem-estar",
    duration: 60,
    price: 120,
    professional: "Eliane",
    image: "/spa-eliane.png",
  },
  {
    name: "Drenagem Linfática",
    category: "Corporal",
    duration: 50,
    price: 110,
    professional: "Eliane",
    image: "/spa-eliane.png",
  },
  {
    name: "Limpeza de Pele",
    category: "Facial",
    duration: 70,
    price: 145,
    professional: "Eliane",
    image: "/spa-eliane.png",
  },
  {
    name: "Micropigmentação",
    category: "Estética",
    duration: 90,
    price: 280,
    professional: "Eliane",
    image: "/spa-eliane.png",
  },
  {
    name: "Manicure em Gel",
    category: "Unhas",
    duration: 60,
    price: 75,
    professional: "Dayanne",
    image: "/spa-nails.png",
  },
  {
    name: "Blindagem",
    category: "Unhas",
    duration: 50,
    price: 65,
    professional: "Dayanne",
    image: "/spa-nails.png",
  },
];

export const bookings: Booking[] = [
  {
    time: "09:00",
    client: "Mariana Alves",
    service: "Drenagem Linfática",
    professional: "Eliane",
    status: "Confirmado",
    price: 110,
    paymentStatus: "Pendente",
  },
  {
    time: "10:30",
    client: "Carla Mendes",
    service: "Manicure em Gel",
    professional: "Dayanne",
    status: "Concluído",
    price: 75,
    paymentStatus: "Pago",
  },
  {
    time: "13:00",
    client: "Beatriz Lima",
    service: "Limpeza de Pele",
    professional: "Eliane",
    status: "Pendente",
    price: 145,
    paymentStatus: "Pendente",
  },
  {
    time: "15:30",
    client: "Fernanda Souza",
    service: "Blindagem",
    professional: "Dayanne",
    status: "Confirmado",
    price: 65,
    paymentStatus: "Pendente",
  },
];

export const initialServiceMedia: ServiceMedia[] = [
  {
    id: "media-1",
    title: "Cuidado que renova",
    service: "Limpeza de Pele",
    professional: "Eliane",
    type: "image",
    url: "/eliane-care.png",
    createdAt: "2026-08-08T10:00:00.000Z",
    expiresAt: "2026-08-22T10:00:00.000Z",
  },
  {
    id: "media-2",
    title: "Detalhes que encantam",
    service: "Manicure em Gel",
    professional: "Dayanne",
    type: "image",
    url: "/nails-detail.png",
    createdAt: "2026-08-08T10:00:00.000Z",
    expiresAt: "2026-08-22T10:00:00.000Z",
  },
  {
    id: "media-3",
    title: "Seu momento de pausa",
    service: "Massagem Relaxante",
    professional: "Eliane",
    type: "image",
    url: "/spa-eliane.png",
    createdAt: "2026-08-08T10:00:00.000Z",
    expiresAt: "2026-08-22T10:00:00.000Z",
  },
  {
    id: "media-4",
    title: "Unhas feitas para você",
    service: "Blindagem",
    professional: "Dayanne",
    type: "image",
    url: "/spa-nails.png",
    createdAt: "2026-08-08T10:00:00.000Z",
    expiresAt: "2026-08-22T10:00:00.000Z",
  },
];

export const pad = (value: number) => String(value).padStart(2, "0");
export const monthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
export const hourlySlots = (start: number, end: number, stepMinutes = 60) => {
  const slots: string[] = [];
  for (let minutes = start * 60; minutes < end * 60; minutes += stepMinutes) {
    slots.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  return slots;
};

export const serviceFilters = ["Todos", "Estética e bem-estar", "Unhas"];
export const filterServices = (filter: string) => filter === "Todos" ? services : filter === "Unhas" ? services.filter((service) => service.category === "Unhas") : services.filter((service) => service.category !== "Unhas");