-- Catálogo inicial da cliente e profissionais públicos sem acesso ao painel.
-- Execute uma única vez no SQL Editor depois da migration 001_full_setup.sql.

alter table public.professionals alter column profile_id drop not null;

insert into public.professionals (id, profile_id, display_name, specialty, bio, default_slot_minutes, active)
values
  ('10000000-0000-4000-8000-000000000001', null, 'Eliane Cristina', 'Massagista e Esteticista', 'Cuidados faciais, corporais e momentos de relaxamento.', 60, true),
  ('10000000-0000-4000-8000-000000000002', null, 'Dayanne Braido', 'Manicure e Nail Designer', 'Cuidados para unhas com acabamento delicado e personalizado.', 60, true)
on conflict (id) do update set
  display_name = excluded.display_name,
  specialty = excluded.specialty,
  bio = excluded.bio,
  active = true;

insert into public.services (name, slug, category, description, duration_minutes, price, image_url, featured, active)
values
  ('Massagem Relaxante', 'massagem-relaxante', 'Bem-estar', 'Massagem pensada para aliviar tensões e proporcionar relaxamento.', 60, 120.00, '/spa-eliane.png', true, true),
  ('Drenagem Linfática', 'drenagem-linfatica', 'Corporal', 'Técnica corporal suave que auxilia o bem-estar e a redução de inchaços.', 50, 110.00, '/eliane-care.png', true, true),
  ('Limpeza de Pele', 'limpeza-de-pele', 'Facial', 'Protocolo completo de higienização e cuidado personalizado da pele.', 70, 145.00, '/eliane-care.png', true, true),
  ('Micropigmentação', 'micropigmentacao', 'Estética', 'Procedimento personalizado para realçar a beleza com naturalidade.', 90, 280.00, '/spa-eliane.png', false, true),
  ('Manicure em Gel', 'manicure-em-gel', 'Unhas', 'Esmaltação em gel com acabamento duradouro e cuidado completo.', 60, 75.00, '/nails-detail.png', true, true),
  ('Blindagem', 'blindagem', 'Unhas', 'Proteção para unhas naturais com acabamento uniforme e resistente.', 50, 65.00, '/spa-nails.png', true, true)
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  price = excluded.price,
  image_url = excluded.image_url,
  featured = excluded.featured,
  active = true;

insert into public.professional_services (professional_id, service_id, active)
select
  case when s.category = 'Unhas'
    then '10000000-0000-4000-8000-000000000002'::uuid
    else '10000000-0000-4000-8000-000000000001'::uuid
  end,
  s.id,
  true
from public.services s
where s.slug in ('massagem-relaxante','drenagem-linfatica','limpeza-de-pele','micropigmentacao','manicure-em-gel','blindagem')
on conflict (professional_id, service_id) do update set active = true;

insert into public.availability_rules (professional_id, weekday, start_time, end_time, slot_minutes, active)
select p.id, day.weekday, '09:00'::time,
  case when p.display_name = 'Eliane Cristina' then '19:00'::time else '18:00'::time end,
  60, true
from public.professionals p
cross join (values (1),(2),(3),(4),(5),(6)) as day(weekday)
where p.id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002')
and not exists (
  select 1 from public.availability_rules ar
  where ar.professional_id = p.id and ar.weekday = day.weekday and ar.active
);